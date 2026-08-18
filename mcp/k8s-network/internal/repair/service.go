package repair

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/snetsystems/cloudhub-k8s-network-mcp/internal/cloudhubproxy"
	"github.com/snetsystems/cloudhub-k8s-network-mcp/internal/kubeapi"
)

type ErrorCode string

const (
	ErrorNotFound                 ErrorCode = "not_found"
	ErrorAmbiguousTarget          ErrorCode = "ambiguous_target"
	ErrorNotAllowed               ErrorCode = "not_allowed"
	ErrorNoChange                 ErrorCode = "no_change"
	ErrorPlanExpired              ErrorCode = "plan_expired"
	ErrorPlanAlreadyUsed          ErrorCode = "plan_already_used"
	ErrorResourceConflict         ErrorCode = "resource_conflict"
	ErrorCloudHubProxyUnavailable ErrorCode = "cloudhub_proxy_unavailable"
	ErrorUnauthenticated          ErrorCode = "unauthenticated"
)

type ServiceError struct {
	Code    ErrorCode
	Message string
	Cause   error
}

func (e *ServiceError) Error() string {
	if e.Message == "" {
		return string(e.Code)
	}
	return string(e.Code) + ": " + e.Message
}

func (e *ServiceError) Unwrap() error { return e.Cause }

func ErrorCodeOf(err error) ErrorCode {
	var serviceErr *ServiceError
	if errors.As(err, &serviceErr) {
		return serviceErr.Code
	}
	switch {
	case errors.Is(err, ErrPlanExpired):
		return ErrorPlanExpired
	case errors.Is(err, ErrPlanUsed), errors.Is(err, ErrPlanInProgress):
		return ErrorPlanAlreadyUsed
	case errors.Is(err, ErrPlanNotFound):
		return ErrorNotFound
	default:
		return ""
	}
}

type InspectInput struct {
	Namespace          string `json:"namespace"`
	SourceWorkload     string `json:"sourceWorkload"`
	DestinationService string `json:"destinationService"`
}

type InspectResult struct {
	Namespace          string            `json:"namespace"`
	SourceWorkload     string            `json:"sourceWorkload"`
	DestinationService string            `json:"destinationService"`
	ServiceTargetPort  int32             `json:"serviceTargetPort"`
	Policies           []PolicyCandidate `json:"policies"`
}

type RepairInput struct {
	Namespace           string `json:"namespace"`
	SourceWorkload      string `json:"sourceWorkload"`
	DestinationService  string `json:"destinationService"`
	PolicyName          string `json:"policyName"`
	ExpectedCurrentPort int32  `json:"expectedCurrentPort"`
	DesiredPort         int32  `json:"desiredPort"`
}

type RepairResult struct {
	Namespace       string `json:"namespace"`
	PolicyName      string `json:"policyName"`
	PreviousPort    int32  `json:"previousPort"`
	CurrentPort     int32  `json:"currentPort"`
	ResourceVersion string `json:"resourceVersion"`
	Verified        bool   `json:"verified"`
	AlreadyRepaired bool   `json:"alreadyRepaired"`
}

type PolicyCandidate struct {
	Name            string `json:"name"`
	CurrentPort     int32  `json:"currentPort"`
	ResourceVersion string `json:"resourceVersion"`
}

type PlanInput struct {
	Namespace          string `json:"namespace"`
	PolicyName         string `json:"policyName"`
	DestinationService string `json:"destinationService"`
}

type PlanResult struct {
	PlanID          string    `json:"planId"`
	Namespace       string    `json:"namespace"`
	PolicyName      string    `json:"policyName"`
	CurrentPort     int32     `json:"currentPort"`
	DesiredPort     int32     `json:"desiredPort"`
	ResourceVersion string    `json:"resourceVersion"`
	ExpiresAt       time.Time `json:"expiresAt"`
	Diff            string    `json:"diff"`
}

type ApplyInput struct {
	PlanID         string `json:"planId"`
	Namespace      string `json:"namespace"`
	PolicyName     string `json:"policyName"`
	CurrentPort    int32  `json:"currentPort"`
	DesiredPort    int32  `json:"desiredPort"`
	IdempotencyKey string `json:"idempotencyKey"`
}

type VerifyInput struct {
	PlanID string `json:"planId"`
}

type VerifyResult struct {
	PlanID      string `json:"planId"`
	Verified    bool   `json:"verified"`
	CurrentPort int32  `json:"currentPort"`
}

