package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/log"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/roles"
)

func TestService_OrganizationID(t *testing.T) {
	type fields struct {
		OrganizationsStore cloudhub.OrganizationsStore
		Logger             cloudhub.Logger
	}
	type args struct {
		w *httptest.ResponseRecorder
		r *http.Request
	}
	tests := []struct {
		name            string
		fields          fields
		args            args
		id              string
		wantStatus      int
		wantContentType string
		wantBody        string
	}{
		{
			name: "Get Single Organization",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				OrganizationsStore: &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						switch *q.ID {
						case "1337":
							return &cloudhub.Organization{
								ID:   "1337",
								Name: "The Good Place",
							}, nil
						default:
							return nil, fmt.Errorf("Organization with ID %s not found", *q.ID)
						}
					},
				},
			},
			id:              "1337",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"links":{"self":"/cloudhub/v1/organizations/1337"},"id":"1337","name":"The Good Place"}`,
		},
		{
			name: "Get Single Organization",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				OrganizationsStore: &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						switch *q.ID {
						case "1337":
							return &cloudhub.Organization{
								ID:   "1337",
								Name: "The Good Place",
							}, nil
						default:
							return nil, fmt.Errorf("Organization with ID %s not found", *q.ID)
						}
					},
				},
			},
			id:              "1337",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"id":"1337","name":"The Good Place","links":{"self":"/cloudhub/v1/organizations/1337"}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					OrganizationsStore: tt.fields.OrganizationsStore,
				},
				Logger: tt.fields.Logger,
			}

			tt.args.r = tt.args.r.WithContext(httprouter.WithParams(
				context.Background(),
				httprouter.Params{
					{
						Key:   "oid",
						Value: tt.id,
					},
				}))

			s.OrganizationID(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. OrganizationID() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. OrganizationID() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. OrganizationID() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestService_Organizations(t *testing.T) {
	type fields struct {
		OrganizationsStore cloudhub.OrganizationsStore
		Logger             cloudhub.Logger
	}
	type args struct {
		w *httptest.ResponseRecorder
		r *http.Request
	}
	tests := []struct {
		name            string
		fields          fields
		args            args
		wantStatus      int
		wantContentType string
		wantBody        string
	}{
		{
			name: "Get Organizations",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				OrganizationsStore: &mocks.OrganizationsStore{
					AllF: func(ctx context.Context) ([]cloudhub.Organization, error) {
						return []cloudhub.Organization{
							{
								ID:   "1337",
								Name: "The Good Place",
							},
							{
								ID:   "100",
								Name: "The Bad Place",
							},
						}, nil
					},
				},
			},
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"links":{"self":"/cloudhub/v1/organizations"},"organizations":[{"links":{"self":"/cloudhub/v1/organizations/1337"},"id":"1337","name":"The Good Place"},{"links":{"self":"/cloudhub/v1/organizations/100"},"id":"100","name":"The Bad Place"}]}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					OrganizationsStore: tt.fields.OrganizationsStore,
				},
				Logger: tt.fields.Logger,
			}

			s.Organizations(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. Organizations() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. Organizations() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. Organizations() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestService_UpdateOrganization(t *testing.T) {
	type fields struct {
		OrganizationsStore cloudhub.OrganizationsStore
		Logger             cloudhub.Logger
	}
	type args struct {
		w      *httptest.ResponseRecorder
		r      *http.Request
		org    *organizationRequest
		setPtr bool
	}
	tests := []struct {
		name            string
		fields          fields
		args            args
		id              string
		wantStatus      int
		wantContentType string
		wantBody        string
	}{
		{
			name: "Update Organization name",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				org: &organizationRequest{
					Name: "The Bad Place",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				OrganizationsStore: &mocks.OrganizationsStore{
					UpdateF: func(ctx context.Context, o *cloudhub.Organization) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:          "1337",
							Name:        "The Good Place",
							DefaultRole: roles.ViewerRoleName,
						}, nil
					},
				},
			},
			id:              "1337",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"id":"1337","name":"The Bad Place","defaultRole":"viewer","links":{"self":"/cloudhub/v1/organizations/1337"}}`,
		},
		{
			name: "Update Organization - nothing to update",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				org: &organizationRequest{},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				OrganizationsStore: &mocks.OrganizationsStore{
					UpdateF: func(ctx context.Context, o *cloudhub.Organization) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:          "1337",
							Name:        "The Good Place",
							DefaultRole: roles.ViewerRoleName,
						}, nil
					},
				},
			},
			id:              "1337",
			wantStatus:      http.StatusUnprocessableEntity,
			wantContentType: "application/json",
			wantBody:        `{"code":422,"message":"No fields to update"}`,
		},
		{
			name: "Update Organization default role",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				org: &organizationRequest{
					DefaultRole: roles.ViewerRoleName,
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				OrganizationsStore: &mocks.OrganizationsStore{
					UpdateF: func(ctx context.Context, o *cloudhub.Organization) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:          "1337",
							Name:        "The Good Place",
							DefaultRole: roles.MemberRoleName,
						}, nil
					},
				},
			},
			id:              "1337",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"links":{"self":"/cloudhub/v1/organizations/1337"},"id":"1337","name":"The Good Place","defaultRole":"viewer"}`,
		},
		{
			name: "Update Organization - invalid update",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				org: &organizationRequest{},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				OrganizationsStore: &mocks.OrganizationsStore{
					UpdateF: func(ctx context.Context, o *cloudhub.Organization) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						return nil, nil
					},
				},
			},
			id:              "1337",
			wantStatus:      http.StatusUnprocessableEntity,
			wantContentType: "application/json",
			wantBody:        `{"code":422,"message":"No fields to update"}`,
		},
		{
			name: "Update Organization - invalid role",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				org: &organizationRequest{
					DefaultRole: "sillyrole",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				OrganizationsStore: &mocks.OrganizationsStore{
					UpdateF: func(ctx context.Context, o *cloudhub.Organization) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						return nil, nil
					},
				},
			},
			id:              "1337",
			wantStatus:      http.StatusUnprocessableEntity,
			wantContentType: "application/json",
			wantBody:        `{"code":422,"message":"default role must be member, viewer, editor, or admin"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					OrganizationsStore: tt.fields.OrganizationsStore,
				},
				Logger: tt.fields.Logger,
			}

			tt.args.r = tt.args.r.WithContext(httprouter.WithParams(context.Background(),
				httprouter.Params{
					{
						Key:   "oid",
						Value: tt.id,
					},
				}))

			buf, _ := json.Marshal(tt.args.org)
			tt.args.r.Body = ioutil.NopCloser(bytes.NewReader(buf))
			s.UpdateOrganization(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. NewOrganization() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. NewOrganization() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. NewOrganization() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestService_RemoveOrganization(t *testing.T) {
	type fields struct {
		OrganizationsStore cloudhub.OrganizationsStore
		Logger             cloudhub.Logger
	}
	type args struct {
		w *httptest.ResponseRecorder
		r *http.Request
	}
	tests := []struct {
		name       string
		fields     fields
		args       args
		id         string
		wantStatus int
	}{
		{
			name: "Update Organization name",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				OrganizationsStore: &mocks.OrganizationsStore{
					DeleteF: func(ctx context.Context, o *cloudhub.Organization) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						switch *q.ID {
						case "1337":
							return &cloudhub.Organization{
								ID:   "1337",
								Name: "The Good Place",
							}, nil
						default:
							return nil, fmt.Errorf("Organization with ID %s not found", *q.ID)
						}
					},
				},
			},
			id:         "1337",
			wantStatus: http.StatusNoContent,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					OrganizationsStore: tt.fields.OrganizationsStore,
					NetworkDeviceStore: &mocks.NetworkDeviceStore{
						AllF: func(ctx context.Context) ([]cloudhub.NetworkDevice, error) {
							return nil, nil
						},
					},
					DeviceMappingsStore: &mocks.DeviceMappingsStore{
						AllDevicesFunc: func(ctx context.Context, access cloudhub.AccessContext) ([]*cloudhub.DeviceMeta, error) {
							return nil, nil
						},
					},
				},
				Logger: tt.fields.Logger,
			}

			tt.args.r = tt.args.r.WithContext(httprouter.WithParams(context.Background(),
				httprouter.Params{
					{
						Key:   "oid",
						Value: tt.id,
					},
				}))
			s.RemoveOrganization(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. NewOrganization() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
		})
	}
}

