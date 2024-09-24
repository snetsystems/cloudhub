package server

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/log"
	"github.com/snetsystems/cloudhub/backend/mocks"
)

func TestTopology(t *testing.T) {
	type fields struct {
		OrganizationsStore cloudhub.OrganizationsStore
		TopologiesStore    cloudhub.TopologiesStore
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
			name: "Get Topology",
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
				TopologiesStore: &mocks.TopologiesStore{
					GetF: func(ctx context.Context, q cloudhub.TopologyQuery) (*cloudhub.Topology, error) {
						return &cloudhub.Topology{
							ID:           "1",
							Organization: "225",
							Diagram:      "<xml></xml>",
							Preferences: []string{
								"type:inlet,active:1,min:15,max:30",
								"type:inside,active:0,min:38,max:55",
								"type:outlet,active:0,min:30,max:50",
							},
							TopologyOptions: cloudhub.TopologyOptions{
								MinimapVisible:    true,
								HostStatusVisible: false,
								IPMIVisible:       true,
								LinkVisible:       true,
							},
						}, nil
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					DefaultOrganizationF: func(context.Context) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "225",
							Name: "snet_org",
						}, nil
					},
				},
			},
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"id":"1","organization":"225","links":{"self":"/cloudhub/v1/topologies/1"},"diagram":"\u003cxml\u003e\u003c/xml\u003e","preferences":["type:inlet,active:1,min:15,max:30","type:inside,active:0,min:38,max:55","type:outlet,active:0,min:30,max:50"],"topologyOptions":{"minimapVisible":true,"hostStatusVisible":false,"ipmiVisible":true,"linkVisible":true}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					OrganizationsStore: tt.fields.OrganizationsStore,
					TopologiesStore:    tt.fields.TopologiesStore,
				},
				Logger: tt.fields.Logger,
			}

			s.Topology(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. Topology() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. Topology() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. Topology() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestUpdateTopology(t *testing.T) {
	type fields struct {
		TopologiesStore cloudhub.TopologiesStore
		Logger          cloudhub.Logger
	}
	type args struct {
		w    *httptest.ResponseRecorder
		r    *http.Request
		body string
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
			name: "Update Topology diagram",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				body: `{"cells":"<xml><root></root></xml>", "preferences":[
					"type:inlet,active:0,min:15,max:30",
					"type:inside,active:1,min:56,max:55",
					"type:outlet,active:0,min:34,max:50"
				], "topologyOptions": {
					"minimapVisible": true,
					"hostStatusVisible": false,
					"ipmiVisible": true,
					"linkVisible": true
				}}`,
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				TopologiesStore: &mocks.TopologiesStore{
					UpdateF: func(ctx context.Context, tp *cloudhub.Topology) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.TopologyQuery) (*cloudhub.Topology, error) {
						return &cloudhub.Topology{
							ID:           "1",
							Organization: "225",
							Diagram:      "<xml></xml>",
							Preferences: []string{
								"type:inlet,active:1,min:15,max:30",
								"type:inside,active:0,min:38,max:55",
								"type:outlet,active:0,min:30,max:50",
							},
							TopologyOptions: cloudhub.TopologyOptions{
								MinimapVisible:    true,
								HostStatusVisible: false,
								IPMIVisible:       true,
								LinkVisible:       true,
							},
						}, nil
					},
				},
			},
			id:              "1",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"id":"1","organization":"225","links":{"self":"/cloudhub/v1/topologies/1"},"preferences":["type:inlet,active:1,min:15,max:30","type:inside,active:0,min:38,max:55","type:outlet,active:0,min:30,max:50"],"topologyOptions":{"minimapVisible":true,"hostStatusVisible":false,"ipmiVisible":true,"linkVisible":true}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					TopologiesStore: tt.fields.TopologiesStore,
				},
				Logger: tt.fields.Logger,
			}

			tt.args.r = tt.args.r.WithContext(httprouter.WithParams(
				context.Background(),
				httprouter.Params{
					{
						Key:   "id",
						Value: tt.id,
					},
				}))

			tt.args.r.Body = ioutil.NopCloser(bytes.NewReader([]byte(tt.args.body)))
			tt.args.r.ContentLength = int64(len(tt.args.body))

			s.UpdateTopology(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. UpdateTopology() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. UpdateTopology() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. UpdateTopology() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestRemoveTopology(t *testing.T) {
	type fields struct {
		TopologiesStore cloudhub.TopologiesStore
		Logger          cloudhub.Logger
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
			name: "Remove Topology",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"DELETE",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				TopologiesStore: &mocks.TopologiesStore{
					DeleteF: func(ctx context.Context, tp *cloudhub.Topology) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.TopologyQuery) (*cloudhub.Topology, error) {
						switch *q.ID {
						case "1":
							return &cloudhub.Topology{
								ID:           "1",
								Organization: "225",
								Diagram:      "<xml></xml>",
							}, nil
						default:
							return &cloudhub.Topology{}, fmt.Errorf("Topology with ID %s not found", *q.ID)
						}
					},
				},
			},
			id:         "1",
			wantStatus: http.StatusNoContent,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					TopologiesStore: tt.fields.TopologiesStore,
				},
				Logger: tt.fields.Logger,
			}

			tt.args.r = tt.args.r.WithContext(httprouter.WithParams(
				context.Background(),
				httprouter.Params{
					{
						Key:   "id",
						Value: tt.id,
					},
				}))

			s.RemoveTopology(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. RemoveTopology() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
		})
	}
}