type Proxy interface {
	Do(context.Context, string, string, []byte, string) ([]byte, error)
}

type Service struct {
	proxy            Proxy
	allowedNamespace string
	plans            *PlanStore
}

func NewService(proxy Proxy, allowedNamespace string, plans *PlanStore) *Service {
	return &Service{proxy: proxy, allowedNamespace: allowedNamespace, plans: plans}
}

func (s *Service) Inspect(ctx context.Context, in InspectInput) (InspectResult, error) {
	if err := s.validateNamespace(in.Namespace); err != nil {
		return InspectResult{}, err
	}
	if in.SourceWorkload == "" || in.DestinationService == "" {
		return InspectResult{}, serviceError(ErrorNotAllowed, "workload and service names are required", nil)
	}

	deployment, err := getJSON[kubeapi.Deployment](
		ctx,
		s,
		fmt.Sprintf("/apis/apps/v1/namespaces/%s/deployments/%s", url.PathEscape(in.Namespace), url.PathEscape(in.SourceWorkload)),
	)
	if err != nil {
		return InspectResult{}, err
	}
	if deployment.APIVersion != "apps/v1" || deployment.Kind != "Deployment" || deployment.Metadata.Name != in.SourceWorkload {
		return InspectResult{}, serviceError(ErrorNotAllowed, "unexpected source workload response", nil)
	}
	sourceSelector, err := selectorQuery(deployment.Spec.Selector)
	if err != nil {
		return InspectResult{}, err
	}
	sourcePods, err := getJSON[kubeapi.PodList](
		ctx,
		s,
		fmt.Sprintf("/api/v1/namespaces/%s/pods?%s", url.PathEscape(in.Namespace), url.Values{"labelSelector": {sourceSelector}}.Encode()),
	)
	if err != nil {
		return InspectResult{}, err
	}
	if len(sourcePods.Items) == 0 {
		return InspectResult{}, serviceError(ErrorNotFound, "source workload has no pods", nil)
	}

	service, endpointSlices, targetPort, err := s.readServiceTarget(ctx, in.Namespace, in.DestinationService)
	if err != nil {
		return InspectResult{}, err
	}
	destinationSelector := labelsQuery(service.Spec.Selector)
	if destinationSelector == "" {
		return InspectResult{}, serviceError(ErrorAmbiguousTarget, "service has no selector", nil)
	}
	destinationPods, err := getJSON[kubeapi.PodList](
		ctx,
		s,
		fmt.Sprintf("/api/v1/namespaces/%s/pods?%s", url.PathEscape(in.Namespace), url.Values{"labelSelector": {destinationSelector}}.Encode()),
	)
	if err != nil {
		return InspectResult{}, err
	}
	if err := validateEndpointPods(endpointSlices, destinationPods.Items, in.Namespace); err != nil {
		return InspectResult{}, err
	}

	policies, err := getJSON[kubeapi.NetworkPolicyList](
		ctx,
		s,
		fmt.Sprintf("/apis/networking.k8s.io/v1/namespaces/%s/networkpolicies", url.PathEscape(in.Namespace)),
	)
	if err != nil {
		return InspectResult{}, err
	}
	if policies.APIVersion != "networking.k8s.io/v1" || policies.Kind != "NetworkPolicyList" {
		return InspectResult{}, serviceError(ErrorNotAllowed, "unexpected NetworkPolicy list response", nil)
	}
	candidates := make([]PolicyCandidate, 0)
	for _, policy := range policies.Items {
		if policy.APIVersion == "" {
			policy.APIVersion = policies.APIVersion
		}
		if policy.Kind == "" {
			policy.Kind = "NetworkPolicy"
		}
		if policy.APIVersion != "networking.k8s.io/v1" || policy.Kind != "NetworkPolicy" {
			continue
		}
		if !selectorMatchesAny(policy.Spec.PodSelector, destinationPods.Items) {
			continue
		}
		currentPort, err := supportedPolicyPort(policy)
		if err != nil || !policyAllowsSource(policy, sourcePods.Items) {
			continue
		}
		candidates = append(candidates, PolicyCandidate{
			Name:            policy.Metadata.Name,
			CurrentPort:     currentPort,
			ResourceVersion: policy.Metadata.ResourceVersion,
		})
	}
	if len(candidates) == 0 {
		return InspectResult{}, serviceError(ErrorNotFound, "no supported NetworkPolicy selects the path", nil)
	}
	sort.Slice(candidates, func(i, j int) bool { return candidates[i].Name < candidates[j].Name })

	return InspectResult{
		Namespace:          in.Namespace,
		SourceWorkload:     in.SourceWorkload,
		DestinationService: in.DestinationService,
		ServiceTargetPort:  targetPort,
		Policies:           candidates,
	}, nil
}

