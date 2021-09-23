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

func TestCSPID(t *testing.T) {
	type fields struct {
		CSPStore   cloudhub.CSPStore
		Logger     cloudhub.Logger
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
							Provider:     "AWS",
							Region:       "seoul",
							AccessKey:    "DUEJDJ+KEJDN",
							SecretKey:    "WOWCMSG+KEUCBWDKC+WUCN",
							Organization: "76",
							Minion:       "minion01",
						}, nil
					},
				},
			},
			id:              "547",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"id":"547","provider":"AWS","links":{"self":"/cloudhub/v1/csp/547"},"region":"seoul","accesskey":"DUEJDJ+KEJDN","secretkey":"WOWCMSG+KEUCBWDKC+WUCN","organization":"76","minion":"minion01"}`,
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
		CSPStore            cloudhub.CSPStore
		OrganizationsStore  cloudhub.OrganizationsStore
		Logger              cloudhub.Logger
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
			name: "Get CSPs",
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
								Provider:     "AWS",
								Region:       "seoul",
								AccessKey:    "DUEJDJ+KEJDN",
								SecretKey:    "WOWCMSG+KEUCBWDKC+WUCN",
								Organization: "76",
								Minion:       "minion01",
							},
							{
								ID:           "8367",
								Provider:     "GCP",
								Region:       "seoul",
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
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"links":{"self":"/cloudhub/v1/csp"},"CSPs":[{"id":"547","provider":"AWS","links":{"self":"/cloudhub/v1/csp/547"},"region":"seoul","accesskey":"DUEJDJ+KEJDN","secretkey":"WOWCMSG+KEUCBWDKC+WUCN","organization":"76","minion":"minion01"},{"id":"8367","provider":"GCP","links":{"self":"/cloudhub/v1/csp/8367"},"region":"seoul","accesskey":"XXCIEJRJ+KEUR","secretkey":"QOPSMCBDGE+KEICYWLC+KEUICHSJSN","organization":"32","minion":"minion02"}]}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					OrganizationsStore:    tt.fields.OrganizationsStore,
					CSPStore:              tt.fields.CSPStore,
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
			name: "Update CSP Region",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				csp: &cspRequest{
					Region: "china",
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
							Provider:     "AWS",
							Region:       "seoul",
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
								Provider:     "AWS",
								Region:       "seoul",
								AccessKey:    "DUEJDJ+KEJDN",
								SecretKey:    "WOWCMSG+KEUCBWDKC+WUCN",
								Organization: "76",
								Minion:       "minion01",
							},
							{
								ID:           "8367",
								Provider:     "GCP",
								Region:       "seoul",
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
			wantBody:        `{"id":"547","provider":"AWS","links":{"self":"/cloudhub/v1/csp/547"},"region":"china","accesskey":"DUEJDJ+KEJDN","secretkey":"WOWCMSG+KEUCBWDKC+WUCN","organization":"76","minion":"minion01"}`,
		},
		{
			name: "Update CSP - nothing to update",
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
							Provider:     "AWS",
							Region:       "seoul",
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
								Provider:     "AWS",
								Region:       "seoul",
								AccessKey:    "DUEJDJ+KEJDN",
								SecretKey:    "WOWCMSG+KEUCBWDKC+WUCN",
								Organization: "76",
								Minion:       "minion01",
							},
							{
								ID:           "8367",
								Provider:     "GCP",
								Region:       "seoul",
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
			name: "Update CSP - Provider cannot be changed",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				csp: &cspRequest{
					Provider: "Azure",
					Region:   "USA",
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
							Provider:     "AWS",
							Region:       "seoul",
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
								Provider:     "AWS",
								Region:       "seoul",
								AccessKey:    "DUEJDJ+KEJDN",
								SecretKey:    "WOWCMSG+KEUCBWDKC+WUCN",
								Organization: "76",
								Minion:       "minion01",
							},
							{
								ID:           "8367",
								Provider:     "GCP",
								Region:       "seoul",
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
					Accesskey: "OCELEICJS+JEUDHGHG",
					Secretkey: "CVC+LFOEWYU++KFYUWCLCOEJDMNCFVMCVJ",
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
							Provider:     "AWS",
							Region:       "seoul",
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
								Provider:     "AWS",
								Region:       "seoul",
								AccessKey:    "DUEJDJ+KEJDN",
								SecretKey:    "WOWCMSG+KEUCBWDKC+WUCN",
								Organization: "76",
								Minion:       "minion01",
							},
							{
								ID:           "8367",
								Provider:     "GCP",
								Region:       "seoul",
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
			wantBody:        `{"id":"547","provider":"AWS","links":{"self":"/cloudhub/v1/csp/547"},"region":"seoul","accesskey":"OCELEICJS+JEUDHGHG","secretkey":"CVC+LFOEWYU++KFYUWCLCOEJDMNCFVMCVJ","organization":"76","minion":"minion01"}`,
		},
		{
			name: "Update CSP - invalid update",
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
						return &cloudhub.CSP{}, nil
					},
				},
			},
			id:              "547",
			wantStatus:      http.StatusUnprocessableEntity,
			wantContentType: "application/json",
			wantBody:        `{"code":422,"message":"No fields to update"}`,
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
			name: "Delete CSP",
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
							Provider:     "AWS",
							Region:       "seoul",
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

			s.RemoveCSP(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. RemoveCSP() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
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
		w    *httptest.ResponseRecorder
		r    *http.Request
		csp  *cspRequest
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
			name: "Create CSP",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				csp: &cspRequest{
					Provider:  "Azure",
					Region:    "seoul",
					Accesskey: "CLWEIDNCSLFDJSDL",
					Secretkey: "ZNCVLKJAHSDLFHJASIFOASDHFA",
					Minion:    "minion01",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				CSPStore: &mocks.CSPStore{
					AddF: func(ctx context.Context, csp *cloudhub.CSP) (*cloudhub.CSP, error) {
						return &cloudhub.CSP{
							ID:           "46",
							Provider:     "Azure",
							Region:       "seoul",
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
								Provider:     "AWS",
								Region:       "seoul",
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
			wantBody:        `{"id":"46","provider":"Azure","links":{"self":"/cloudhub/v1/csp/46"},"region":"seoul","accesskey":"CLWEIDNCSLFDJSDL","secretkey":"ZNCVLKJAHSDLFHJASIFOASDHFA","organization":"88","minion":"minion01"}`,
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
							Provider:     "Azure",
							Region:       "seoul",
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
			name: "Create CSP - no secretkey",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
				csp: &cspRequest{
					Provider:  "Azure",
					Region:    "seoul",
					Accesskey: "CLWEIDNCSLFDJSDL",
					Minion:    "minion01",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				CSPStore: &mocks.CSPStore{
					AddF: func(ctx context.Context, csp *cloudhub.CSP) (*cloudhub.CSP, error) {
						return &cloudhub.CSP{
							ID:           "46",
							Provider:     "Azure",
							Region:       "seoul",
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
			wantBody:        `{"code":422,"message":"secretkey required CSP request body"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					OrganizationsStore:  tt.fields.OrganizationsStore,
					CSPStore:            tt.fields.CSPStore,
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