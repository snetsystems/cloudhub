package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"unsafe"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

type topologyResponse struct {
	ID              string                   `json:"id"`
	Organization    string                   `json:"organization"`
	Links           selfLinks                `json:"links"`
	Diagram         string                   `json:"diagram,omitempty"`
	Preferences     []string                 `json:"preferences,omitempty"`
	TopologyOptions cloudhub.TopologyOptions `json:"topologyOptions,omitempty"`
}

type topologyOptionsResponse struct {
	MinimapVisible    bool `json:"minimapVisible"`
	HostStatusVisible bool `json:"hostStatusVisible"`
	IPMIVisible       bool `json:"ipmiVisible"`
	LinkVisible       bool `json:"linkVisible"`
}

// RequestBody represents the structure of the request payload
// containing cells, user preferences, and topology options for the topology.
type RequestBody struct {
	Cells           string                   `json:"cells"`
	Preferences     []string                 `json:"preferences"`
	TopologyOptions cloudhub.TopologyOptions `json:"topologyOptions"`
}

func newTopologyResponse(t *cloudhub.Topology, resDiagram bool) *topologyResponse {
	selfLink := fmt.Sprintf("/cloudhub/v1/topologies/%s", t.ID)

	resData := &topologyResponse{
		ID:           t.ID,
		Organization: t.Organization,
		Links:        selfLinks{Self: selfLink},
		Preferences:  t.Preferences,
		TopologyOptions: cloudhub.TopologyOptions{
			MinimapVisible:    t.TopologyOptions.MinimapVisible,
			HostStatusVisible: t.TopologyOptions.HostStatusVisible,
			IPMIVisible:       t.TopologyOptions.IPMIVisible,
			LinkVisible:       t.TopologyOptions.LinkVisible,
		},
	}

	if resDiagram {
		resData.Diagram = t.Diagram
	}

	return resData
}

// Topology returns a single specified topology
func (s *Service) Topology(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defaultOrg, err := s.Store.Organizations(ctx).DefaultOrganization(ctx)
	if err != nil {
		unknownErrorWithMessage(w, err, s.Logger)
		return
	}

	topology, err := s.Store.Topologies(ctx).Get(ctx, cloudhub.TopologyQuery{Organization: &defaultOrg.ID})
	if err != nil {
		if err != cloudhub.ErrTopologyNotFound {
			Error(w, http.StatusBadRequest, err.Error(), s.Logger)
			return
		}
		res := &topologyResponse{
			ID:           "",
			Organization: "",
			Links:        selfLinks{Self: ""},
		}
		encodeJSON(w, http.StatusOK, res, s.Logger)
		return
	}

	res := newTopologyResponse(topology, true)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// NewTopology creates and returns a new topology object
func (s *Service) NewTopology(w http.ResponseWriter, r *http.Request) {
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	if g, e := r.ContentLength, int64(0); g == e {
		msg := fmt.Errorf("request body ContentLength of %d", g)
		invalidData(w, msg, s.Logger)
		return
	}

	ctx := r.Context()
	defaultOrg, err := s.Store.Organizations(ctx).DefaultOrganization(ctx)
	if err != nil {
		unknownErrorWithMessage(w, err, s.Logger)
		return
	}

	var requestData RequestBody

	if err := json.Unmarshal([]byte(byteSlice2String(body)), &requestData); err != nil {
		msg := fmt.Errorf("Invalid data in request body")
		invalidData(w, msg, s.Logger)
		return
	}

	topology := &cloudhub.Topology{
		Diagram:      requestData.Cells,
		Preferences:  requestData.Preferences,
		Organization: defaultOrg.ID,
		TopologyOptions: cloudhub.TopologyOptions{
			MinimapVisible:    requestData.TopologyOptions.MinimapVisible,
			HostStatusVisible: requestData.TopologyOptions.HostStatusVisible,
			IPMIVisible:       requestData.TopologyOptions.IPMIVisible,
			LinkVisible:       requestData.TopologyOptions.LinkVisible,
		},
	}

	if err := ValidTopologRequest(topology, defaultOrg.ID); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	res, err := s.Store.Topologies(ctx).Add(ctx, topology)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	// log registration
	org, _ := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &res.Organization})
	msg := fmt.Sprintf(MsgTopologyCreated.String(), org.Name)
	s.logRegistration(ctx, "Topologies", msg)

	tp := newTopologyResponse(res, false)
	location(w, tp.Links.Self)
	encodeJSON(w, http.StatusCreated, tp, s.Logger)
}

// RemoveTopology deletes a topology
func (s *Service) RemoveTopology(w http.ResponseWriter, r *http.Request) {
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()
	topology, err := s.Store.Topologies(ctx).Get(ctx, cloudhub.TopologyQuery{ID: &id})
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	if err := s.Store.Topologies(ctx).Delete(ctx, topology); err != nil {
		unknownErrorWithMessage(w, err, s.Logger)
		return
	}

	// log registrationte
	org, _ := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &topology.Organization})
	msg := fmt.Sprintf(MsgTopologyDeleted.String(), org.Name)
	s.logRegistration(ctx, "Topologies", msg)

	w.WriteHeader(http.StatusNoContent)
}

// UpdateTopology completely updates either the topology diagram
func (s *Service) UpdateTopology(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	if g, e := r.ContentLength, int64(0); g == e {
		msg := fmt.Errorf("request body ContentLength of %d", g)
		invalidData(w, msg, s.Logger)
		return
	}

	topology, err := s.Store.Topologies(ctx).Get(ctx, cloudhub.TopologyQuery{ID: &id})
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	var requestData RequestBody

	if err := json.Unmarshal([]byte(byteSlice2String(body)), &requestData); err != nil {
		msg := fmt.Errorf("Invalid data in request body")
		invalidData(w, msg, s.Logger)
		return
	}

	topology.Diagram = requestData.Cells
	topology.Preferences = requestData.Preferences
	topology.TopologyOptions = cloudhub.TopologyOptions{
		MinimapVisible:    requestData.TopologyOptions.MinimapVisible,
		HostStatusVisible: requestData.TopologyOptions.HostStatusVisible,
		IPMIVisible:       requestData.TopologyOptions.IPMIVisible,
		LinkVisible:       requestData.TopologyOptions.LinkVisible,
	}

	if err := s.Store.Topologies(ctx).Update(ctx, topology); err != nil {
		msg := fmt.Sprintf("Error updating topology ID %s: %v", id, err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}

	// log registration
	org, _ := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &topology.Organization})
	msg := fmt.Sprintf(MsgTopologyModified.String(), org.Name)
	s.logRegistration(ctx, "Topologies", msg)

	res := newTopologyResponse(topology, false)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// ValidTopologRequest verifies that the topology
func ValidTopologRequest(t *cloudhub.Topology, defaultOrgID string) error {
	if t.Organization == "" {
		t.Organization = defaultOrgID
	}
	return nil
}

func (s *Service) topologyExists(ctx context.Context, orgID string) bool {
	if _, err := s.Store.Topologies(ctx).Get(ctx, cloudhub.TopologyQuery{Organization: &orgID}); err == nil {
		return true
	}

	return false
}

// no-copy conversion from byte slice to string
func byteSlice2String(bs []byte) string {
	return *(*string)(unsafe.Pointer(&bs))
}

// no-copy conversion from string to byte slice
func string2byteSlice(s string) []byte {
	return *(*[]byte)(unsafe.Pointer(&s))
}
