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

// For testing these functions, enter the following variables correctly.
const (
	saltTestToken         = "<token>"
	saltTestURL           = "http://<salt-api-url>/run"
	saltTestEnvPath       = "<salt env path>"
	saltTestAccessKey     = "<accesskey or user id>"
	saltTestSecretKey     = "<secretkey or password>"
	saltTestNameSpace     = "<project name or region name>"
	saltTestAuthURL       = "http://<osp-auth-url>" // Except subpath.
	saltTestProjectDomain = "<project domain id>"
	saltTestUserDomain    = "<user domain id>"
	saltTestInfluxDBURL1  = "http://<primary influxdb-url>"
	saltTestInfluxDBURL2  = "http://<secondary influxdb-url>"
)

func TestCSPID(t *testing.T) {
	type fields struct {
		CSPStore cloudhub.CSPStore
		Logger   cloudhub.Logger
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
			name: "Get Single CSP",
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
				CSPStore: &mocks.CSPStore{
					GetF: func(ctx context.Context, q cloudhub.CSPQuery) (*cloudhub.CSP, error) {
						return &cloudhub.CSP{
							ID:           "547",
							Provider:     cloudhub.OSP,
							NameSpace:    "osp_pj_demo01",
							AccessKey:    "",
							SecretKey:    "",
							Organization: "76",
							Minion:       "",
						}, nil
					},
				},
			},
			id:              "547",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"id":"547","provider":"osp","namespace":"osp_pj_demo01","accesskey":"","secretkey":"","organization":"76","minion":"","links":{"self":"/cloudhub/v1/csp/547"}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					CSPStore: tt.fields.CSPStore,
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

			s.CSPID(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. CSPID() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. CSPID() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. CSPID() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestCSP(t *testing.T) {
	type fields struct {
		CSPStore           cloudhub.CSPStore
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
			name: "Get All CSPs",
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
				CSPStore: &mocks.CSPStore{
					AllF: func(ctx context.Context) ([]cloudhub.CSP, error) {
						return []cloudhub.CSP{
							{
								ID:           "547",
								Provider:     cloudhub.AWS,
								NameSpace:    "seoul",
								AccessKey:    "DUEJDJ+KEJDN",
								SecretKey:    "WOWCMSG+KEUCBWDKC+WUCN",
								Organization: "76",
								Minion:       "minion01",
							},
							{
								ID:           "8367",
								Provider:     cloudhub.GCP,
								NameSpace:    "seoul",
								AccessKey:    "XXCIEJRJ+KEUR",
								SecretKey:    "QOPSMCBDGE+KEICYWLC+KEUICHSJSN",
								Organization: "32",
								Minion:       "minion02",
							},
							{
								ID:           "547",
								Provider:     cloudhub.OSP,
								NameSpace:    "osp_pj_demo01",
								AccessKey:    "",
								SecretKey:    "",
								Organization: "76",
								Minion:       "",
							},
						}, nil
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					DefaultOrganizationF: func(context.Context) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "76",
							Name: "snet_org",
						}, nil
					},
				},
			},
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"links":{"self":"/cloudhub/v1/csp"},"CSPs":[{"id":"547","provider":"aws","namespace":"seoul","accesskey":"DUEJDJ+KEJDN","secretkey":"WOWCMSG+KEUCBWDKC+WUCN","organization":"76","minion":"minion01","links":{"self":"/cloudhub/v1/csp/547"}},{"id":"8367","provider":"gcp","namespace":"seoul","accesskey":"XXCIEJRJ+KEUR","secretkey":"QOPSMCBDGE+KEICYWLC+KEUICHSJSN","organization":"32","minion":"minion02","links":{"self":"/cloudhub/v1/csp/8367"}},{"id":"547","provider":"osp","namespace":"osp_pj_demo01","accesskey":"","secretkey":"","organization":"76","minion":"","links":{"self":"/cloudhub/v1/csp/547"}}]}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					OrganizationsStore: tt.fields.OrganizationsStore,
					CSPStore:           tt.fields.CSPStore,
				},
				Logger: tt.fields.Logger,
			}

			s.CSP(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. CSP() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. CSP() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. CSP() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestNewCSP(t *testing.T) {
	type fields struct {
		OrganizationsStore cloudhub.OrganizationsStore
		CSPStore           cloudhub.CSPStore
		Logger             cloudhub.Logger
	}
	type args struct {
		w   *httptest.ResponseRecorder
		r   *http.Request
		csp *cspRequest
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
			name: "Create CSP:aws",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				csp: &cspRequest{
					Provider:  cloudhub.AWS,
					NameSpace: "seoul",
					AccessKey: "CLWEIDNCSLFDJSDL",
					SecretKey: "ZNCVLKJAHSDLFHJASIFOASDHFA",
					Minion:    "minion01",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				CSPStore: &mocks.CSPStore{
					AddF: func(ctx context.Context, csp *cloudhub.CSP) (*cloudhub.CSP, error) {
						return &cloudhub.CSP{
							ID:           "46",
							Provider:     cloudhub.AWS,
							NameSpace:    "seoul",
							AccessKey:    "CLWEIDNCSLFDJSDL",
							SecretKey:    "ZNCVLKJAHSDLFHJASIFOASDHFA",
							Organization: "88",
							Minion:       "minion01",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.CSP, error) {
						return []cloudhub.CSP{
							{
								ID:           "23",
								Provider:     cloudhub.GCP,
								NameSpace:    "seoul",
								AccessKey:    "CLWEIDNCSLFDJSDL",
								SecretKey:    "ZNCVLKJAHSDLFHJASIFOASDHFA",
								Organization: "43",
								Minion:       "minion02",
							},
						}, nil
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					DefaultOrganizationF: func(context.Context) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "88",
							Name: "snet_org",
						}, nil
					},
				},
			},
			wantStatus:      http.StatusCreated,
			wantContentType: "application/json",
			wantBody:        `{"id":"46","provider":"aws","namespace":"seoul","accesskey":"CLWEIDNCSLFDJSDL","secretkey":"ZNCVLKJAHSDLFHJASIFOASDHFA","organization":"88","minion":"minion01","links":{"self":"/cloudhub/v1/csp/46"}}`,
		},
		{
			name: "Create CSP:gcp",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				csp: &cspRequest{
					Provider:  cloudhub.GCP,
					NameSpace: "seoul",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				CSPStore: &mocks.CSPStore{
					AddF: func(ctx context.Context, csp *cloudhub.CSP) (*cloudhub.CSP, error) {
						return &cloudhub.CSP{
							ID:           "46",
							Provider:     cloudhub.GCP,
							NameSpace:    "seoul",
							Organization: "88",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.CSP, error) {
						return []cloudhub.CSP{
							{
								ID:           "23",
								Provider:     cloudhub.AWS,
								NameSpace:    "seoul",
								AccessKey:    "CLWEIDNCSLFDJSDL",
								SecretKey:    "ZNCVLKJAHSDLFHJASIFOASDHFA",
								Organization: "43",
								Minion:       "minion02",
							},
						}, nil
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					DefaultOrganizationF: func(context.Context) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "88",
							Name: "snet_org",
						}, nil
					},
				},
			},
			wantStatus:      http.StatusCreated,
			wantContentType: "application/json",
			wantBody:        `{"id":"46","provider":"gcp","links":{"self":"/cloudhub/v1/csp/46"},"namespace":"seoul","accesskey":"","secretkey":"","organization":"88","minion":""}`,
		},
		{
			name: "Create CSP:osp",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				csp: &cspRequest{
					Provider:  cloudhub.OSP,
					NameSpace: saltTestNameSpace,
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				CSPStore: &mocks.CSPStore{
					AddF: func(ctx context.Context, csp *cloudhub.CSP) (*cloudhub.CSP, error) {
						return &cloudhub.CSP{
							ID:           "46",
							Provider:     cloudhub.OSP,
							NameSpace:    saltTestNameSpace,
							Organization: "88",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.CSP, error) {
						return []cloudhub.CSP{
							{
								ID:           "23",
								Provider:     cloudhub.AWS,
								NameSpace:    "seoul",
								AccessKey:    "CLWEIDNCSLFDJSDL",
								SecretKey:    "ZNCVLKJAHSDLFHJASIFOASDHFA",
								Organization: "43",
								Minion:       "minion02",
							},
							{
								ID:           "45",
								Provider:     cloudhub.OSP,
								NameSpace:    "osp_pj_demo01",
								Organization: "80",
							},
						}, nil
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					DefaultOrganizationF: func(context.Context) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "88",
							Name: saltTestNameSpace,
						}, nil
					},
				},
			},
			wantStatus:      http.StatusCreated,
			wantContentType: "application/json",
			wantBody:        fmt.Sprintf(`{"id":"46","provider":"osp","namespace":"%s","accesskey":"","secretkey":"","organization":"88","minion":"","links":{"self":"/cloudhub/v1/csp/46"}}`, saltTestNameSpace),
		},
		{
			name: "Fail to create CSP - no provider",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				csp: &cspRequest{},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				CSPStore: &mocks.CSPStore{
					AddF: func(ctx context.Context, csp *cloudhub.CSP) (*cloudhub.CSP, error) {
						return &cloudhub.CSP{
							ID:           "46",
							Provider:     cloudhub.AWS,
							NameSpace:    "seoul",
							AccessKey:    "CLWEIDNCSLFDJSDL",
							SecretKey:    "ZNCVLKJAHSDLFHJASIFOASDHFA",
							Organization: "88",
							Minion:       "minion01",
						}, nil
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					DefaultOrganizationF: func(context.Context) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "88",
							Name: "snet_org",
						}, nil
					},
				},
			},
			wantStatus:      http.StatusUnprocessableEntity,
			wantContentType: "application/json",
			wantBody:        `{"code":422,"message":"provider required CSP request body"}`,
		},
		{
			name: "Fail to create CSP:aws - no secretkey",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				csp: &cspRequest{
					Provider:  cloudhub.AWS,
					NameSpace: "seoul",
					AccessKey: "CLWEIDNCSLFDJSDL",
					Minion:    "minion01",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				CSPStore: &mocks.CSPStore{
					AddF: func(ctx context.Context, csp *cloudhub.CSP) (*cloudhub.CSP, error) {
						return &cloudhub.CSP{
							ID:           "46",
							Provider:     cloudhub.AWS,
							NameSpace:    "seoul",
							AccessKey:    "CLWEIDNCSLFDJSDL",
							SecretKey:    "ZNCVLKJAHSDLFHJASIFOASDHFA",
							Organization: "88",
							Minion:       "minion01",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.CSP, error) {
						return []cloudhub.CSP{
							{
								ID:           "23",
								Provider:     cloudhub.GCP,
								NameSpace:    "seoul",
								Organization: "43",
							},
						}, nil
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					DefaultOrganizationF: func(context.Context) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "88",
							Name: "snet_org",
						}, nil
					},
				},
			},
			wantStatus:      http.StatusUnprocessableEntity,
			wantContentType: "application/json",
			wantBody:        `{"code":422,"message":"secretkey required CSP request body"}`,
		},
		{
			name: "Fail to create CSP - Duplicated org(tenant)",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				csp: &cspRequest{
					Provider:  cloudhub.OSP,
					NameSpace: saltTestNameSpace,
					AccessKey: saltTestAccessKey,
					SecretKey: saltTestSecretKey,
					Minion:    "",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				CSPStore: &mocks.CSPStore{
					AddF: func(ctx context.Context, csp *cloudhub.CSP) (*cloudhub.CSP, error) {
						return &cloudhub.CSP{
							ID:           "46",
							Provider:     cloudhub.OSP,
							NameSpace:    saltTestNameSpace,
							AccessKey:    saltTestAccessKey,
							SecretKey:    saltTestSecretKey,
							Minion:       "",
							Organization: "88",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.CSP, error) {
						return []cloudhub.CSP{
							{
								ID:           "23",
								Provider:     cloudhub.AWS,
								NameSpace:    "seoul",
								AccessKey:    "CLWEIDNCSLFDJSDL",
								SecretKey:    "ZNCVLKJAHSDLFHJASIFOASDHFA",
								Organization: "43",
								Minion:       "minion02",
							},
							{
								ID:           "45",
								Provider:     "osp",
								NameSpace:    saltTestNameSpace,
								AccessKey:    saltTestAccessKey,
								SecretKey:    saltTestSecretKey,
								Minion:       "",
								Organization: "88",
							},
						}, nil
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					DefaultOrganizationF: func(context.Context) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "88",
							Name: saltTestNameSpace,
						}, nil
					},
				},
			},
			wantStatus:      http.StatusUnprocessableEntity,
			wantContentType: "application/json",
			wantBody:        `{"code":422,"message":"Provider and NameSpace does existed in organization"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					OrganizationsStore: tt.fields.OrganizationsStore,
					CSPStore:           tt.fields.CSPStore,
					SourcesStore: &mocks.SourcesStore{
						GetF: func(ctx context.Context, ID int) (cloudhub.Source, error) {
							var src cloudhub.Source
							switch ID {
							case 0:
								src = cloudhub.Source{
									ID:      0,
									Name:    saltTestInfluxDBURL1,
									Type:    cloudhub.InfluxDB,
									URL:     saltTestInfluxDBURL1,
									Default: false,
								}
							case 1:
								src = cloudhub.Source{
									ID:      0,
									Name:    saltTestInfluxDBURL2,
									Type:    cloudhub.InfluxDB,
									URL:     saltTestInfluxDBURL2,
									Default: false,
								}
							default:
								return src, fmt.Errorf("Invaild index: %d", ID)
							}
							return src, nil
						},
					},
				},
				AddonURLs: map[string]string{
					"salt":          saltTestURL,
					"salt-env-path": "/opt/miniconda3/envs/saltenv",
				},
				AddonTokens: map[string]string{
					"salt": saltTestToken,
				},
				OSP: OSP{
					AdminUser:     saltTestAccessKey,
					AdminPW:       saltTestSecretKey,
					AuthURL:       saltTestAuthURL,
					ProjectDomain: saltTestProjectDomain,
					UserDomain:    saltTestUserDomain,
				},
				Logger: tt.fields.Logger,
			}

			buf, _ := json.Marshal(tt.args.csp)
			tt.args.r.Body = ioutil.NopCloser(bytes.NewReader(buf))
			s.NewCSP(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. NewCSP() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. NewCSP() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. NewCSP() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestUpdateCSP(t *testing.T) {
	type fields struct {
		CSPStore           cloudhub.CSPStore
		OrganizationsStore cloudhub.OrganizationsStore
		Logger             cloudhub.Logger
	}
	type args struct {
		w      *httptest.ResponseRecorder
		r      *http.Request
		csp    *cspRequest
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
			name: "Update CSP NameSpace",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				csp: &cspRequest{
					NameSpace: "china",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				CSPStore: &mocks.CSPStore{
					UpdateF: func(ctx context.Context, csp *cloudhub.CSP) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.CSPQuery) (*cloudhub.CSP, error) {
						return &cloudhub.CSP{
							ID:           "547",
							Provider:     cloudhub.AWS,
							NameSpace:    "seoul",
							AccessKey:    "DUEJDJ+KEJDN",
							SecretKey:    "WOWCMSG+KEUCBWDKC+WUCN",
							Organization: "76",
							Minion:       "minion01",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.CSP, error) {
						return []cloudhub.CSP{
							{
								ID:           "547",
								Provider:     cloudhub.AWS,
								NameSpace:    "seoul",
								AccessKey:    "DUEJDJ+KEJDN",
								SecretKey:    "WOWCMSG+KEUCBWDKC+WUCN",
								Organization: "76",
								Minion:       "minion01",
							},
							{
								ID:           "8367",
								Provider:     cloudhub.GCP,
								NameSpace:    "seoul",
								AccessKey:    "XXCIEJRJ+KEUR",
								SecretKey:    "QOPSMCBDGE+KEICYWLC+KEUICHSJSN",
								Organization: "32",
								Minion:       "minion02",
							},
						}, nil
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					DefaultOrganizationF: func(context.Context) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "76",
							Name: "snet_org",
						}, nil
					},
				},
			},
			id:              "547",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"id":"547","provider":"aws","namespace":"china","accesskey":"DUEJDJ+KEJDN","secretkey":"WOWCMSG+KEUCBWDKC+WUCN","organization":"76","minion":"minion01","links":{"self":"/cloudhub/v1/csp/547"}}`,
		},
		{
			name: "Update CSP Duplicated NameSpace",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				csp: &cspRequest{
					NameSpace: "seoul",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				CSPStore: &mocks.CSPStore{
					UpdateF: func(ctx context.Context, csp *cloudhub.CSP) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.CSPQuery) (*cloudhub.CSP, error) {
						return &cloudhub.CSP{
							ID:           "547",
							Provider:     cloudhub.AWS,
							NameSpace:    "seoul",
							AccessKey:    "DUEJDJ+KEJDN",
							SecretKey:    "WOWCMSG+KEUCBWDKC+WUCN",
							Organization: "76",
							Minion:       "minion01",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.CSP, error) {
						return []cloudhub.CSP{
							{
								ID:           "547",
								Provider:     cloudhub.AWS,
								NameSpace:    "seoul",
								AccessKey:    "DUEJDJ+KEJDN",
								SecretKey:    "WOWCMSG+KEUCBWDKC+WUCN",
								Organization: "76",
								Minion:       "minion01",
							},
							{
								ID:           "8367",
								Provider:     cloudhub.GCP,
								NameSpace:    "seoul",
								AccessKey:    "XXCIEJRJ+KEUR",
								SecretKey:    "QOPSMCBDGE+KEICYWLC+KEUICHSJSN",
								Organization: "32",
								Minion:       "minion02",
							},
						}, nil
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					DefaultOrganizationF: func(context.Context) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "76",
							Name: "snet_org",
						}, nil
					},
				},
			},
			id:              "547",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"id":"547","provider":"aws","namespace":"seoul","accesskey":"DUEJDJ+KEJDN","secretkey":"WOWCMSG+KEUCBWDKC+WUCN","organization":"76","minion":"minion01","links":{"self":"/cloudhub/v1/csp/547"}}`,
		},
		{
			name: "Update CSP-Provider cannot be changed",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				csp: &cspRequest{
					Provider:  "azure",
					NameSpace: "us",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				CSPStore: &mocks.CSPStore{
					UpdateF: func(ctx context.Context, csp *cloudhub.CSP) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.CSPQuery) (*cloudhub.CSP, error) {
						return &cloudhub.CSP{
							ID:           "547",
							Provider:     cloudhub.AWS,
							NameSpace:    "seoul",
							AccessKey:    "DUEJDJ+KEJDN",
							SecretKey:    "WOWCMSG+KEUCBWDKC+WUCN",
							Organization: "76",
							Minion:       "minion01",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.CSP, error) {
						return []cloudhub.CSP{
							{
								ID:           "547",
								Provider:     cloudhub.AWS,
								NameSpace:    "seoul",
								AccessKey:    "DUEJDJ+KEJDN",
								SecretKey:    "WOWCMSG+KEUCBWDKC+WUCN",
								Organization: "76",
								Minion:       "minion01",
							},
							{
								ID:           "8367",
								Provider:     cloudhub.GCP,
								NameSpace:    "seoul",
								AccessKey:    "XXCIEJRJ+KEUR",
								SecretKey:    "QOPSMCBDGE+KEICYWLC+KEUICHSJSN",
								Organization: "32",
								Minion:       "minion02",
							},
						}, nil
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					DefaultOrganizationF: func(context.Context) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "76",
							Name: "snet_org",
						}, nil
					},
				},
			},
			id:              "547",
			wantStatus:      http.StatusUnprocessableEntity,
			wantContentType: "application/json",
			wantBody:        `{"code":422,"message":"Provider cannot be changed"}`,
		},
		{
			name: "Update CSP AccessKey",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				csp: &cspRequest{
					AccessKey: "OCELEICJS+JEUDHGHG",
					SecretKey: "CVC+LFOEWYU++KFYUWCLCOEJDMNCFVMCVJ",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				CSPStore: &mocks.CSPStore{
					UpdateF: func(ctx context.Context, csp *cloudhub.CSP) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.CSPQuery) (*cloudhub.CSP, error) {
						return &cloudhub.CSP{
							ID:           "547",
							Provider:     cloudhub.AWS,
							NameSpace:    "seoul",
							AccessKey:    "DUEJDJ+KEJDN",
							SecretKey:    "WOWCMSG+KEUCBWDKC+WUCN",
							Organization: "76",
							Minion:       "minion01",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.CSP, error) {
						return []cloudhub.CSP{
							{
								ID:           "547",
								Provider:     cloudhub.AWS,
								NameSpace:    "seoul",
								AccessKey:    "DUEJDJ+KEJDN",
								SecretKey:    "WOWCMSG+KEUCBWDKC+WUCN",
								Organization: "76",
								Minion:       "minion01",
							},
							{
								ID:           "8367",
								Provider:     cloudhub.GCP,
								NameSpace:    "seoul",
								Organization: "32",
							},
						}, nil
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					DefaultOrganizationF: func(context.Context) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "76",
							Name: "snet_org",
						}, nil
					},
				},
			},
			id:              "547",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"id":"547","provider":"aws","namespace":"seoul","accesskey":"OCELEICJS+JEUDHGHG","secretkey":"CVC+LFOEWYU++KFYUWCLCOEJDMNCFVMCVJ","organization":"76","minion":"minion01","links":{"self":"/cloudhub/v1/csp/547"}}`,
		},
		{
			name: "Update CSP-nothing to update",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				csp: &cspRequest{},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				CSPStore: &mocks.CSPStore{
					UpdateF: func(ctx context.Context, csp *cloudhub.CSP) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.CSPQuery) (*cloudhub.CSP, error) {
						return &cloudhub.CSP{
							ID:           "547",
							Provider:     cloudhub.AWS,
							NameSpace:    "seoul",
							AccessKey:    "DUEJDJ+KEJDN",
							SecretKey:    "WOWCMSG+KEUCBWDKC+WUCN",
							Organization: "76",
							Minion:       "minion01",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.CSP, error) {
						return []cloudhub.CSP{
							{
								ID:           "547",
								Provider:     cloudhub.AWS,
								NameSpace:    "seoul",
								AccessKey:    "DUEJDJ+KEJDN",
								SecretKey:    "WOWCMSG+KEUCBWDKC+WUCN",
								Organization: "76",
								Minion:       "minion01",
							},
							{
								ID:           "8367",
								Provider:     cloudhub.GCP,
								NameSpace:    "seoul",
								AccessKey:    "XXCIEJRJ+KEUR",
								SecretKey:    "QOPSMCBDGE+KEICYWLC+KEUICHSJSN",
								Organization: "32",
								Minion:       "minion02",
							},
						}, nil
					},
				},
			},
			id:              "547",
			wantStatus:      http.StatusUnprocessableEntity,
			wantContentType: "application/json",
			wantBody:        `{"code":422,"message":"No fields to update"}`,
		},
		{
			name: "Update CSP-invalid update",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				csp: &cspRequest{
					AccessKey: "Changed ID",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				CSPStore: &mocks.CSPStore{
					UpdateF: func(ctx context.Context, csp *cloudhub.CSP) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.CSPQuery) (*cloudhub.CSP, error) {
						return &cloudhub.CSP{}, cloudhub.ErrCSPNotFound
					},
				},
			},
			id:              "547",
			wantStatus:      http.StatusNotFound,
			wantContentType: "application/json",
			wantBody:        `{"code":404,"message":"ID 547 not found"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					CSPStore:           tt.fields.CSPStore,
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

			buf, _ := json.Marshal(tt.args.csp)
			tt.args.r.Body = ioutil.NopCloser(bytes.NewReader(buf))

			s.UpdateCSP(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. UpdateCSP() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. UpdateCSP() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. UpdateCSP() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestRemoveCSP(t *testing.T) {
	type fields struct {
		CSPStore cloudhub.CSPStore
		Logger   cloudhub.Logger
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
			name: "Remove CSP-normal",
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
				CSPStore: &mocks.CSPStore{
					DeleteF: func(ctx context.Context, csp *cloudhub.CSP) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.CSPQuery) (*cloudhub.CSP, error) {
						switch *q.ID {
						case "547":
							return &cloudhub.CSP{
								ID:           "547",
								Provider:     cloudhub.AWS,
								NameSpace:    "seoul",
								AccessKey:    "DUEJDJ+KEJDN",
								SecretKey:    "WOWCMSG+KEUCBWDKC+WUCN",
								Organization: "76",
								Minion:       "minion01",
							}, nil
						default:
							return &cloudhub.CSP{}, fmt.Errorf("CSP with ID %s not found", *q.ID)
						}
					},
				},
			},
			id:         "547",
			wantStatus: http.StatusNoContent,
		},
		{
			name: "Remove CSP-OSP",
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
				CSPStore: &mocks.CSPStore{
					DeleteF: func(ctx context.Context, csp *cloudhub.CSP) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.CSPQuery) (*cloudhub.CSP, error) {
						switch *q.ID {
						case "547":
							return &cloudhub.CSP{
								ID:           "547",
								Provider:     cloudhub.OSP,
								NameSpace:    saltTestNameSpace,
								Organization: "76",
							}, nil
						default:
							return &cloudhub.CSP{}, fmt.Errorf("CSP with ID %s not found", *q.ID)
						}
					},
				},
			},
			id:         "547",
			wantStatus: http.StatusNoContent,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					CSPStore: tt.fields.CSPStore,
				},
				AddonURLs: map[string]string{
					"salt":          saltTestURL,
					"salt-env-path": "/opt/miniconda3/envs/saltenv",
				},
				AddonTokens: map[string]string{
					"salt": saltTestToken,
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

			s.RemoveCSP(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. RemoveCSP() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
		})
	}
}

func TestService_generateSaltConfigForOSP(t *testing.T) {
	tests := []struct {
		name string
		s    *Service
		csp  *cloudhub.CSP
	}{
		{
			name: "Generate Salt Config For OSP",
			s: &Service{
				AddonURLs: map[string]string{
					"salt":          saltTestURL,
					"salt-env-path": saltTestEnvPath,
				},
				AddonTokens: map[string]string{
					"salt": saltTestToken,
				},
				OSP: OSP{
					AdminUser:     saltTestAccessKey,
					AdminPW:       saltTestSecretKey,
					AuthURL:       saltTestAuthURL,
					ProjectDomain: saltTestProjectDomain,
					UserDomain:    saltTestUserDomain,
				},
				Logger: log.New(log.DebugLevel),
			},
			csp: &cloudhub.CSP{
				Provider:  "osp",
				NameSpace: saltTestNameSpace,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			statusCode, resp, err := tt.s.generateSaltConfigForOSP(tt.csp)
			if err != nil {
				t.Errorf("Service.generateSaltConfigForOSP() error = %v\n", err)
			} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
				t.Errorf("Service.generateSaltConfigForOSP() statusCode = %v\n", statusCode)
			}
			tt.s.Logger.
				WithField("1-statusCode", statusCode).
				WithField("2-resp", string(resp)).
				Debug("ice.generateSaltConfigForOSP() Responsed Data")
		})
	}
}

func TestService_removeSaltConfigForOSP(t *testing.T) {
	tests := []struct {
		name string
		s    *Service
		csp  *cloudhub.CSP
	}{
		{
			name: "Remove Salt Config For OSP",
			s: &Service{
				AddonURLs: map[string]string{
					"salt":          saltTestURL,
					"salt-env-path": saltTestEnvPath,
				},
				AddonTokens: map[string]string{
					"salt": saltTestToken,
				},
				Logger: log.New(log.DebugLevel),
			},
			csp: &cloudhub.CSP{
				NameSpace: saltTestNameSpace,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			statusCode, resp, err := tt.s.removeSaltConfigForOSP(tt.csp)
			if err != nil {
				t.Errorf("Service.removeSaltConfigForOSP() error = %v\n", err)
			} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
				t.Errorf("Service.removeSaltConfigForOSP() statusCode = %v\n", statusCode)
			}
			tt.s.Logger.
				WithField("1-statusCode", statusCode).
				WithField("2-resp", string(resp)).
				Debug("Service.removeSaltConfigForOSP() Responsed Data")
		})
	}
}

func TestService_generateTelegrafConfigForOSP(t *testing.T) {
	tests := []struct {
		name string
		s    *Service
		csp  *cloudhub.CSP
	}{
		{
			name: "Generate Telegraf Config For OSP",
			s: &Service{
				AddonURLs: map[string]string{
					"salt": saltTestURL,
				},
				AddonTokens: map[string]string{
					"salt": saltTestToken,
				},
				Logger: log.New(log.DebugLevel),
				Store: &mocks.Store{
					SourcesStore: &mocks.SourcesStore{
						GetF: func(ctx context.Context, ID int) (cloudhub.Source, error) {
							var src cloudhub.Source
							switch ID {
							case 0:
								src = cloudhub.Source{
									ID:      0,
									Name:    saltTestInfluxDBURL1,
									Type:    cloudhub.InfluxDB,
									URL:     saltTestInfluxDBURL1,
									Default: false,
								}
							case 1:
								src = cloudhub.Source{
									ID:      0,
									Name:    saltTestInfluxDBURL2,
									Type:    cloudhub.InfluxDB,
									URL:     saltTestInfluxDBURL2,
									Default: false,
								}
							default:
								return src, fmt.Errorf("Invaild index: %d", ID)
							}
							return src, nil
						},
					},
				},
				OSP: OSP{
					AdminUser:     saltTestAccessKey,
					AdminPW:       saltTestSecretKey,
					AuthURL:       saltTestAuthURL,
					ProjectDomain: saltTestProjectDomain,
					UserDomain:    saltTestUserDomain,
				},
			},
			csp: &cloudhub.CSP{
				Provider:  "osp",
				NameSpace: saltTestNameSpace,
			},
		},
	}

	ctx := context.Background()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			statusCode, resp, err := tt.s.generateTelegrafConfigForOSP(ctx, tt.csp)
			if err != nil {
				t.Errorf("Service.generateTelegrafConfigForOSP() error = %v\n", err)
			} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
				t.Errorf("Service.generateTelegrafConfigForOSP() statusCode = %v\n", statusCode)
			}
			tt.s.Logger.
				WithField("1-statusCode", statusCode).
				WithField("2-resp", string(resp)).
				Debug("ice.generateTelegrafConfigForOSP() Responsed Data")
		})
	}
}

func TestService_removeTelegrafConfigForOSP(t *testing.T) {
	tests := []struct {
		name string
		s    *Service
		csp  *cloudhub.CSP
	}{
		{
			name: "Remove Telegraf Config For OSP",
			s: &Service{
				AddonURLs: map[string]string{
					"salt": saltTestURL,
				},
				AddonTokens: map[string]string{
					"salt": saltTestToken,
				},
				Logger: log.New(log.DebugLevel),
			},
			csp: &cloudhub.CSP{
				NameSpace: saltTestNameSpace,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			statusCode, resp, err := tt.s.removeTelegrafConfigForOSP(tt.csp)
			if err != nil {
				t.Errorf("Service.removeTelegrafConfigForOSP() error = %v\n", err)
			} else if statusCode < http.StatusOK || statusCode >= http.StatusMultipleChoices {
				t.Errorf("Service.removeTelegrafConfigForOSP() statusCode = %v\n", statusCode)
			}
			tt.s.Logger.
				WithField("1-statusCode", statusCode).
				WithField("2-resp", string(resp)).
				Debug("Service.removeTelegrafConfigForOSP() Responsed Data")
		})
	}
}