func TestRemoveOrganizationCleansAlertResourcesBeforeDeletingOrg(t *testing.T) {
	var taskDeletes []string
	taskServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Fatalf("method = %s, want DELETE", r.Method)
		}
		taskDeletes = append(taskDeletes, r.URL.Path)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer taskServer.Close()

	var sequence []string
	svc := &Service{
		Store: &mocks.Store{
			OrganizationsStore: &mocks.OrganizationsStore{
				GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
					return &cloudhub.Organization{ID: "org-1", Name: "Acme"}, nil
				},
				DeleteF: func(ctx context.Context, o *cloudhub.Organization) error {
					sequence = append(sequence, "org:"+o.ID)
					return nil
				},
			},
			NetworkDeviceStore: &mocks.NetworkDeviceStore{
				AllF: func(ctx context.Context) ([]cloudhub.NetworkDevice, error) {
					return nil, nil
				},
			},
			DeviceMappingsStore: &mocks.DeviceMappingsStore{
				AllDevicesFunc: func(ctx context.Context, access cloudhub.AccessContext) ([]*cloudhub.DeviceMeta, error) {
					return nil, nil
				},
			},
		},
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(ctx context.Context, id string) (cloudhub.AlertKapacitor, error) {
				return cloudhub.AlertKapacitor{ID: id, OrgID: "org-1", URL: taskServer.URL}, nil
			},
			allFunc: func(ctx context.Context, orgID string) ([]cloudhub.AlertKapacitor, error) {
				return []cloudhub.AlertKapacitor{{ID: "kap-1", OrgID: orgID}}, nil
			},
			deleteFunc: func(ctx context.Context, id string) error {
				sequence = append(sequence, "kapacitor:"+id)
				return nil
			},
		},
		AlertGroupRules: &fakeAlertGroupRuleStore{
			allFunc: func(ctx context.Context, orgID string) ([]cloudhub.AlertGroupRule, error) {
				return []cloudhub.AlertGroupRule{{ID: "rule-1", OrgID: orgID, KapacitorID: "kap-1"}}, nil
			},
			deleteFunc: func(ctx context.Context, id string) error {
				sequence = append(sequence, "rule:"+id)
				return nil
			},
		},
		RecipientGroups: &fakeRecipientGroupStore{
			allFunc: func(ctx context.Context, orgID string) ([]cloudhub.RecipientGroup, error) {
				return []cloudhub.RecipientGroup{{ID: "group-1", OrgID: orgID}}, nil
			},
			deleteFunc: func(ctx context.Context, id string) error {
				sequence = append(sequence, "group:"+id)
				return nil
			},
		},
		Logger: log.New(log.DebugLevel),
	}

	req := httptest.NewRequest(http.MethodDelete, "/cloudhub/v1/organizations/org-1", nil)
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{{Key: "oid", Value: "org-1"}}))
	rr := httptest.NewRecorder()

	svc.RemoveOrganization(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusNoContent, rr.Body.String())
	}
	if len(taskDeletes) != 1 || taskDeletes[0] != "/kapacitor/v1/tasks/alert-group-rule-1" {
		t.Fatalf("taskDeletes = %v, want alert-group-rule-1 delete", taskDeletes)
	}
	wantSequence := []string{"rule:rule-1", "kapacitor:kap-1", "group:group-1", "org:org-1"}
	if !reflect.DeepEqual(sequence, wantSequence) {
		t.Fatalf("sequence = %v, want %v", sequence, wantSequence)
	}
}