func (s *Service) Plan(ctx context.Context, in PlanInput) (PlanResult, error) {
	if err := s.validateNamespace(in.Namespace); err != nil {
		return PlanResult{}, err
	}
	if in.PolicyName == "" || in.DestinationService == "" {
		return PlanResult{}, serviceError(ErrorNotAllowed, "policy and service names are required", nil)
	}

	service, _, desiredPort, err := s.readServiceTarget(ctx, in.Namespace, in.DestinationService)
	if err != nil {
		return PlanResult{}, err
	}
	policy, err := getJSON[kubeapi.NetworkPolicy](
		ctx,
		s,
		fmt.Sprintf("/apis/networking.k8s.io/v1/namespaces/%s/networkpolicies/%s", url.PathEscape(in.Namespace), url.PathEscape(in.PolicyName)),
	)
	if err != nil {
		return PlanResult{}, err
	}
	if policy.APIVersion != "networking.k8s.io/v1" || policy.Kind != "NetworkPolicy" ||
		policy.Metadata.Name != in.PolicyName || !selectorMatchesLabels(policy.Spec.PodSelector, service.Spec.Selector) {
		return PlanResult{}, serviceError(ErrorNotAllowed, "policy does not select the destination service", nil)
	}
	currentPort, err := supportedPolicyPort(policy)
	if err != nil {
		return PlanResult{}, err
	}
	if currentPort == desiredPort {
		return PlanResult{}, serviceError(ErrorNoChange, "NetworkPolicy port already matches the service target", nil)
	}

	created := s.plans.Create(Plan{
		Namespace:       in.Namespace,
		PolicyName:      in.PolicyName,
		CurrentPort:     currentPort,
		DesiredPort:     desiredPort,
		ResourceVersion: policy.Metadata.ResourceVersion,
	})
	return PlanResult{
		PlanID:          created.ID,
		Namespace:       created.Namespace,
		PolicyName:      created.PolicyName,
		CurrentPort:     created.CurrentPort,
		DesiredPort:     created.DesiredPort,
		ResourceVersion: created.ResourceVersion,
		ExpiresAt:       created.ExpiresAt,
		Diff: fmt.Sprintf(
			"spec.ingress[0].ports[0].port: %d -> %d",
			created.CurrentPort,
			created.DesiredPort,
		),
	}, nil
}

