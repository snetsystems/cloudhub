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
	"github.com/snetsystems/cloudhub/backend/roles"
)

func TestService_UserID(t *testing.T) {
	type fields struct {
		UsersStore cloudhub.UsersStore
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
			name: "Get Single CloudHub User",
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
				UsersStore: &mocks.UsersStore{
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						switch *q.ID {
						case 1337:
							return &cloudhub.User{
								ID:       1337,
								Name:     "billysteve",
								Provider: "google",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									roles.ViewerRole,
								},
							}, nil
						default:
							return nil, fmt.Errorf("User with ID %d not found", *q.ID)
						}
					},
				},
			},
			id:              "1337",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"id":"1337","superAdmin":false,"name":"billysteve","provider":"google","scheme":"oauth2","links":{"self":"/cloudhub/v1/users/1337"},"roles":[{"name":"viewer"}]}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					UsersStore: tt.fields.UsersStore,
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

			s.UserID(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. UserID() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. UserID() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. UserID() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestService_NewUser(t *testing.T) {
	type fields struct {
		UsersStore         cloudhub.UsersStore
		OrganizationsStore cloudhub.OrganizationsStore
		ConfigStore        cloudhub.ConfigStore
		Logger             cloudhub.Logger
	}
	type args struct {
		w           *httptest.ResponseRecorder
		r           *http.Request
		user        *userRequest
		userKeyUser *cloudhub.User
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
			name: "Create a new CloudHub User",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url",
					nil,
				),
				user: &userRequest{
					Name:     "bob",
					Provider: "github",
					Scheme:   "oauth2",
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				ConfigStore: &mocks.ConfigStore{
					Config: &cloudhub.Config{
						Auth: cloudhub.AuthConfig{
							SuperAdminNewUsers: false,
						},
					},
				},
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, user *cloudhub.User) (*cloudhub.User, error) {
						return &cloudhub.User{
							ID:       1338,
							Name:     "bob",
							Provider: "github",
							Scheme:   "oauth2",
							Roles:    []cloudhub.Role{},
						}, nil
					},
				},
			},
			wantStatus:      http.StatusCreated,
			wantContentType: "application/json",
			wantBody:        `{"id":"1338","superAdmin":false,"name":"bob","provider":"github","scheme":"oauth2","roles":[],"links":{"self":"/cloudhub/v1/users/1338"}}`,
		},
		{
			name: "Create a new CloudHub User with multiple roles",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url",
					nil,
				),
				user: &userRequest{
					Name:     "bob",
					Provider: "github",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Name:         roles.AdminRoleName,
							Organization: "1",
						},
						{
							Name:         roles.ViewerRoleName,
							Organization: "2",
						},
					},
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				ConfigStore: &mocks.ConfigStore{
					Config: &cloudhub.Config{
						Auth: cloudhub.AuthConfig{
							SuperAdminNewUsers: false,
						},
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						switch *q.ID {
						case "1":
							return &cloudhub.Organization{
								ID:          "1",
								Name:        "org",
								DefaultRole: roles.ViewerRoleName,
							}, nil
						case "2":
							return &cloudhub.Organization{
								ID:          "2",
								Name:        "another",
								DefaultRole: roles.MemberRoleName,
							}, nil
						}
						return nil, fmt.Errorf("org not found")
					},
				},
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, user *cloudhub.User) (*cloudhub.User, error) {
						return &cloudhub.User{
							ID:       1338,
							Name:     "bob",
							Provider: "github",
							Scheme:   "oauth2",
							Roles: []cloudhub.Role{
								{
									Name:         roles.AdminRoleName,
									Organization: "1",
								},
								{
									Name:         roles.ViewerRoleName,
									Organization: "2",
								},
							},
						}, nil
					},
				},
			},
			wantStatus:      http.StatusCreated,
			wantContentType: "application/json",
			wantBody:        `{"id":"1338","superAdmin":false,"name":"bob","provider":"github","scheme":"oauth2","roles":[{"name":"admin","organization":"1"},{"name":"viewer","organization":"2"}],"links":{"self":"/cloudhub/v1/users/1338"}}`,
		},
		{
			name: "Create a new CloudHub User with multiple roles same org",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url",
					nil,
				),
				user: &userRequest{
					Name:     "bob",
					Provider: "github",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Name:         roles.AdminRoleName,
							Organization: "1",
						},
						{
							Name:         roles.ViewerRoleName,
							Organization: "1",
						},
					},
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				ConfigStore: &mocks.ConfigStore{
					Config: &cloudhub.Config{
						Auth: cloudhub.AuthConfig{
							SuperAdminNewUsers: false,
						},
					},
				},
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, user *cloudhub.User) (*cloudhub.User, error) {
						return &cloudhub.User{
							ID:       1338,
							Name:     "bob",
							Provider: "github",
							Scheme:   "oauth2",
							Roles: []cloudhub.Role{
								{
									Name:         roles.AdminRoleName,
									Organization: "1",
								},
								{
									Name:         roles.ViewerRoleName,
									Organization: "1",
								},
							},
						}, nil
					},
				},
			},
			wantStatus:      http.StatusUnprocessableEntity,
			wantContentType: "application/json",
			wantBody:        `{"code":422,"message":"duplicate organization \"1\" in roles"}`,
		},
		{
			name: "Create a new SuperAdmin User - Not as superadmin",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url",
					nil,
				),
				user: &userRequest{
					Name:       "bob",
					Provider:   "github",
					Scheme:     "oauth2",
					SuperAdmin: true,
				},
				userKeyUser: &cloudhub.User{
					ID:         0,
					Name:       "coolUser",
					Provider:   "github",
					Scheme:     "oauth2",
					SuperAdmin: false,
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				ConfigStore: &mocks.ConfigStore{
					Config: &cloudhub.Config{
						Auth: cloudhub.AuthConfig{
							SuperAdminNewUsers: false,
						},
					},
				},
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, user *cloudhub.User) (*cloudhub.User, error) {
						return &cloudhub.User{
							ID:       1338,
							Name:     "bob",
							Provider: "github",
							Scheme:   "oauth2",
							Roles:    []cloudhub.Role{},
						}, nil
					},
				},
			},
			wantStatus:      http.StatusUnauthorized,
			wantContentType: "application/json",
			wantBody:        `{"code":401,"message":"User does not have authorization required to set SuperAdmin status. See https://github.com/influxdata/cloudhub/issues/2601 for more information."}`,
		},
		{
			name: "Create a new SuperAdmin User - as superadmin",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url",
					nil,
				),
				user: &userRequest{
					Name:       "bob",
					Provider:   "github",
					Scheme:     "oauth2",
					SuperAdmin: true,
				},
				userKeyUser: &cloudhub.User{
					ID:         0,
					Name:       "coolUser",
					Provider:   "github",
					Scheme:     "oauth2",
					SuperAdmin: true,
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				ConfigStore: &mocks.ConfigStore{
					Config: &cloudhub.Config{
						Auth: cloudhub.AuthConfig{
							SuperAdminNewUsers: false,
						},
					},
				},
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, user *cloudhub.User) (*cloudhub.User, error) {
						return &cloudhub.User{
							ID:         1338,
							Name:       "bob",
							Provider:   "github",
							Scheme:     "oauth2",
							Roles:      []cloudhub.Role{},
							SuperAdmin: true,
						}, nil
					},
				},
			},
			wantStatus:      http.StatusCreated,
			wantContentType: "application/json",
			wantBody:        `{"id":"1338","superAdmin":true,"name":"bob","provider":"github","scheme":"oauth2","roles":[],"links":{"self":"/cloudhub/v1/users/1338"}}`,
		},
		{
			name: "Create a new User with SuperAdminNewUsers: true in ConfigStore",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url",
					nil,
				),
				user: &userRequest{
					Name:     "bob",
					Provider: "github",
					Scheme:   "oauth2",
				},
				userKeyUser: &cloudhub.User{
					ID:         0,
					Name:       "coolUser",
					Provider:   "github",
					Scheme:     "oauth2",
					SuperAdmin: true,
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				ConfigStore: &mocks.ConfigStore{
					Config: &cloudhub.Config{
						Auth: cloudhub.AuthConfig{
							SuperAdminNewUsers: true,
						},
					},
				},
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, user *cloudhub.User) (*cloudhub.User, error) {
						user.ID = 1338
						return user, nil
					},
				},
			},
			wantStatus:      http.StatusCreated,
			wantContentType: "application/json",
			wantBody:        `{"id":"1338","superAdmin":true,"name":"bob","provider":"github","scheme":"oauth2","roles":[],"links":{"self":"/cloudhub/v1/users/1338"}}`,
		},
		{
			name: "Create a new CloudHub User with multiple roles with wildcard default role",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"POST",
					"http://any.url",
					nil,
				),
				user: &userRequest{
					Name:     "bob",
					Provider: "github",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Name:         roles.AdminRoleName,
							Organization: "1",
						},
						{
							Name:         roles.WildcardRoleName,
							Organization: "2",
						},
					},
				},
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				ConfigStore: &mocks.ConfigStore{
					Config: &cloudhub.Config{
						Auth: cloudhub.AuthConfig{
							SuperAdminNewUsers: false,
						},
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						switch *q.ID {
						case "1":
							return &cloudhub.Organization{
								ID:          "1",
								Name:        "org",
								DefaultRole: roles.ViewerRoleName,
							}, nil
						case "2":
							return &cloudhub.Organization{
								ID:          "2",
								Name:        "another",
								DefaultRole: roles.MemberRoleName,
							}, nil
						}
						return nil, fmt.Errorf("org not found")
					},
				},
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, user *cloudhub.User) (*cloudhub.User, error) {
						return &cloudhub.User{
							ID:       1338,
							Name:     "bob",
							Provider: "github",
							Scheme:   "oauth2",
							Roles: []cloudhub.Role{
								{
									Name:         roles.AdminRoleName,
									Organization: "1",
								},
								{
									Name:         roles.MemberRoleName,
									Organization: "2",
								},
							},
						}, nil
					},
				},
			},
			wantStatus:      http.StatusCreated,
			wantContentType: "application/json",
			wantBody:        `{"id":"1338","superAdmin":false,"name":"bob","provider":"github","scheme":"oauth2","roles":[{"name":"admin","organization":"1"},{"name":"member","organization":"2"}],"links":{"self":"/cloudhub/v1/users/1338"}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					UsersStore:         tt.fields.UsersStore,
					ConfigStore:        tt.fields.ConfigStore,
					OrganizationsStore: tt.fields.OrganizationsStore,
				},
				Logger: tt.fields.Logger,
			}

			buf, _ := json.Marshal(tt.args.user)
			tt.args.r.Body = ioutil.NopCloser(bytes.NewReader(buf))

			ctx := tt.args.r.Context()
			if tt.args.userKeyUser != nil {
				ctx = context.WithValue(ctx, UserContextKey, tt.args.userKeyUser)
			}

			tt.args.r = tt.args.r.WithContext(ctx)

			s.NewUser(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. UserID() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. UserID() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. UserID() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestService_RemoveUser(t *testing.T) {
	type fields struct {
		UsersStore cloudhub.UsersStore
		Logger     cloudhub.Logger
	}
	type args struct {
		w    *httptest.ResponseRecorder
		r    *http.Request
		user *cloudhub.User
		id   string
	}
	tests := []struct {
		name       string
		fields     fields
		args       args
		wantStatus int
		wantBody   string
	}{
		{
			name: "Delete a CloudHub User",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				UsersStore: &mocks.UsersStore{
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						switch *q.ID {
						case 1339:
							return &cloudhub.User{
								ID:       1339,
								Name:     "helena",
								Provider: "heroku",
								Scheme:   "oauth2",
							}, nil
						default:
							return nil, fmt.Errorf("User with ID %d not found", *q.ID)
						}
					},
					DeleteF: func(ctx context.Context, user *cloudhub.User) error {
						return nil
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"DELETE",
					"http://any.url",
					nil,
				),
				user: &cloudhub.User{
					ID:       1338,
					Name:     "helena",
					Provider: "heroku",
					Scheme:   "oauth2",
				},
				id: "1339",
			},
			wantStatus: http.StatusNoContent,
		},
		{
			name: "Deleting yourself",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				UsersStore: &mocks.UsersStore{
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						switch *q.ID {
						case 1339:
							return &cloudhub.User{
								ID:       1339,
								Name:     "helena",
								Provider: "heroku",
								Scheme:   "oauth2",
							}, nil
						default:
							return nil, fmt.Errorf("User with ID %d not found", *q.ID)
						}
					},
					DeleteF: func(ctx context.Context, user *cloudhub.User) error {
						return nil
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"DELETE",
					"http://any.url",
					nil,
				),
				user: &cloudhub.User{
					ID:       1339,
					Name:     "helena",
					Provider: "heroku",
					Scheme:   "oauth2",
				},
				id: "1339",
			},
			wantStatus: http.StatusNoContent,
			wantBody:   ``,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					UsersStore: tt.fields.UsersStore,
				},
				Logger: tt.fields.Logger,
			}

			tt.args.r = tt.args.r.WithContext(httprouter.WithParams(
				context.Background(),
				httprouter.Params{
					{
						Key:   "id",
						Value: tt.args.id,
					},
				},
			))

			if tt.args.user != nil {
				ctx := tt.args.r.Context()
				ctx = context.WithValue(ctx, UserContextKey, tt.args.user)
				tt.args.r = tt.args.r.WithContext(ctx)
			}

			s.RemoveUser(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. RemoveUser() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantStatus == http.StatusNoContent {
				return
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); !eq {
				t.Errorf("%q. RemoveUser() = %v, want %v", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestService_UpdateUser(t *testing.T) {
	type fields struct {
		UsersStore         cloudhub.UsersStore
		OrganizationsStore cloudhub.OrganizationsStore
		Logger             cloudhub.Logger
	}
	type args struct {
		w           *httptest.ResponseRecorder
		r           *http.Request
		user        *userRequest
		userKeyUser *cloudhub.User
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
			name: "Update a CloudHub user - no roles",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				UsersStore: &mocks.UsersStore{
					UpdateF: func(ctx context.Context, user *cloudhub.User) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						switch *q.ID {
						case 1336:
							return &cloudhub.User{
								ID:       1336,
								Name:     "bobbetta",
								Provider: "github",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									{
										Name:         roles.EditorRoleName,
										Organization: "1",
									},
								},
							}, nil
						default:
							return nil, fmt.Errorf("User with ID %d not found", *q.ID)
						}
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url",
					nil,
				),
				userKeyUser: &cloudhub.User{
					ID:         0,
					Name:       "coolUser",
					Provider:   "github",
					Scheme:     "oauth2",
					SuperAdmin: false,
				},
				user: &userRequest{
					ID:    1336,
					Roles: []cloudhub.Role{},
				},
			},
			id:              "1336",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"id":"1336","superAdmin":false,"name":"bobbetta","provider":"github","scheme":"oauth2","links":{"self":"/cloudhub/v1/users/1336"},"roles":[]}`,
		},
		{
			name: "Update a CloudHub user",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				OrganizationsStore: &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						switch *q.ID {
						case "1":
							return &cloudhub.Organization{
								ID:          "1",
								Name:        "org",
								DefaultRole: roles.ViewerRoleName,
							}, nil
						}
						return nil, fmt.Errorf("org not found")
					},
				},
				UsersStore: &mocks.UsersStore{
					UpdateF: func(ctx context.Context, user *cloudhub.User) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						switch *q.ID {
						case 1336:
							return &cloudhub.User{
								ID:       1336,
								Name:     "bobbetta",
								Provider: "github",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									{
										Name:         roles.EditorRoleName,
										Organization: "1",
									},
								},
							}, nil
						default:
							return nil, fmt.Errorf("User with ID %d not found", *q.ID)
						}
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url",
					nil,
				),
				userKeyUser: &cloudhub.User{
					ID:         0,
					Name:       "coolUser",
					Provider:   "github",
					Scheme:     "oauth2",
					SuperAdmin: false,
				},
				user: &userRequest{
					ID: 1336,
					Roles: []cloudhub.Role{
						{
							Name:         roles.AdminRoleName,
							Organization: "1",
						},
					},
				},
			},
			id:              "1336",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"id":"1336","superAdmin":false,"name":"bobbetta","provider":"github","scheme":"oauth2","links":{"self":"/cloudhub/v1/users/1336"},"roles":[{"name":"admin","organization":"1"}]}`,
		},
		{
			name: "Update a CloudHub user roles different orgs",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				OrganizationsStore: &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						switch *q.ID {
						case "1":
							return &cloudhub.Organization{
								ID:          "1",
								Name:        "org",
								DefaultRole: roles.ViewerRoleName,
							}, nil
						case "2":
							return &cloudhub.Organization{
								ID:          "2",
								Name:        "another",
								DefaultRole: roles.ViewerRoleName,
							}, nil
						}
						return nil, fmt.Errorf("org not found")
					},
				},
				UsersStore: &mocks.UsersStore{
					UpdateF: func(ctx context.Context, user *cloudhub.User) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						switch *q.ID {
						case 1336:
							return &cloudhub.User{
								ID:       1336,
								Name:     "bobbetta",
								Provider: "github",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									roles.EditorRole,
								},
							}, nil
						default:
							return nil, fmt.Errorf("User with ID %d not found", *q.ID)
						}
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url",
					nil,
				),
				userKeyUser: &cloudhub.User{
					ID:         0,
					Name:       "coolUser",
					Provider:   "github",
					Scheme:     "oauth2",
					SuperAdmin: false,
				},
				user: &userRequest{
					ID: 1336,
					Roles: []cloudhub.Role{
						{
							Name:         roles.AdminRoleName,
							Organization: "1",
						},
						{
							Name:         roles.ViewerRoleName,
							Organization: "2",
						},
					},
				},
			},
			id:              "1336",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"id":"1336","superAdmin":false,"name":"bobbetta","provider":"github","scheme":"oauth2","links":{"self":"/cloudhub/v1/users/1336"},"roles":[{"name":"admin","organization":"1"},{"name":"viewer","organization":"2"}]}`,
		},
		{
			name: "Update a CloudHub user roles same org",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				UsersStore: &mocks.UsersStore{
					UpdateF: func(ctx context.Context, user *cloudhub.User) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						switch *q.ID {
						case 1336:
							return &cloudhub.User{
								ID:       1336,
								Name:     "bobbetta",
								Provider: "github",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									roles.EditorRole,
								},
							}, nil
						default:
							return nil, fmt.Errorf("User with ID %d not found", *q.ID)
						}
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url",
					nil,
				),
				user: &userRequest{
					ID: 1336,
					Roles: []cloudhub.Role{
						{
							Name:         roles.AdminRoleName,
							Organization: "1",
						},
						{
							Name:         roles.ViewerRoleName,
							Organization: "1",
						},
					},
				},
			},
			id:              "1336",
			wantStatus:      http.StatusUnprocessableEntity,
			wantContentType: "application/json",
			wantBody:        `{"code":422,"message":"duplicate organization \"1\" in roles"}`,
		},
		{
			name: "SuperAdmin modifying their own SuperAdmin Status - user missing from context",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				OrganizationsStore: &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						switch *q.ID {
						case "1":
							return &cloudhub.Organization{
								ID:          "1",
								Name:        "org",
								DefaultRole: roles.ViewerRoleName,
							}, nil
						}
						return nil, fmt.Errorf("org not found")
					},
				},
				UsersStore: &mocks.UsersStore{
					UpdateF: func(ctx context.Context, user *cloudhub.User) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						switch *q.ID {
						case 1336:
							return &cloudhub.User{
								ID:         1336,
								Name:       "bobbetta",
								Provider:   "github",
								Scheme:     "oauth2",
								SuperAdmin: true,
								Roles: []cloudhub.Role{
									{
										Name:         roles.EditorRoleName,
										Organization: "1",
									},
								},
							}, nil
						default:
							return nil, fmt.Errorf("User with ID %d not found", *q.ID)
						}
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url",
					nil,
				),
				user: &userRequest{
					ID:         1336,
					SuperAdmin: false,
					Roles: []cloudhub.Role{
						{
							Name:         roles.AdminRoleName,
							Organization: "1",
						},
					},
				},
			},
			id:              "1336",
			wantStatus:      http.StatusInternalServerError,
			wantContentType: "application/json",
			wantBody:        `{"code":500,"message":"failed to retrieve user from context"}`,
		},
		{
			name: "SuperAdmin modifying their own SuperAdmin Status",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				OrganizationsStore: &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						switch *q.ID {
						case "1":
							return &cloudhub.Organization{
								ID:          "1",
								Name:        "org",
								DefaultRole: roles.ViewerRoleName,
							}, nil
						}
						return nil, fmt.Errorf("org not found")
					},
				},
				UsersStore: &mocks.UsersStore{
					UpdateF: func(ctx context.Context, user *cloudhub.User) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						switch *q.ID {
						case 1336:
							return &cloudhub.User{
								ID:         1336,
								Name:       "bobbetta",
								Provider:   "github",
								Scheme:     "oauth2",
								SuperAdmin: true,
								Roles: []cloudhub.Role{
									{
										Name:         roles.EditorRoleName,
										Organization: "1",
									},
								},
							}, nil
						default:
							return nil, fmt.Errorf("User with ID %d not found", *q.ID)
						}
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url",
					nil,
				),
				user: &userRequest{
					ID:         1336,
					SuperAdmin: false,
					Roles: []cloudhub.Role{
						{
							Name:         roles.AdminRoleName,
							Organization: "1",
						},
					},
				},
				userKeyUser: &cloudhub.User{
					ID:         1336,
					Name:       "coolUser",
					Provider:   "github",
					Scheme:     "oauth2",
					SuperAdmin: true,
				},
			},
			id:              "1336",
			wantStatus:      http.StatusUnauthorized,
			wantContentType: "application/json",
			wantBody:        `{"code":401,"message":"user cannot modify their own SuperAdmin status"}`,
		},
		{
			name: "Update a SuperAdmin's Roles - without super admin context",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				OrganizationsStore: &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						switch *q.ID {
						case "1":
							return &cloudhub.Organization{
								ID:          "1",
								Name:        "org",
								DefaultRole: roles.ViewerRoleName,
							}, nil
						}
						return nil, fmt.Errorf("org not found")
					},
				},
				UsersStore: &mocks.UsersStore{
					UpdateF: func(ctx context.Context, user *cloudhub.User) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						switch *q.ID {
						case 1336:
							return &cloudhub.User{
								ID:         1336,
								Name:       "bobbetta",
								Provider:   "github",
								Scheme:     "oauth2",
								SuperAdmin: true,
								Roles: []cloudhub.Role{
									{
										Name:         roles.EditorRoleName,
										Organization: "1",
									},
								},
							}, nil
						default:
							return nil, fmt.Errorf("User with ID %d not found", *q.ID)
						}
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url",
					nil,
				),
				user: &userRequest{
					ID:         1336,
					SuperAdmin: true,
					Roles: []cloudhub.Role{
						{
							Name:         roles.AdminRoleName,
							Organization: "1",
						},
					},
				},
				userKeyUser: &cloudhub.User{
					ID:         0,
					Name:       "coolUser",
					Provider:   "github",
					Scheme:     "oauth2",
					SuperAdmin: false,
				},
			},
			id:              "1336",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"links":{"self":"/cloudhub/v1/users/1336"},"id":"1336","name":"bobbetta","provider":"github","scheme":"oauth2","superAdmin":true,"roles":[{"name":"admin","organization":"1"}]}`,
		},
		{
			name: "Update a CloudHub user to super admin - without super admin context",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				OrganizationsStore: &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						switch *q.ID {
						case "1":
							return &cloudhub.Organization{
								ID:          "1",
								Name:        "org",
								DefaultRole: roles.ViewerRoleName,
							}, nil
						}
						return nil, fmt.Errorf("org not found")
					},
				},
				UsersStore: &mocks.UsersStore{
					UpdateF: func(ctx context.Context, user *cloudhub.User) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						switch *q.ID {
						case 1336:
							return &cloudhub.User{
								ID:       1336,
								Name:     "bobbetta",
								Provider: "github",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									roles.EditorRole,
								},
							}, nil
						default:
							return nil, fmt.Errorf("User with ID %d not found", *q.ID)
						}
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url",
					nil,
				),
				user: &userRequest{
					ID:         1336,
					SuperAdmin: true,
					Roles: []cloudhub.Role{
						{
							Name:         roles.AdminRoleName,
							Organization: "1",
						},
					},
				},
				userKeyUser: &cloudhub.User{
					ID:         0,
					Name:       "coolUser",
					Provider:   "github",
					Scheme:     "oauth2",
					SuperAdmin: false,
				},
			},
			id:              "1336",
			wantStatus:      http.StatusUnauthorized,
			wantContentType: "application/json",
			wantBody:        `{"code":401,"message":"User does not have authorization required to set SuperAdmin status. See https://github.com/influxdata/cloudhub/issues/2601 for more information."}`,
		},
		{
			name: "Update a CloudHub user to super admin - with super admin context",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				OrganizationsStore: &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						switch *q.ID {
						case "1":
							return &cloudhub.Organization{
								ID:          "1",
								Name:        "org",
								DefaultRole: roles.ViewerRoleName,
							}, nil
						}
						return nil, fmt.Errorf("org not found")
					},
				},
				UsersStore: &mocks.UsersStore{
					UpdateF: func(ctx context.Context, user *cloudhub.User) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						switch *q.ID {
						case 1336:
							return &cloudhub.User{
								ID:       1336,
								Name:     "bobbetta",
								Provider: "github",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									roles.EditorRole,
								},
							}, nil
						default:
							return nil, fmt.Errorf("User with ID %d not found", *q.ID)
						}
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"PATCH",
					"http://any.url",
					nil,
				),
				user: &userRequest{
					ID:         1336,
					SuperAdmin: true,
					Roles: []cloudhub.Role{
						{
							Name:         roles.AdminRoleName,
							Organization: "1",
						},
					},
				},
				userKeyUser: &cloudhub.User{
					ID:         0,
					Name:       "coolUser",
					Provider:   "github",
					Scheme:     "oauth2",
					SuperAdmin: true,
				},
			},
			id:              "1336",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"id":"1336","superAdmin":true,"name":"bobbetta","provider":"github","scheme":"oauth2","links":{"self":"/cloudhub/v1/users/1336"},"roles":[{"name":"admin","organization":"1"}]}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					UsersStore:         tt.fields.UsersStore,
					OrganizationsStore: tt.fields.OrganizationsStore,
				},
				Logger: tt.fields.Logger,
			}

			tt.args.r = tt.args.r.WithContext(httprouter.WithParams(context.Background(),
				httprouter.Params{
					{
						Key:   "id",
						Value: tt.id,
					},
				}))
			buf, _ := json.Marshal(tt.args.user)
			tt.args.r.Body = ioutil.NopCloser(bytes.NewReader(buf))

			ctx := tt.args.r.Context()
			if tt.args.userKeyUser != nil {
				ctx = context.WithValue(ctx, UserContextKey, tt.args.userKeyUser)
			}

			tt.args.r = tt.args.r.WithContext(ctx)

			s.UpdateUser(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. UpdateUser() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. UpdateUser() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. UpdateUser()\ngot:%v\n,\nwant:%v", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestService_Users(t *testing.T) {
	type fields struct {
		UsersStore cloudhub.UsersStore
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
		wantStatus      int
		wantContentType string
		wantBody        string
	}{
		{
			name: "Get all CloudHub users",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				UsersStore: &mocks.UsersStore{
					AllF: func(ctx context.Context) ([]cloudhub.User, error) {
						return []cloudhub.User{
							{
								ID:       1337,
								Name:     "billysteve",
								Provider: "google",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									roles.EditorRole,
								},
							},
							{
								ID:       1338,
								Name:     "bobbettastuhvetta",
								Provider: "auth0",
								Scheme:   "oauth2",
							},
						}, nil
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
			},
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"users":[{"id":"1337","superAdmin":false,"name":"billysteve","provider":"google","scheme":"oauth2","roles":[{"name":"editor"}],"links":{"self":"/cloudhub/v1/users/1337"}},{"id":"1338","superAdmin":false,"name":"bobbettastuhvetta","provider":"auth0","scheme":"oauth2","roles":[],"links":{"self":"/cloudhub/v1/users/1338"}}],"links":{"self":"/cloudhub/v1/users"}}`,
		},
		{
			name: "Get all CloudHub users, ensuring order of users in response",
			fields: fields{
				Logger: log.New(log.DebugLevel),
				UsersStore: &mocks.UsersStore{
					AllF: func(ctx context.Context) ([]cloudhub.User, error) {
						return []cloudhub.User{
							{
								ID:       1338,
								Name:     "bobbettastuhvetta",
								Provider: "auth0",
								Scheme:   "oauth2",
							},
							{
								ID:       1337,
								Name:     "billysteve",
								Provider: "google",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									roles.EditorRole,
								},
							},
						}, nil
					},
				},
			},
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url", // can be any valid URL as we are bypassing mux
					nil,
				),
			},
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody:        `{"users":[{"id":"1337","superAdmin":false,"name":"billysteve","provider":"google","scheme":"oauth2","roles":[{"name":"editor"}],"links":{"self":"/cloudhub/v1/users/1337"}},{"id":"1338","superAdmin":false,"name":"bobbettastuhvetta","provider":"auth0","scheme":"oauth2","roles":[],"links":{"self":"/cloudhub/v1/users/1338"}}],"links":{"self":"/cloudhub/v1/users"}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					UsersStore: tt.fields.UsersStore,
				},
				Logger: tt.fields.Logger,
			}

			s.Users(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. Users() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. Users() = %v, want %v", tt.name, content, tt.wantContentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wantBody); tt.wantBody != "" && !eq {
				t.Errorf("%q. Users() = \n***%v***\n,\nwant\n***%v***", tt.name, string(body), tt.wantBody)
			}
		})
	}
}

func TestUserRequest_ValidCreate(t *testing.T) {
	type args struct {
		u *userRequest
	}
	tests := []struct {
		name    string
		args    args
		wantErr bool
		err     error
	}{
		{
			name: "Valid",
			args: args{
				u: &userRequest{
					ID:       1337,
					Name:     "billietta",
					Provider: "auth0",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Name:         roles.EditorRoleName,
							Organization: "1",
						},
					},
				},
			},
			wantErr: false,
			err:     nil,
		},
		{
			name: "Invalid – Name missing",
			args: args{
				u: &userRequest{
					ID:       1337,
					Provider: "auth0",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Name:         roles.EditorRoleName,
							Organization: "1",
						},
					},
				},
			},
			wantErr: true,
			err:     fmt.Errorf("Name required on CloudHub User request body"),
		},
		{
			name: "Invalid – Provider missing",
			args: args{
				u: &userRequest{
					ID:     1337,
					Name:   "billietta",
					Scheme: "oauth2",
					Roles: []cloudhub.Role{
						{
							Name:         roles.EditorRoleName,
							Organization: "1",
						},
					},
				},
			},
			wantErr: true,
			err:     fmt.Errorf("Provider required on CloudHub User request body"),
		},
		{
			name: "Invalid – Scheme missing",
			args: args{
				u: &userRequest{
					ID:       1337,
					Name:     "billietta",
					Provider: "auth0",
					Roles: []cloudhub.Role{
						{
							Name:         roles.EditorRoleName,
							Organization: "1",
						},
					},
				},
			},
			wantErr: true,
			err:     fmt.Errorf("Scheme required on CloudHub User request body"),
		},
		{
			name: "Invalid roles - bad role name",
			args: args{
				u: &userRequest{
					ID:       1337,
					Name:     "billietta",
					Provider: "auth0",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Name:         "BilliettaSpecialRole",
							Organization: "1",
						},
					},
				},
			},
			wantErr: true,
			err:     fmt.Errorf("Unknown role BilliettaSpecialRole. Valid roles are 'member', 'viewer', 'editor', 'admin', and '*'"),
		},
		{
			name: "Invalid roles - missing organization",
			args: args{
				u: &userRequest{
					ID:       1337,
					Name:     "billietta",
					Provider: "auth0",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Name: roles.EditorRoleName,
						},
					},
				},
			},
			wantErr: true,
			err:     fmt.Errorf("no organization was provided"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.args.u.ValidCreate()

			if tt.wantErr {
				if err == nil || err.Error() != tt.err.Error() {
					t.Errorf("%q. ValidCreate(): wantErr %v,\nwant %v,\ngot %v", tt.name, tt.wantErr, tt.err, err)
				}
			} else {
				if err != nil {
					t.Errorf("%q. ValidCreate(): wantErr %v,\nwant %v,\ngot %v", tt.name, tt.wantErr, tt.err, err)
				}
			}
		})
	}
}

func TestUserRequest_ValidUpdate(t *testing.T) {
	type args struct {
		u *userRequest
	}
	tests := []struct {
		name    string
		args    args
		wantErr bool
		err     error
	}{
		{
			name: "Valid",
			args: args{
				u: &userRequest{
					ID: 1337,
					Roles: []cloudhub.Role{
						{
							Name:         roles.EditorRoleName,
							Organization: "1",
						},
					},
				},
			},
			wantErr: false,
			err:     nil,
		},
		{
			name: "Invalid – roles missing",
			args: args{
				u: &userRequest{},
			},
			wantErr: true,
			err:     fmt.Errorf("No Roles to update"),
		},
		{
			name: "Invalid - bad role name",
			args: args{
				u: &userRequest{
					ID:       1337,
					Name:     "billietta",
					Provider: "auth0",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Name:         "BillietaSpecialOrg",
							Organization: "0",
						},
					},
				},
			},
			wantErr: true,
			err:     fmt.Errorf("Unknown role BillietaSpecialOrg. Valid roles are 'member', 'viewer', 'editor', 'admin', and '*'"),
		},
		{
			name: "Valid – roles empty",
			args: args{
				u: &userRequest{
					ID:       1337,
					Name:     "billietta",
					Provider: "auth0",
					Scheme:   "oauth2",
					Roles:    []cloudhub.Role{},
				},
			},
			wantErr: false,
		},
		{
			name: "Invalid - bad role name",
			args: args{
				u: &userRequest{
					ID:       1337,
					Name:     "billietta",
					Provider: "auth0",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Name:         "BillietaSpecialOrg",
							Organization: "0",
						},
					},
				},
			},
			wantErr: true,
			err:     fmt.Errorf("Unknown role BillietaSpecialOrg. Valid roles are 'member', 'viewer', 'editor', 'admin', and '*'"),
		},
		{
			name: "Invalid - duplicate organization",
			args: args{
				u: &userRequest{
					ID:       1337,
					Name:     "billietta",
					Provider: "auth0",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Name:         roles.AdminRoleName,
							Organization: "0",
						},
						{
							Name:         roles.ViewerRoleName,
							Organization: "0",
						},
					},
				},
			},
			wantErr: true,
			err:     fmt.Errorf("duplicate organization \"0\" in roles"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.args.u.ValidUpdate()

			if tt.wantErr {
				if err == nil || err.Error() != tt.err.Error() {
					t.Errorf("%q. ValidUpdate(): wantErr %v,\nwant %v,\ngot %v", tt.name, tt.wantErr, tt.err, err)
				}
			} else {
				if err != nil {
					t.Errorf("%q. ValidUpdate(): wantErr %v,\nwant %v,\ngot %v", tt.name, tt.wantErr, tt.err, err)
				}
			}
		})
	}
}