func TestRemoveOrganizationStopsWhenAlertTaskDeleteFails(t *testing.T) {
	taskServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "kapacitor unavailable", http.StatusInternalServerError)
	}))
	defer taskServer.Close()

	orgDeleted := false
	ruleDeleted := false
	svc := &Service{
		Store: &mocks.Store{
			OrganizationsStore: &mocks.OrganizationsStore{
				GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
					return &cloudhub.Organization{ID: "org-1", Name: "Acme"}, nil
				},
				DeleteF: func(ctx context.Context, o *cloudhub.Organization) error {
					orgDeleted = true
					return nil
				},
			},
			NetworkDeviceStore: &mocks.NetworkDeviceStore{
				AllF: func(ctx context.Context) ([]cloudhub.NetworkDevice, error) {
					return nil, nil
				},
			},
			DeviceMappingsStore: &mocks.DeviceMappingsStore{
				AllDevicesFunc: func(ctx context.Context, access cloudhub.AccessContext) ([]*cloudhub.DeviceMeta, error) {
					return nil, nil
				},
			},
		},
		AlertKapacitors: &fakeAlertKapacitorStore{
			getFunc: func(ctx context.Context, id string) (cloudhub.AlertKapacitor, error) {
				return cloudhub.AlertKapacitor{ID: id, OrgID: "org-1", URL: taskServer.URL}, nil
			},
		},
		AlertGroupRules: &fakeAlertGroupRuleStore{
			allFunc: func(ctx context.Context, orgID string) ([]cloudhub.AlertGroupRule, error) {
				return []cloudhub.AlertGroupRule{{ID: "rule-1", OrgID: orgID, KapacitorID: "kap-1"}}, nil
			},
			deleteFunc: func(ctx context.Context, id string) error {
				ruleDeleted = true
				return nil
			},
		},
		Logger: log.New(log.DebugLevel),
	}

	req := httptest.NewRequest(http.MethodDelete, "/cloudhub/v1/organizations/org-1", nil)
	req = req.WithContext(httprouter.WithParams(req.Context(), httprouter.Params{{Key: "oid", Value: "org-1"}}))
	rr := httptest.NewRecorder()

	svc.RemoveOrganization(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d; body=%s", rr.Code, http.StatusInternalServerError, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), "failed to delete alert task before deleting organization") {
		t.Fatalf("body = %s, want alert task cleanup message", rr.Body.String())
	}
	if orgDeleted || ruleDeleted {
		t.Fatalf("orgDeleted=%v ruleDeleted=%v, want both false", orgDeleted, ruleDeleted)
	}
}