func TestNewTopology(t *testing.T) {
	type fields struct {
		OrganizationsStore cloudhub.OrganizationsStore
		TopologiesStore    cloudhub.TopologiesStore
		Logger             cloudhub.Logger
	}
	type args struct {
		w    *httptest.ResponseRecorder
		r    *http.Request
		body string
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
			name: "Create Topology",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				body: `{"cells":"<xml></xml>","preferences": [
					"type:inlet,active:0,min:15,max:30",
					"type:inside,active:1,min:56,max:55",
					"type:outlet,active:0,min:34,max:50"
				], "topologyOptions": {
					"minimapVisible": true,
					"hostStatusVisible": false,
					"ipmiVisible": true,
					"linkVisible": true
				}}`,
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				TopologiesStore: &mocks.TopologiesStore{
					AddF: func(context.Context, *cloudhub.Topology) (*cloudhub.Topology, error) {
						return &cloudhub.Topology{
							ID:           "1",
							Organization: "225",
							Diagram:      "<xml></xml>",
							Preferences: []string{
								"type:inlet,active:1,min:15,max:30",
								"type:inside,active:0,min:38,max:55",
								"type:outlet,active:0,min:30,max:50",
							},
							TopologyOptions: cloudhub.TopologyOptions{
								MinimapVisible:    true,
								HostStatusVisible: false,
								IPMIVisible:       true,
								LinkVisible:       true,
							},
						}, nil
					},
					GetF: func(ctx context.Context, q cloudhub.TopologyQuery) (*cloudhub.Topology, error) {
						return &cloudhub.Topology{}, fmt.Errorf("Topology with ID not found")
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					DefaultOrganizationF: func(context.Context) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "225",
							Name: "snet_org",
						}, nil
					},
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						switch *q.ID {
						case "225":
							return &cloudhub.Organization{
								ID:   "225",
								Name: "snet_org",
							}, nil
						case "987":
							return &cloudhub.Organization{
								ID:   "987",
								Name: "test",
							}, nil
						default:
							return &cloudhub.Organization{}, fmt.Errorf("Organization with ID %s not found", *q.ID)
						}
					},
				},
			},
			wantStatus:      http.StatusCreated,
			wantContentType: "application/json",
			wantBody:        `{"id":"1","links":{"self":"/cloudhub/v1/topologies/1"},"organization":"225","preferences":["type:inlet,active:1,min:15,max:30","type:inside,active:0,min:38,max:55","type:outlet,active:0,min:30,max:50"],"topologyOptions":{"minimapVisible":true,"hostStatusVisible":false,"ipmiVisible":true,"linkVisible":true}}`,
		},
		{
			name: "Fail to create topology - no body",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				body: "",
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				TopologiesStore: &mocks.TopologiesStore{
					AddF: func(context.Context, *cloudhub.Topology) (*cloudhub.Topology, error) {
						return &cloudhub.Topology{
							ID:           "1",
							Organization: "225",
							Diagram:      "<xml></xml>",
						}, nil
					},
					GetF: func(ctx context.Context, q cloudhub.TopologyQuery) (*cloudhub.Topology, error) {
						return &cloudhub.Topology{
							ID:           "2",
							Organization: "987",
							Diagram:      "<xml></xml>",
						}, nil
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					DefaultOrganizationF: func(context.Context) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "225",
							Name: "snet_org",
						}, nil
					},
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						switch *q.ID {
						case "225":
							return &cloudhub.Organization{
								ID:   "225",
								Name: "snet_org",
							}, nil
						case "987":
							return &cloudhub.Organization{
								ID:   "987",
								Name: "test",
							}, nil
						default:
							return &cloudhub.Organization{}, fmt.Errorf("Organization with ID %s not found", *q.ID)
						}
					},
				},
			},
			wantStatus:      http.StatusUnprocessableEntity,
			wantContentType: "application/json",
			wantBody:        `{"code":422,"message":"request body ContentLength of 0"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					OrganizationsStore: tt.fields.OrganizationsStore,
					TopologiesStore:    tt.fields.TopologiesStore,
				},
				Logger: tt.fields.Logger,
			}

			tt.args.r.Body = ioutil.NopCloser(bytes.NewReader([]byte(tt.args.body)))
			tt.args.r.ContentLength = int64(len(tt.args.body))

			s.NewTopology(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. NewTopology() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. NewTopology() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. NewTopology() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}