func (s *Service) Apply(ctx context.Context, in ApplyInput) (ApplyResult, error) {
	if err := s.validateNamespace(in.Namespace); err != nil {
		return ApplyResult{}, err
	}
	if in.PlanID == "" || in.IdempotencyKey == "" {
		return ApplyResult{}, serviceError(ErrorNotAllowed, "plan ID and idempotency key are required", nil)
	}

	plan, previous, err := s.plans.BeginApply(in.PlanID, in.IdempotencyKey)
	if err != nil {
		return ApplyResult{}, mapPlanError(err)
	}
	if previous != nil {
		return *previous, nil
	}
	if in.Namespace != plan.Namespace || in.PolicyName != plan.PolicyName ||
		in.CurrentPort != plan.CurrentPort || in.DesiredPort != plan.DesiredPort {
		return ApplyResult{}, serviceError(ErrorNotAllowed, "approval fields do not match the stored plan", nil)
	}

	path := fmt.Sprintf(
		"/apis/networking.k8s.io/v1/namespaces/%s/networkpolicies/%s",
		url.PathEscape(plan.Namespace),
		url.PathEscape(plan.PolicyName),
	)
	livePolicy, err := getJSON[kubeapi.NetworkPolicy](ctx, s, path)
	if err != nil {
		return ApplyResult{}, err
	}
	if livePolicy.APIVersion != "networking.k8s.io/v1" || livePolicy.Kind != "NetworkPolicy" ||
		livePolicy.Metadata.Namespace != plan.Namespace || livePolicy.Metadata.Name != plan.PolicyName {
		return ApplyResult{}, serviceError(ErrorNotAllowed, "live resource is not the planned NetworkPolicy", nil)
	}
	livePort, err := supportedPolicyPort(livePolicy)
	if err != nil {
		return ApplyResult{}, err
	}
	if livePolicy.Metadata.ResourceVersion != plan.ResourceVersion || livePort != plan.CurrentPort {
		return ApplyResult{}, serviceError(ErrorResourceConflict, "NetworkPolicy changed after planning", nil)
	}

	type patchOperation struct {
		Op    string      `json:"op"`
		Path  string      `json:"path"`
		Value interface{} `json:"value"`
	}
	patchBody, err := json.Marshal([]patchOperation{
		{Op: "test", Path: "/metadata/resourceVersion", Value: plan.ResourceVersion},
		{Op: "test", Path: "/spec/ingress/0/ports/0/port", Value: plan.CurrentPort},
		{Op: "replace", Path: "/spec/ingress/0/ports/0/port", Value: plan.DesiredPort},
	})
	if err != nil {
		return ApplyResult{}, serviceError(ErrorNotAllowed, "could not construct bounded patch", err)
	}
	if _, err := s.proxy.Do(ctx, http.MethodPatch, path, patchBody, "application/json-patch+json"); err != nil {
		return ApplyResult{}, mapApplyProxyError(err)
	}

	updatedPolicy, err := getJSON[kubeapi.NetworkPolicy](ctx, s, path)
	if err != nil {
		return ApplyResult{}, err
	}
	updatedPort, err := supportedPolicyPort(updatedPolicy)
	if err != nil || updatedPolicy.APIVersion != "networking.k8s.io/v1" ||
		updatedPolicy.Kind != "NetworkPolicy" || updatedPolicy.Metadata.Namespace != plan.Namespace ||
		updatedPolicy.Metadata.Name != plan.PolicyName || updatedPort != plan.DesiredPort {
		return ApplyResult{}, serviceError(ErrorResourceConflict, "NetworkPolicy did not reach the planned state", err)
	}

	result := ApplyResult{
		PlanID:          plan.ID,
		Namespace:       plan.Namespace,
		PolicyName:      plan.PolicyName,
		PreviousPort:    plan.CurrentPort,
		CurrentPort:     updatedPort,
		ResourceVersion: updatedPolicy.Metadata.ResourceVersion,
	}
	if err := s.plans.FinishApply(plan.ID, in.IdempotencyKey, result); err != nil {
		return ApplyResult{}, mapPlanError(err)
	}
	return result, nil
}

func (s *Service) Verify(ctx context.Context, in VerifyInput) (VerifyResult, error) {
	plan, err := s.plans.Get(in.PlanID)
	if err != nil {
		return VerifyResult{}, mapPlanError(err)
	}
	path := fmt.Sprintf(
		"/apis/networking.k8s.io/v1/namespaces/%s/networkpolicies/%s",
		url.PathEscape(plan.Namespace),
		url.PathEscape(plan.PolicyName),
	)
	livePolicy, err := getJSON[kubeapi.NetworkPolicy](ctx, s, path)
	if err != nil {
		return VerifyResult{}, err
	}
	livePort, err := supportedPolicyPort(livePolicy)
	if err != nil || livePolicy.APIVersion != "networking.k8s.io/v1" ||
		livePolicy.Kind != "NetworkPolicy" || livePolicy.Metadata.Namespace != plan.Namespace ||
		livePolicy.Metadata.Name != plan.PolicyName || livePort != plan.DesiredPort {
		return VerifyResult{}, serviceError(ErrorResourceConflict, "live NetworkPolicy does not match the plan", err)
	}
	return VerifyResult{PlanID: plan.ID, Verified: true, CurrentPort: livePort}, nil
}