func TestService_NewOrganization(t *testing.T) {
	type fields struct {
		OrganizationsStore cloudhub.OrganizationsStore
		UsersStore         cloudhub.UsersStore
		Logger             cloudhub.Logger
	}
	type args struct {
		w    *httptest.ResponseRecorder
		r    *http.Request
		org  *organizationRequest
		user *cloudhub.User
	}
	tests := []struct {
		name            string
		fields          fields
		args            args
		id              string
		wantStatus      int
		wantContentType string
		wantBody        string
	}{
		{
			name: "Create Organization",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				user: &cloudhub.User{
					ID:       1,
					Name:     "bobetta",
					Provider: "github",
					Scheme:   "oauth2",
				},
				org: &organizationRequest{
					Name: "The Good Place",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, u *cloudhub.User) (*cloudhub.User, error) {
						return &cloudhub.User{
							ID:       1,
							Name:     "bobetta",
							Provider: "github",
							Scheme:   "oauth2",
						}, nil
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					AddF: func(ctx context.Context, o *cloudhub.Organization) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "1337",
							Name: "The Good Place",
						}, nil
					},
				},
			},
			wantStatus:      http.StatusCreated,
			wantContentType: "application/json",
			wantBody:        `{"id":"1337","name":"The Good Place","links":{"self":"/cloudhub/v1/organizations/1337"}}`,
		},
		{
			name: "Fail to create Organization - no org name",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				user: &cloudhub.User{
					ID:       1,
					Name:     "bobetta",
					Provider: "github",
					Scheme:   "oauth2",
				},
				org: &organizationRequest{},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, u *cloudhub.User) (*cloudhub.User, error) {
						return &cloudhub.User{
							ID:       1,
							Name:     "bobetta",
							Provider: "github",
							Scheme:   "oauth2",
						}, nil
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					AddF: func(ctx context.Context, o *cloudhub.Organization) (*cloudhub.Organization, error) {
						return nil, nil
					},
				},
			},
			wantStatus:      http.StatusUnprocessableEntity,
			wantContentType: "application/json",
			wantBody:        `{"code":422,"message":"Name required on CloudHub Organization request body"}`,
		},
		{
			name: "Create Organization - no user on context",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				org: &organizationRequest{
					Name: "The Good Place",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, u *cloudhub.User) (*cloudhub.User, error) {
						return &cloudhub.User{
							ID:       1,
							Name:     "bobetta",
							Provider: "github",
							Scheme:   "oauth2",
						}, nil
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					AddF: func(ctx context.Context, o *cloudhub.Organization) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "1337",
							Name: "The Good Place",
						}, nil
					},
					DeleteF: func(ctx context.Context, o *cloudhub.Organization) error {
						return nil
					},
				},
			},
			wantStatus:      http.StatusInternalServerError,
			wantContentType: "application/json",
			wantBody:        `{"code":500,"message":"failed to retrieve user from context"}`,
		},
		{
			name: "Create Organization - failed to add user to organization",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				org: &organizationRequest{
					Name: "The Good Place",
				},
				user: &cloudhub.User{
					ID:       1,
					Name:     "bobetta",
					Provider: "github",
					Scheme:   "oauth2",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, u *cloudhub.User) (*cloudhub.User, error) {
						return nil, fmt.Errorf("failed to add user to org")
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					AddF: func(ctx context.Context, o *cloudhub.Organization) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "1337",
							Name: "The Good Place",
						}, nil
					},
					DeleteF: func(ctx context.Context, o *cloudhub.Organization) error {
						return nil
					},
				},
			},
			wantStatus:      http.StatusInternalServerError,
			wantContentType: "application/json",
			wantBody:        `{"code":500,"message":"failed to add user to organization"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					SourcesStore: &mocks.SourcesStore{
						GetF: func(ctx context.Context, id int) (cloudhub.Source, error) {
							return cloudhub.Source{}, fmt.Errorf("not configured")
						},
					},
					OrganizationsStore: tt.fields.OrganizationsStore,
					UsersStore:         tt.fields.UsersStore,
					DashboardsStore: &mocks.DashboardsStore{
						AllF: func(ctx context.Context) ([]cloudhub.Dashboard, error) {
							return nil, nil
						},
						AddF: func(ctx context.Context, dashboard cloudhub.Dashboard) (cloudhub.Dashboard, error) {
							return dashboard, nil
						},
					},
					FixedCellMapping: &mocks.FixedCellMappingStore{},
				},
				Logger: tt.fields.Logger,
			}

			ctx := tt.args.r.Context()
			ctx = context.WithValue(ctx, UserContextKey, tt.args.user)
			tt.args.r = tt.args.r.WithContext(ctx)

			buf, _ := json.Marshal(tt.args.org)
			tt.args.r.Body = ioutil.NopCloser(bytes.NewReader(buf))
			s.NewOrganization(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. NewOrganization() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. NewOrganization() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. NewOrganization() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestNewOrganizationCreatesDefaultRecipientGroup(t *testing.T) {
	ctxUser := &cloudhub.User{
		ID:       1,
		Name:     "bobetta",
		Provider: "github",
		Scheme:   "oauth2",
		Email:    "bobetta@example.com",
	}
	rgStore := &memRecipientGroupStore{members: map[string][]cloudhub.RecipientGroupMember{}}
	prefsStore := &memAlertRecipientMemberPrefsStore{prefs: map[string]cloudhub.AlertRecipientMemberPrefs{}}
	svc := &Service{
		Store: &mocks.Store{
			SourcesStore: &mocks.SourcesStore{
				GetF: func(ctx context.Context, ID int) (cloudhub.Source, error) {
					return cloudhub.Source{}, fmt.Errorf("not configured")
				},
			},
			OrganizationsStore: &mocks.OrganizationsStore{
				AddF: func(ctx context.Context, o *cloudhub.Organization) (*cloudhub.Organization, error) {
					return &cloudhub.Organization{
						ID:          "org-1",
						Name:        o.Name,
						DefaultRole: o.DefaultRole,
					}, nil
				},
				GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
					return &cloudhub.Organization{ID: "org-1", Name: "The Good Place"}, nil
				},
				DeleteF: func(ctx context.Context, o *cloudhub.Organization) error {
					return nil
				},
			},
			UsersStore: &mocks.UsersStore{
				AddF: func(ctx context.Context, u *cloudhub.User) (*cloudhub.User, error) {
					return u, nil
				},
				AllF: func(ctx context.Context) ([]cloudhub.User, error) {
					return []cloudhub.User{
						{
							ID:    ctxUser.ID,
							Name:  ctxUser.Name,
							Email: ctxUser.Email,
							Roles: []cloudhub.Role{{Organization: "org-1", Name: roles.AdminRoleName}},
						},
					}, nil
				},
			},
			DashboardsStore: &mocks.DashboardsStore{
				AllF: func(ctx context.Context) ([]cloudhub.Dashboard, error) {
					return nil, nil
				},
				AddF: func(ctx context.Context, d cloudhub.Dashboard) (cloudhub.Dashboard, error) {
					d.ID = 1
					return d, nil
				},
			},
			FixedCellMapping: &mocks.FixedCellMappingStore{},
		},
		RecipientGroups:           rgStore,
		AlertRecipientGroups:      &memAlertRecipientGroupStore{ext: map[string]cloudhub.AlertRecipientGroup{}},
		AlertRecipientMemberPrefs: prefsStore,
		Logger:                    log.New(log.DebugLevel),
	}

	req := httptest.NewRequest(http.MethodPost, "/cloudhub/v1/organizations", bytes.NewBufferString(`{"name":"The Good Place"}`))
	req = req.WithContext(context.WithValue(req.Context(), UserContextKey, ctxUser))
	rr := httptest.NewRecorder()

	svc.NewOrganization(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("NewOrganization status = %d body=%s", rr.Code, rr.Body.String())
	}
	groups, err := rgStore.All(serverContext(context.Background()), "org-1")
	if err != nil {
		t.Fatalf("recipient groups: %v", err)
	}
	if len(groups) != 1 || !groups[0].IsDefault || groups[0].Name != "The Good Place" {
		t.Fatalf("expected one default recipient group, got %+v", groups)
	}
	if len(groups[0].Members) != 1 || groups[0].Members[0].UserID != "1" {
		t.Fatalf("expected creator in default group, got %+v", groups[0].Members)
	}
	if len(prefsStore.prefs) != 1 {
		t.Fatalf("expected default member prefs, got %+v", prefsStore.prefs)
	}
}

func TestService_OrganizationExists(t *testing.T) {
	type fields struct {
		OrganizationsStore cloudhub.OrganizationsStore
		Logger             cloudhub.Logger
	}
	type args struct {
		ctx     context.Context
		orgName string
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		wantErr bool
	}{
		{
			name: "Organization exists",
			fields: fields{
				OrganizationsStore: &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "1337",
							Name: "The Good Place",
						}, nil
					},
				},
				Logger: log.New(log.DebugLevel),
			},
			args: args{
				ctx:     context.Background(),
				orgName: "1337",
			},
			wantErr: false,
		},
		{
			name: "Organization does not exist",
			fields: fields{
				OrganizationsStore: &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						return nil, fmt.Errorf("Organization with ID %s not found", *q.ID)
					},
				},
				Logger: log.New(log.DebugLevel),
			},
			args: args{
				ctx:     context.Background(),
				orgName: "9999",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					OrganizationsStore: tt.fields.OrganizationsStore,
				},
				Logger: tt.fields.Logger,
			}
			err := s.OrganizationExists(tt.args.ctx, tt.args.orgName)
			if (err != nil) != tt.wantErr {
				t.Errorf("%q. OrganizationExists() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			}
		})
	}
}
