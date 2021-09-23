package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// suport CSP
func getCSP() []string {
	return []string{"AWS", "GCP", "Azure"}
}

type cspRequest struct {
	Provider     string     `json:"provider"`
	Region       string     `json:"region"`
	Accesskey    string     `json:"accesskey"`
	Secretkey    string     `json:"secretkey"`
	Minion       string     `json:"minion"`
}

func (r *cspRequest) ValidCreate() error {
	if r.Provider == ""  {
		return fmt.Errorf("provider required CSP request body")
	}

	if !supportedProvider(r.Provider) {
		return fmt.Errorf("provider is not supported")
	}

	if r.Region == "" {
		return fmt.Errorf("region required CSP request body")
	}
	if r.Accesskey == "" {
		return fmt.Errorf("accesskey required CSP request body")
	}
	if r.Secretkey == "" {
		return fmt.Errorf("secretkey required CSP request body")
	}
	if r.Minion == "" {
		return fmt.Errorf("minion required CSP request body")
	}

	return nil
}

func (r *cspRequest) ValidUpdate() error {
	if r.Region == "" && r.Secretkey == "" && r.Accesskey == "" && r.Minion == "" {
		return fmt.Errorf("No fields to update")
	}

	if r.Provider != ""  {
		return fmt.Errorf("Provider cannot be changed")
	}

	return nil
}

type cspResponse struct {
	ID           string     `json:"id"`
	Provider     string     `json:"provider"`
	Region       string     `json:"region"`
	Accesskey    string     `json:"accesskey"`
	Secretkey    string     `json:"secretkey"`
	Organization string     `json:"organization"`
	Minion       string     `json:"minion"`
	Links        selfLinks  `json:"links"`
}


func newCSPResponse(csp *cloudhub.CSP) *cspResponse {
	selfLink := fmt.Sprintf("/cloudhub/v1/csp/%s", csp.ID)

	resData := &cspResponse{
		ID:           csp.ID,
		Provider:     csp.Provider,
		Region:       csp.Region,
		Accesskey:    csp.AccessKey,
		Secretkey:    csp.SecretKey,
		Organization: csp.Organization,
		Minion:       csp.Minion,
		Links:        selfLinks{Self: selfLink},
	}

	return resData
}

type cspsResponse struct {
	Links selfLinks       `json:"links"`
	CSPs []*cspResponse   `json:"CSPs"`
}

func newCSPsResponse(csps []cloudhub.CSP) *cspsResponse {
	cspsResp := make([]*cspResponse, len(csps))
	for i, csp := range csps {
		cspsResp[i] = newCSPResponse(&csp)
	}

	selfLink := "/cloudhub/v1/csp"
	
	return &cspsResponse{
		CSPs: cspsResp,
		Links: selfLinks{
			Self: selfLink,
		},
	}
}

// CSP returns all CSP within the store
func (s *Service) CSP(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	csps, err := s.Store.CSP(ctx).All(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	res := newCSPsResponse(csps)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// CSPID returns a single specified CSP
func (s *Service) CSPID(w http.ResponseWriter, r *http.Request) {
	id, err := paramStr("id", r)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	ctx := r.Context()
	csp, err := s.Store.CSP(ctx).Get(ctx, cloudhub.CSPQuery{ID: &id})
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	res := newCSPResponse(csp)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// NewCSP creates and returns a new CSP object
func (s *Service) NewCSP(w http.ResponseWriter, r *http.Request) {
	var req cspRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.ValidCreate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()
	defaultOrg, err := s.Store.Organizations(ctx).DefaultOrganization(ctx)
	if err != nil {
		unknownErrorWithMessage(w, err, s.Logger)
		return
	}

	csp := &cloudhub.CSP{
		Provider:     req.Provider,
		Region:       req.Region,
		AccessKey:    req.Accesskey,
		SecretKey:    req.Secretkey,
		Organization: defaultOrg.ID,
		Minion:       req.Minion,
	}


	// validate that the provider and region exists
	if existsCSPInOrg(ctx, s, csp.Provider, csp.Region) {
		invalidData(w, fmt.Errorf("Provider and Region does existed in organization"), s.Logger)
		return
	}

	res, err := s.Store.CSP(ctx).Add(ctx, csp)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	// log registrationte
	msg := fmt.Sprintf(MsgCSPCreated.String(), res.Provider)
	s.logRegistration(ctx, "CSP", msg)

	resCSP := newCSPResponse(res)
	location(w, resCSP.Links.Self)
	encodeJSON(w, http.StatusCreated, resCSP, s.Logger)
}

// RemoveCSP deletes a CSP
func (s *Service) RemoveCSP(w http.ResponseWriter, r *http.Request) {
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()
	csp, err := s.Store.CSP(ctx).Get(ctx, cloudhub.CSPQuery{ID: &id})
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	if err := s.Store.CSP(ctx).Delete(ctx, csp); err != nil {
		unknownErrorWithMessage(w, err, s.Logger)
		return
	}

	// log registrationte
	msg := fmt.Sprintf(MsgCSPDeleted.String(), csp.Provider)
	s.logRegistration(ctx, "CSP", msg)

	w.WriteHeader(http.StatusNoContent)
}

// UpdateCSP completely updates either the CSP
func (s *Service) UpdateCSP(w http.ResponseWriter, r *http.Request) {
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	
	var req cspRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.ValidUpdate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()
	oriCSP, err := s.Store.CSP(ctx).Get(ctx, cloudhub.CSPQuery{ID: &id})
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}
	
	if req.Region != "" {
		oriCSP.Region = req.Region

		// validate that the provider and region exists
		if existsCSPInOrg(ctx, s, oriCSP.Provider, oriCSP.Region) {
			invalidData(w, fmt.Errorf("Provider and Region does existed in organization"), s.Logger)
			return
		}
	}
	if req.Accesskey != "" {
		oriCSP.AccessKey = req.Accesskey
	}
	if req.Secretkey != "" {
		oriCSP.SecretKey = req.Secretkey
	}
	if req.Minion != "" {
		oriCSP.Minion = req.Minion
	}

	if err := s.Store.CSP(ctx).Update(ctx, oriCSP); err != nil {
		msg := fmt.Sprintf("Error updating CSP ID %s: %v", id, err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}

	// log registrationte
	msg := fmt.Sprintf(MsgCSPModified.String(), oriCSP.Provider)
	s.logRegistration(ctx, "CSP", msg)

	res := newCSPResponse(oriCSP)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// exists CSP and Region in organization
func existsCSPInOrg(ctx context.Context, s *Service, provider string, region string) bool {
	csps, err := s.Store.CSP(ctx).All(ctx)
	if err != nil {
		return true
	}

	for _, csp := range csps {	
		if csp.Provider == provider && csp.Region == region {
			return true
		}	
	}

	return false
}

// supported provider search
func supportedProvider(reqProvider string) bool {
	providers := getCSP()
	for _, provider := range providers {
		if provider == reqProvider {
			return true
		}
	}
	return false
}