func (s *Service) Repair(ctx context.Context, in RepairInput) (RepairResult, error) {
	if in.PolicyName == "" || in.ExpectedCurrentPort <= 0 || in.DesiredPort <= 0 {
		return RepairResult{}, serviceError(ErrorNotAllowed, "policy name and ports are required", nil)
	}

	inspected, err := s.Inspect(ctx, InspectInput{
		Namespace:          in.Namespace,
		SourceWorkload:     in.SourceWorkload,
		DestinationService: in.DestinationService,
	})
	if err != nil {
		return RepairResult{}, err
	}
	if inspected.ServiceTargetPort != in.DesiredPort {
		return RepairResult{}, serviceError(ErrorNotAllowed, "desired port does not match the service target", nil)
	}

	var candidate *PolicyCandidate
	for i := range inspected.Policies {
		if inspected.Policies[i].Name == in.PolicyName {
			candidate = &inspected.Policies[i]
			break
		}
	}
	if candidate == nil {
		return RepairResult{}, serviceError(ErrorNotFound, "requested NetworkPolicy was not found", nil)
	}
	if candidate.CurrentPort == in.DesiredPort {
		return RepairResult{
			Namespace:       inspected.Namespace,
			PolicyName:      candidate.Name,
			PreviousPort:    candidate.CurrentPort,
			CurrentPort:     candidate.CurrentPort,
			ResourceVersion: candidate.ResourceVersion,
			Verified:        true,
			AlreadyRepaired: true,
		}, nil
	}
	if candidate.CurrentPort != in.ExpectedCurrentPort {
		return RepairResult{}, serviceError(ErrorNotAllowed, "expected current port does not match the inspected NetworkPolicy", nil)
	}

	planned, err := s.Plan(ctx, PlanInput{
		Namespace:          in.Namespace,
		PolicyName:         in.PolicyName,
		DestinationService: in.DestinationService,
	})
	if err != nil {
		return RepairResult{}, err
	}
	if planned.CurrentPort != in.ExpectedCurrentPort || planned.DesiredPort != in.DesiredPort {
		return RepairResult{}, serviceError(ErrorResourceConflict, "NetworkPolicy or service changed after inspection", nil)
	}

	applied, err := s.Apply(ctx, ApplyInput{
		PlanID:         planned.PlanID,
		Namespace:      planned.Namespace,
		PolicyName:     planned.PolicyName,
		CurrentPort:    planned.CurrentPort,
		DesiredPort:    planned.DesiredPort,
		IdempotencyKey: "repair:" + planned.PlanID,
	})
	if err != nil {
		return RepairResult{}, err
	}
	verified, err := s.Verify(ctx, VerifyInput{PlanID: planned.PlanID})
	if err != nil {
		return RepairResult{}, err
	}
	return RepairResult{
		Namespace:       applied.Namespace,
		PolicyName:      applied.PolicyName,
		PreviousPort:    applied.PreviousPort,
		CurrentPort:     verified.CurrentPort,
		ResourceVersion: applied.ResourceVersion,
		Verified:        verified.Verified,
		AlreadyRepaired: false,
	}, nil
}

func (s *Service) validateNamespace(namespace string) error {
	if namespace != s.allowedNamespace {
		return serviceError(ErrorNotAllowed, "namespace is not allowed", nil)
	}
	return nil
}

func (s *Service) readServiceTarget(
	ctx context.Context,
	namespace string,
	serviceName string,
) (kubeapi.Service, kubeapi.EndpointSliceList, int32, error) {
	service, err := getJSON[kubeapi.Service](
		ctx,
		s,
		fmt.Sprintf("/api/v1/namespaces/%s/services/%s", url.PathEscape(namespace), url.PathEscape(serviceName)),
	)
	if err != nil {
		return kubeapi.Service{}, kubeapi.EndpointSliceList{}, 0, err
	}
	if service.APIVersion != "v1" || service.Kind != "Service" || service.Metadata.Name != serviceName || len(service.Spec.Ports) != 1 {
		return kubeapi.Service{}, kubeapi.EndpointSliceList{}, 0, serviceError(ErrorAmbiguousTarget, "service must expose exactly one port", nil)
	}
	servicePort := service.Spec.Ports[0]
	if servicePort.Protocol != "" && servicePort.Protocol != "TCP" {
		return kubeapi.Service{}, kubeapi.EndpointSliceList{}, 0, serviceError(ErrorAmbiguousTarget, "service port must use TCP", nil)
	}

	endpointSlices, err := getJSON[kubeapi.EndpointSliceList](
		ctx,
		s,
		fmt.Sprintf(
			"/apis/discovery.k8s.io/v1/namespaces/%s/endpointslices?%s",
			url.PathEscape(namespace),
			url.Values{"labelSelector": {"kubernetes.io/service-name=" + serviceName}}.Encode(),
		),
	)
	if err != nil {
		return kubeapi.Service{}, kubeapi.EndpointSliceList{}, 0, err
	}
	if !hasReadyEndpoint(endpointSlices) {
		return kubeapi.Service{}, kubeapi.EndpointSliceList{}, 0, serviceError(ErrorAmbiguousTarget, "service has no ready endpoints", nil)
	}

	targetPort, err := resolveTargetPort(servicePort, endpointSlices)
	if err != nil {
		return kubeapi.Service{}, kubeapi.EndpointSliceList{}, 0, err
	}
	return service, endpointSlices, targetPort, nil
}

