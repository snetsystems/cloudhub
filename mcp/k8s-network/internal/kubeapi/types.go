package kubeapi

import "encoding/json"

type ObjectMeta struct {
	Name            string            `json:"name"`
	Namespace       string            `json:"namespace"`
	ResourceVersion string            `json:"resourceVersion"`
	Labels          map[string]string `json:"labels"`
}

type LabelSelector struct {
	MatchLabels      map[string]string          `json:"matchLabels"`
	MatchExpressions []LabelSelectorRequirement `json:"matchExpressions"`
}

type LabelSelectorRequirement struct {
	Key      string   `json:"key"`
	Operator string   `json:"operator"`
	Values   []string `json:"values"`
}

type Deployment struct {
	APIVersion string     `json:"apiVersion"`
	Kind       string     `json:"kind"`
	Metadata   ObjectMeta `json:"metadata"`
	Spec       struct {
		Selector LabelSelector `json:"selector"`
	} `json:"spec"`
}

type Pod struct {
	APIVersion string     `json:"apiVersion"`
	Kind       string     `json:"kind"`
	Metadata   ObjectMeta `json:"metadata"`
	Status     struct {
		PodIP string `json:"podIP"`
	} `json:"status"`
}

type PodList struct {
	APIVersion string `json:"apiVersion"`
	Kind       string `json:"kind"`
	Items      []Pod  `json:"items"`
}

type Service struct {
	APIVersion string     `json:"apiVersion"`
	Kind       string     `json:"kind"`
	Metadata   ObjectMeta `json:"metadata"`
	Spec       struct {
		Selector map[string]string `json:"selector"`
		Ports    []ServicePort     `json:"ports"`
	} `json:"spec"`
}

type ServicePort struct {
	Name       string          `json:"name"`
	Protocol   string          `json:"protocol"`
	Port       int32           `json:"port"`
	TargetPort json.RawMessage `json:"targetPort"`
}

type ObjectReference struct {
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
}

type EndpointSliceList struct {
	APIVersion string          `json:"apiVersion"`
	Kind       string          `json:"kind"`
	Items      []EndpointSlice `json:"items"`
}

type EndpointSlice struct {
	Metadata  ObjectMeta     `json:"metadata"`
	Ports     []EndpointPort `json:"ports"`
	Endpoints []Endpoint     `json:"endpoints"`
}

type EndpointPort struct {
	Name     *string `json:"name"`
	Protocol *string `json:"protocol"`
	Port     *int32  `json:"port"`
}

type Endpoint struct {
	Addresses  []string `json:"addresses"`
	Conditions struct {
		Ready *bool `json:"ready"`
	} `json:"conditions"`
	TargetRef ObjectReference `json:"targetRef"`
}

type NetworkPolicyList struct {
	APIVersion string          `json:"apiVersion"`
	Kind       string          `json:"kind"`
	Items      []NetworkPolicy `json:"items"`
}

type NetworkPolicy struct {
	APIVersion string            `json:"apiVersion"`
	Kind       string            `json:"kind"`
	Metadata   ObjectMeta        `json:"metadata"`
	Spec       NetworkPolicySpec `json:"spec"`
}

type NetworkPolicySpec struct {
	PodSelector LabelSelector              `json:"podSelector"`
	PolicyTypes []string                   `json:"policyTypes"`
	Ingress     []NetworkPolicyIngressRule `json:"ingress"`
}

type NetworkPolicyIngressRule struct {
	Ports []NetworkPolicyPort `json:"ports"`
	From  []NetworkPolicyPeer `json:"from"`
}

type NetworkPolicyPort struct {
	Protocol *string         `json:"protocol"`
	Port     json.RawMessage `json:"port"`
	EndPort  *int32          `json:"endPort"`
}

type NetworkPolicyPeer struct {
	PodSelector       *LabelSelector `json:"podSelector"`
	NamespaceSelector *LabelSelector `json:"namespaceSelector"`
}
