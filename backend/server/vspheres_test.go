package server

import (
	"bytes"
	"context"
	"encoding/json"
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

func TestVsphereID(t *testing.T) {
	type fields struct {
		VspheresStore cloudhub.VspheresStore
		Logger        cloudhub.Logger
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
			name: "Get Single Vsphere",
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
				VspheresStore: &mocks.VspheresStore{
					GetF: func(ctx context.Context, id string) (cloudhub.Vsphere, error) {
						switch id {
						case "1337":
							return cloudhub.Vsphere{
								ID:           "1337",
								Host:         "1.1.1.1",
								UserName:     "snet",
								Password:     "duidud#$",
								Protocol:     "http",
								Port:         25,
								Interval:     10,
								Minion:       "minion01",
								Organization: "225",
							}, nil
						default:
							return cloudhub.Vsphere{}, fmt.Errorf("Vsphere with ID %s not found", id)
						}
					},
				},
			},
			id:              "1337",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"id":"1337","host":"1.1.1.1","links":{"self":"/cloudhub/v1/vspheres/1337"},"username":"snet","password":"duidud#$","protocol":"http","port":25,"interval":10,"minion":"minion01","organization":"225"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					VspheresStore: tt.fields.VspheresStore,
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

			s.VsphereID(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. VsphereID() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. VsphereID() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. VsphereID() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestVspheres(t *testing.T) {
	type fields struct {
		VspheresStore cloudhub.VspheresStore
		Logger        cloudhub.Logger
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
			name: "Get Vspheres",
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
				VspheresStore: &mocks.VspheresStore{
					AllF: func(ctx context.Context) ([]cloudhub.Vsphere, error) {
						return []cloudhub.Vsphere{
							{
								ID:           "1337",
								Host:         "1.1.1.1",
								UserName:     "snet",
								Password:     "duidud#$",
								Protocol:     "http",
								Port:         25,
								Interval:     10,
								Minion:       "minion01",
								Organization: "225",
							},
							{
								ID:           "100",
								Host:         "2.2.2.2",
								UserName:     "snet2",
								Password:     "2827%$djd",
								Protocol:     "http",
								Port:         2542,
								Interval:     10,
								Minion:       "minion02",
								Organization: "114",
							},
						}, nil
					},
				},
			},
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"links":{"self":"/cloudhub/v1/vspheres"},"vspheres":[{"id":"1337","host":"1.1.1.1","username":"snet","password":"duidud#$","protocol":"http","port":25,"interval":10,"organization":"225","minion":"minion01","links":{"self":"/cloudhub/v1/vspheres/1337"}},{"id":"100","host":"2.2.2.2","username":"snet2","password":"2827%$djd","protocol":"http","port":2542,"interval":10,"organization":"114","minion":"minion02","links":{"self":"/cloudhub/v1/vspheres/100"}}]}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					VspheresStore: tt.fields.VspheresStore,
				},
				Logger: tt.fields.Logger,
			}

			s.Vspheres(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. Vspheres() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. Vspheres() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. Vspheres() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestUpdateVsphere(t *testing.T) {
	type fields struct {
		VspheresStore      cloudhub.VspheresStore
		OrganizationsStore cloudhub.OrganizationsStore
		Logger             cloudhub.Logger
	}
	type args struct {
		w      *httptest.ResponseRecorder
		r      *http.Request
		vs     *vsphereRequest
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
			name: "Update Vsphere host",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				vs: &vsphereRequest{
					Host: "2.2.2.2",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				VspheresStore: &mocks.VspheresStore{
					UpdateF: func(ctx context.Context, vs cloudhub.Vsphere) error {
						return nil
					},
					GetF: func(ctx context.Context, id string) (cloudhub.Vsphere, error) {
						return cloudhub.Vsphere{
							ID:           "1337",
							Host:         "1.1.1.1",
							UserName:     "snet",
							Password:     "duidud#$",
							Protocol:     "http",
							Port:         25,
							Interval:     10,
							Minion:       "minion01",
							Organization: "225",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.Vsphere, error) {
						return []cloudhub.Vsphere{
							{
								ID:           "1337",
								Host:         "1.1.1.1",
								UserName:     "snet",
								Password:     "duidud#$",
								Protocol:     "http",
								Port:         25,
								Interval:     10,
								Minion:       "minion01",
								Organization: "114",
							},
							{
								ID:           "100",
								Host:         "2.2.2.2",
								UserName:     "snet2",
								Password:     "2827%$djd",
								Protocol:     "http",
								Port:         2542,
								Interval:     10,
								Minion:       "minion02",
								Organization: "114",
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
			id:              "1337",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"id":"1337","host":"2.2.2.2","links":{"self":"/cloudhub/v1/vspheres/1337"},"username":"snet","password":"duidud#$","protocol":"http","port":25,"interval":10,"minion":"minion01","organization":"225"}`,
		},
		{
			name: "Update Vsphere - nothing to update",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				vs: &vsphereRequest{},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				VspheresStore: &mocks.VspheresStore{
					UpdateF: func(ctx context.Context, vs cloudhub.Vsphere) error {
						return nil
					},
					GetF: func(ctx context.Context, id string) (cloudhub.Vsphere, error) {
						return cloudhub.Vsphere{
							ID:           "1337",
							Host:         "1.1.1.1",
							UserName:     "snet",
							Password:     "duidud#$",
							Protocol:     "http",
							Port:         25,
							Interval:     10,
							Minion:       "minion01",
							Organization: "225",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.Vsphere, error) {
						return []cloudhub.Vsphere{
							{
								ID:           "1337",
								Host:         "1.1.1.1",
								UserName:     "snet",
								Password:     "duidud#$",
								Protocol:     "http",
								Port:         25,
								Interval:     10,
								Minion:       "minion01",
								Organization: "114",
							},
							{
								ID:           "100",
								Host:         "2.2.2.2",
								UserName:     "snet2",
								Password:     "2827%$djd",
								Protocol:     "http",
								Port:         2542,
								Interval:     10,
								Minion:       "minion02",
								Organization: "114",
							},
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
			name: "Update Vsphere password",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				vs: &vsphereRequest{
					Password: "83447^%%$",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				VspheresStore: &mocks.VspheresStore{
					UpdateF: func(ctx context.Context, vs cloudhub.Vsphere) error {
						return nil
					},
					GetF: func(ctx context.Context, id string) (cloudhub.Vsphere, error) {
						return cloudhub.Vsphere{
							ID:           "1337",
							Host:         "1.1.1.1",
							UserName:     "snet",
							Password:     "duidud#$",
							Protocol:     "http",
							Port:         25,
							Interval:     10,
							Minion:       "minion01",
							Organization: "225",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.Vsphere, error) {
						return []cloudhub.Vsphere{
							{
								ID:           "1337",
								Host:         "1.1.1.1",
								UserName:     "snet",
								Password:     "duidud#$",
								Protocol:     "http",
								Port:         25,
								Interval:     10,
								Minion:       "minion01",
								Organization: "114",
							},
							{
								ID:           "100",
								Host:         "2.2.2.2",
								UserName:     "snet2",
								Password:     "2827%$djd",
								Protocol:     "http",
								Port:         2542,
								Interval:     10,
								Minion:       "minion02",
								Organization: "114",
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
			id:              "1337",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"id":"1337","host":"1.1.1.1","links":{"self":"/cloudhub/v1/vspheres/1337"},"username":"snet","password":"83447^%%$","protocol":"http","port":25,"interval":10,"minion":"minion01","organization":"225"}`,
		},
		{
			name: "Update Vsphere - invalid update",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				vs: &vsphereRequest{},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				VspheresStore: &mocks.VspheresStore{
					UpdateF: func(ctx context.Context, vs cloudhub.Vsphere) error {
						return nil
					},
					GetF: func(ctx context.Context, id string) (cloudhub.Vsphere, error) {
						return cloudhub.Vsphere{}, nil
					},
				},
			},
			id:              "1337",
			wantStatus:      http.StatusUnprocessableEntity,
			wantContentType: "application/json",
			wantBody:        `{"code":422,"message":"No fields to update"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					VspheresStore:      tt.fields.VspheresStore,
					OrganizationsStore: tt.fields.OrganizationsStore,
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

			buf, _ := json.Marshal(tt.args.vs)
			tt.args.r.Body = ioutil.NopCloser(bytes.NewReader(buf))

			s.UpdateVsphere(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. UpdateVsphere() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. UpdateVsphere() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. UpdateVsphere() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestRemoveVsphere(t *testing.T) {
	type fields struct {
		VspheresStore cloudhub.VspheresStore
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
			name: "Remove Vsphere",
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
				VspheresStore: &mocks.VspheresStore{
					DeleteF: func(ctx context.Context, vs cloudhub.Vsphere) error {
						return nil
					},
					GetF: func(ctx context.Context, id string) (cloudhub.Vsphere, error) {
						switch id {
						case "1337":
							return cloudhub.Vsphere{
								ID:   "1337",
								Host: "1.1.1.1",
							}, nil
						default:
							return cloudhub.Vsphere{}, fmt.Errorf("Vsphere with ID %s not found", id)
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
					VspheresStore: tt.fields.VspheresStore,
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

			s.RemoveVsphere(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. RemoveVsphere() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
		})
	}
}

func TestNewVsphere(t *testing.T) {
	type fields struct {
		OrganizationsStore cloudhub.OrganizationsStore
		VspheresStore      cloudhub.VspheresStore
		Logger             cloudhub.Logger
	}
	type args struct {
		w    *httptest.ResponseRecorder
		r    *http.Request
		vs   *vsphereRequest
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
			name: "Create Vsphere",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				vs: &vsphereRequest{
					Host:         "1.1.1.1",
					UserName:     "snet",
					Password:     "duidud#$",
					Protocol:     "http",
					Port:         25,
					Interval:     10,
					Minion:       "minion01",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				VspheresStore: &mocks.VspheresStore{
					AddF: func(ctx context.Context, vs cloudhub.Vsphere) (cloudhub.Vsphere, error) {
						return cloudhub.Vsphere{
							ID:           "1337",
							Host:         "1.1.1.1",
							UserName:     "snet",
							Password:     "duidud#$",
							Protocol:     "http",
							Port:         25,
							Interval:     10,
							Minion:       "minion01",
							Organization: "225",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.Vsphere, error) {
						return []cloudhub.Vsphere{
							{
								ID:           "1337",
								Host:         "1.1.1.1",
								UserName:     "snet",
								Password:     "duidud#$",
								Protocol:     "http",
								Port:         25,
								Interval:     10,
								Minion:       "minion01",
								Organization: "114",
							},
							{
								ID:           "100",
								Host:         "2.2.2.2",
								UserName:     "snet2",
								Password:     "2827%$djd",
								Protocol:     "http",
								Port:         2542,
								Interval:     10,
								Minion:       "minion02",
								Organization: "114",
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
			wantStatus:      http.StatusCreated,
			wantContentType: "application/json",
			wantBody:        `{"id":"1337","host":"1.1.1.1","links":{"self":"/cloudhub/v1/vspheres/1337"},"username":"snet","password":"duidud#$","protocol":"http","port":25,"interval":10,"minion":"minion01","organization":"225"}`,
		},
		{
			name: "Fail to create Vsphere - no host",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				vs: &vsphereRequest{},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				VspheresStore: &mocks.VspheresStore{
					AddF: func(ctx context.Context, vs cloudhub.Vsphere) (cloudhub.Vsphere, error) {
						return cloudhub.Vsphere{
							ID:           "1337",
							Host:         "1.1.1.1",
							UserName:     "snet",
							Password:     "duidud#$",
							Protocol:     "http",
							Port:         25,
							Interval:     10,
							Minion:       "minion01",
							Organization: "225",
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
			wantStatus:      http.StatusUnprocessableEntity,
			wantContentType: "application/json",
			wantBody:        `{"code":422,"message":"Host required vsphere request body"}`,
		},
		{
			name: "Create Vsphere - no password",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				vs: &vsphereRequest{
					Host:         "1.1.1.1",
					UserName:     "snet",
					Protocol:     "http",
					Port:         25,
					Interval:     10,
					Minion:       "minion01",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				VspheresStore: &mocks.VspheresStore{
					AddF: func(ctx context.Context, vs cloudhub.Vsphere) (cloudhub.Vsphere, error) {
						return cloudhub.Vsphere{
							ID:           "1337",
							Host:         "1.1.1.1",
							UserName:     "snet",
							Password:     "duidud#$",
							Protocol:     "http",
							Port:         25,
							Interval:     10,
							Minion:       "minion01",
							Organization: "225",
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
			wantStatus:      http.StatusUnprocessableEntity,
			wantContentType: "application/json",
			wantBody:        `{"code":422,"message":"Password required vsphere request body"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					OrganizationsStore:    tt.fields.OrganizationsStore,
					VspheresStore:         tt.fields.VspheresStore,
				},
				Logger: tt.fields.Logger,
			}

			buf, _ := json.Marshal(tt.args.vs)
			tt.args.r.Body = ioutil.NopCloser(bytes.NewReader(buf))
			s.NewVsphere(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. NewVsphere() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. NewVsphere() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. NewVsphere() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}