func resolveTargetPort(servicePort kubeapi.ServicePort, endpointSlices kubeapi.EndpointSliceList) (int32, error) {
	if len(servicePort.TargetPort) == 0 || string(servicePort.TargetPort) == "null" {
		if servicePort.Port <= 0 {
			return 0, serviceError(ErrorAmbiguousTarget, "service port is invalid", nil)
		}
		return servicePort.Port, nil
	}
	var numericPort int32
	if err := json.Unmarshal(servicePort.TargetPort, &numericPort); err == nil {
		if numericPort <= 0 {
			return 0, serviceError(ErrorAmbiguousTarget, "service targetPort is invalid", nil)
		}
		return numericPort, nil
	}

	var namedPort string
	if err := json.Unmarshal(servicePort.TargetPort, &namedPort); err != nil || namedPort == "" {
		return 0, serviceError(ErrorAmbiguousTarget, "service targetPort is unsupported", nil)
	}
	var resolved int32
	for _, endpointSlice := range endpointSlices.Items {
		if !sliceHasReadyEndpoint(endpointSlice) {
			continue
		}
		matched := false
		for _, endpointPort := range endpointSlice.Ports {
			if endpointPort.Name == nil || *endpointPort.Name != namedPort || endpointPort.Port == nil || *endpointPort.Port <= 0 {
				continue
			}
			if endpointPort.Protocol != nil && *endpointPort.Protocol != "TCP" {
				continue
			}
			matched = true
			if resolved != 0 && resolved != *endpointPort.Port {
				return 0, serviceError(ErrorAmbiguousTarget, "named targetPort resolves inconsistently", nil)
			}
			resolved = *endpointPort.Port
		}
		if !matched {
			return 0, serviceError(ErrorAmbiguousTarget, "named targetPort is unresolved", nil)
		}
	}
	if resolved == 0 {
		return 0, serviceError(ErrorAmbiguousTarget, "named targetPort is unresolved", nil)
	}
	return resolved, nil
}

func validateEndpointPods(endpointSlices kubeapi.EndpointSliceList, pods []kubeapi.Pod, namespace string) error {
	podNames := make(map[string]struct{}, len(pods))
	for _, pod := range pods {
		podNames[pod.Metadata.Name] = struct{}{}
	}
	matched := 0
	for _, endpointSlice := range endpointSlices.Items {
		for _, endpoint := range endpointSlice.Endpoints {
			if endpoint.Conditions.Ready != nil && !*endpoint.Conditions.Ready {
				continue
			}
			if len(endpoint.Addresses) == 0 || endpoint.TargetRef.Kind != "Pod" ||
				(endpoint.TargetRef.Namespace != "" && endpoint.TargetRef.Namespace != namespace) {
				return serviceError(ErrorAmbiguousTarget, "endpoint does not map to a destination pod", nil)
			}
			if _, ok := podNames[endpoint.TargetRef.Name]; !ok {
				return serviceError(ErrorAmbiguousTarget, "endpoint pod is outside the service selector", nil)
			}
			matched++
		}
	}
	if matched == 0 {
		return serviceError(ErrorAmbiguousTarget, "service has no mapped destination pods", nil)
	}
	return nil
}

func hasReadyEndpoint(endpointSlices kubeapi.EndpointSliceList) bool {
	for _, endpointSlice := range endpointSlices.Items {
		if sliceHasReadyEndpoint(endpointSlice) {
			return true
		}
	}
	return false
}

func sliceHasReadyEndpoint(endpointSlice kubeapi.EndpointSlice) bool {
	for _, endpoint := range endpointSlice.Endpoints {
		if endpoint.Conditions.Ready == nil || *endpoint.Conditions.Ready {
			return true
		}
	}
	return false
}

func supportedPolicyPort(policy kubeapi.NetworkPolicy) (int32, error) {
	if policy.APIVersion != "networking.k8s.io/v1" || policy.Kind != "NetworkPolicy" ||
		len(policy.Spec.Ingress) != 1 || len(policy.Spec.Ingress[0].Ports) != 1 {
		return 0, serviceError(ErrorNotAllowed, "unsupported NetworkPolicy shape", nil)
	}
	port := policy.Spec.Ingress[0].Ports[0]
	if port.EndPort != nil || (port.Protocol != nil && *port.Protocol != "TCP") {
		return 0, serviceError(ErrorNotAllowed, "unsupported NetworkPolicy port", nil)
	}
	var numericPort int32
	if len(port.Port) == 0 || json.Unmarshal(port.Port, &numericPort) != nil || numericPort <= 0 {
		return 0, serviceError(ErrorNotAllowed, "NetworkPolicy port must be numeric", nil)
	}
	return numericPort, nil
}

func policyAllowsSource(policy kubeapi.NetworkPolicy, pods []kubeapi.Pod) bool {
	peers := policy.Spec.Ingress[0].From
	if len(peers) == 0 {
		return true
	}
	for _, peer := range peers {
		if peer.NamespaceSelector != nil {
			continue
		}
		if peer.PodSelector == nil || selectorMatchesAny(*peer.PodSelector, pods) {
			return true
		}
	}
	return false
}

func selectorMatchesAny(selector kubeapi.LabelSelector, pods []kubeapi.Pod) bool {
	for _, pod := range pods {
		if selectorMatchesLabels(selector, pod.Metadata.Labels) {
			return true
		}
	}
	return false
}

func selectorMatchesLabels(selector kubeapi.LabelSelector, labels map[string]string) bool {
	if len(selector.MatchExpressions) != 0 || len(selector.MatchLabels) == 0 {
		return false
	}
	for key, value := range selector.MatchLabels {
		if labels[key] != value {
			return false
		}
	}
	return true
}

func selectorQuery(selector kubeapi.LabelSelector) (string, error) {
	if len(selector.MatchExpressions) != 0 || len(selector.MatchLabels) == 0 {
		return "", serviceError(ErrorNotAllowed, "only matchLabels selectors are supported", nil)
	}
	return labelsQuery(selector.MatchLabels), nil
}

func labelsQuery(labels map[string]string) string {
	parts := make([]string, 0, len(labels))
	for key, value := range labels {
		parts = append(parts, key+"="+value)
	}
	sort.Strings(parts)
	return strings.Join(parts, ",")
}

func getJSON[T any](ctx context.Context, service *Service, path string) (T, error) {
	var value T
	body, err := service.proxy.Do(ctx, http.MethodGet, path, nil, "")
	if err != nil {
		return value, mapProxyError(err)
	}
	if err := json.Unmarshal(body, &value); err != nil {
		return value, serviceError(ErrorCloudHubProxyUnavailable, "CloudHub proxy returned invalid JSON", err)
	}
	return value, nil
}

func mapProxyError(err error) error {
	var httpErr *cloudhubproxy.HTTPError
	if errors.As(err, &httpErr) && httpErr.StatusCode == http.StatusNotFound {
		return serviceError(ErrorNotFound, "Kubernetes resource was not found", err)
	}
	return serviceError(ErrorCloudHubProxyUnavailable, "CloudHub Kubernetes proxy request failed", err)
}

func mapApplyProxyError(err error) error {
	var httpErr *cloudhubproxy.HTTPError
	if errors.As(err, &httpErr) && httpErr.StatusCode == http.StatusConflict {
		return serviceError(ErrorResourceConflict, "Kubernetes rejected the planned resource version or port", err)
	}
	return serviceError(ErrorCloudHubProxyUnavailable, "CloudHub Kubernetes proxy request failed", err)
}

func mapPlanError(err error) error {
	switch {
	case errors.Is(err, ErrPlanExpired):
		return serviceError(ErrorPlanExpired, "repair plan expired", err)
	case errors.Is(err, ErrPlanUsed), errors.Is(err, ErrPlanInProgress):
		return serviceError(ErrorPlanAlreadyUsed, "repair plan was already used", err)
	case errors.Is(err, ErrPlanNotFound):
		return serviceError(ErrorNotFound, "repair plan was not found", err)
	default:
		return serviceError(ErrorNotAllowed, "repair plan is invalid", err)
	}
}

func serviceError(code ErrorCode, message string, cause error) error {
	return &ServiceError{Code: code, Message: message, Cause: cause}
}
