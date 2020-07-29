package organizations_test

import (
	"context"
	"testing"

	gocmp "github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

// IgnoreFields is used because ID cannot be predicted reliably
// EquateEmpty is used because we want nil slices, arrays, and maps to be equal to the empty map
var userCloudHubOptions = gocmp.Options{
	cmpopts.IgnoreFields(cloudhub.User{}, "ID"),
	cmpopts.EquateEmpty(),
}

func TestUsersStore_Get(t *testing.T) {
	type fields struct {
		UsersStore cloudhub.UsersStore
	}
	type args struct {
		ctx    context.Context
		usr    *cloudhub.User
		userID uint64
		orgID  string
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		want    *cloudhub.User
		wantErr bool
	}{
		{
			name: "Get user with no role in organization",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						return &cloudhub.User{
							ID:       1234,
							Name:     "billietta",
							Provider: "google",
							Scheme:   "oauth2",
							Roles: []cloudhub.Role{
								{
									Organization: "1338",
									Name:         "The HillBilliettas",
								},
							},
						}, nil
					},
				},
			},
			args: args{
				ctx:    context.Background(),
				userID: 1234,
				orgID:  "1336",
			},
			wantErr: true,
		},
		{
			name: "Get user no organization set",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						return &cloudhub.User{
							ID:       1234,
							Name:     "billietta",
							Provider: "google",
							Scheme:   "oauth2",
							Roles: []cloudhub.Role{
								{
									Organization: "1338",
									Name:         "The HillBilliettas",
								},
							},
						}, nil
					},
				},
			},
			args: args{
				userID: 1234,
				ctx:    context.Background(),
			},
			wantErr: true,
		},
		{
			name: "Get user scoped to an organization",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						return &cloudhub.User{
							ID:       1234,
							Name:     "billietta",
							Provider: "google",
							Scheme:   "oauth2",
							Roles: []cloudhub.Role{
								{
									Organization: "1338",
									Name:         "The HillBilliettas",
								},
								{
									Organization: "1336",
									Name:         "The BillHilliettos",
								},
							},
						}, nil
					},
				},
			},
			args: args{
				ctx:    context.Background(),
				userID: 1234,
				orgID:  "1336",
			},
			want: &cloudhub.User{
				Name:     "billietta",
				Provider: "google",
				Scheme:   "oauth2",
				Roles: []cloudhub.Role{
					{
						Organization: "1336",
						Name:         "The BillHilliettos",
					},
				},
			},
		},
	}
	for _, tt := range tests {
		s := organizations.NewUsersStore(tt.fields.UsersStore, tt.args.orgID)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.orgID)
		got, err := s.Get(tt.args.ctx, cloudhub.UserQuery{ID: &tt.args.userID})
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. UsersStore.Get() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		if diff := gocmp.Diff(got, tt.want, userCloudHubOptions...); diff != "" {
			t.Errorf("%q. UsersStore.Get():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}

func TestUsersStore_Add(t *testing.T) {
	type fields struct {
		UsersStore cloudhub.UsersStore
	}
	type args struct {
		ctx      context.Context
		u        *cloudhub.User
		orgID    string
		uInitial *cloudhub.User
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		want    *cloudhub.User
		wantErr bool
	}{
		{
			name: "Add new user - no org",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, u *cloudhub.User) (*cloudhub.User, error) {
						return u, nil
					},
				},
			},
			args: args{
				ctx: context.Background(),
				u: &cloudhub.User{
					ID:       1234,
					Name:     "docbrown",
					Provider: "github",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Organization: "1336",
							Name:         "editor",
						},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "Add new user",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, u *cloudhub.User) (*cloudhub.User, error) {
						return u, nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						return nil, cloudhub.ErrUserNotFound
					},
				},
			},
			args: args{
				ctx: context.Background(),
				u: &cloudhub.User{
					ID:       1234,
					Name:     "docbrown",
					Provider: "github",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Organization: "1336",
							Name:         "editor",
						},
					},
				},
				orgID: "1336",
			},
			want: &cloudhub.User{
				ID:       1234,
				Name:     "docbrown",
				Provider: "github",
				Scheme:   "oauth2",
				Roles: []cloudhub.Role{
					{
						Organization: "1336",
						Name:         "editor",
					},
				},
			},
		},
		{
			name: "Add non-new user without Role",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, u *cloudhub.User) (*cloudhub.User, error) {
						return u, nil
					},
					UpdateF: func(ctx context.Context, u *cloudhub.User) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						return &cloudhub.User{
							ID:       1234,
							Name:     "docbrown",
							Provider: "github",
							Scheme:   "oauth2",
							Roles:    []cloudhub.Role{},
						}, nil
					},
				},
			},
			args: args{
				ctx: context.Background(),
				u: &cloudhub.User{
					ID:       1234,
					Name:     "docbrown",
					Provider: "github",
					Scheme:   "oauth2",
					Roles:    []cloudhub.Role{},
				},
				orgID: "1336",
			},
			want: &cloudhub.User{
				Name:     "docbrown",
				Provider: "github",
				Scheme:   "oauth2",
				Roles:    []cloudhub.Role{},
			},
		},
		{
			name: "Add non-new user with Role",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, u *cloudhub.User) (*cloudhub.User, error) {
						return u, nil
					},
					UpdateF: func(ctx context.Context, u *cloudhub.User) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						return &cloudhub.User{
							ID:       1234,
							Name:     "docbrown",
							Provider: "github",
							Scheme:   "oauth2",
							Roles: []cloudhub.Role{
								{
									Organization: "1337",
									Name:         "editor",
								},
							},
						}, nil
					},
				},
			},
			args: args{
				ctx: context.Background(),
				u: &cloudhub.User{
					ID:       1234,
					Name:     "docbrown",
					Provider: "github",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Organization: "1336",
							Name:         "admin",
						},
					},
				},
				orgID: "1336",
			},
			want: &cloudhub.User{
				Name:     "docbrown",
				Provider: "github",
				Scheme:   "oauth2",
				Roles: []cloudhub.Role{
					{
						Organization: "1336",
						Name:         "admin",
					},
				},
			},
		},
		{
			name: "Add non-new user with Role. Stored user is not super admin. Provided user is super admin",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, u *cloudhub.User) (*cloudhub.User, error) {
						return u, nil
					},
					UpdateF: func(ctx context.Context, u *cloudhub.User) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						return &cloudhub.User{
							ID:         1234,
							Name:       "docbrown",
							Provider:   "github",
							Scheme:     "oauth2",
							SuperAdmin: false,
							Roles: []cloudhub.Role{
								{
									Organization: "1337",
									Name:         "editor",
								},
							},
						}, nil
					},
				},
			},
			args: args{
				ctx: context.Background(),
				u: &cloudhub.User{
					ID:         1234,
					Name:       "docbrown",
					Provider:   "github",
					Scheme:     "oauth2",
					SuperAdmin: true,
					Roles: []cloudhub.Role{
						{
							Organization: "1336",
							Name:         "admin",
						},
					},
				},
				orgID: "1336",
			},
			want: &cloudhub.User{
				Name:       "docbrown",
				Provider:   "github",
				Scheme:     "oauth2",
				SuperAdmin: true,
				Roles: []cloudhub.Role{
					{
						Organization: "1336",
						Name:         "admin",
					},
				},
			},
		},
		{
			name: "Add user that already exists",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, u *cloudhub.User) (*cloudhub.User, error) {
						return u, nil
					},
					UpdateF: func(ctx context.Context, u *cloudhub.User) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						return &cloudhub.User{
							ID:       1234,
							Name:     "docbrown",
							Provider: "github",
							Scheme:   "oauth2",
							Roles: []cloudhub.Role{
								{
									Organization: "1337",
									Name:         "editor",
								},
							},
						}, nil
					},
				},
			},
			args: args{
				ctx: context.Background(),
				u: &cloudhub.User{
					ID:       1234,
					Name:     "docbrown",
					Provider: "github",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Organization: "1337",
							Name:         "admin",
						},
					},
				},
				orgID: "1337",
			},
			wantErr: true,
		},
		{
			name: "Has invalid Role: missing Organization",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, u *cloudhub.User) (*cloudhub.User, error) {
						return u, nil
					},
					UpdateF: func(ctx context.Context, u *cloudhub.User) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						return nil, nil
					},
				},
			},
			args: args{
				ctx:   context.Background(),
				orgID: "1338",
				u: &cloudhub.User{
					Name:     "henrietta",
					Provider: "github",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Name: "editor",
						},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "Has invalid Role: missing Name",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					AddF: func(ctx context.Context, u *cloudhub.User) (*cloudhub.User, error) {
						return u, nil
					},
					UpdateF: func(ctx context.Context, u *cloudhub.User) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						return nil, nil
					},
				},
			},
			args: args{
				ctx:   context.Background(),
				orgID: "1337",
				u: &cloudhub.User{
					Name:     "henrietta",
					Provider: "github",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Organization: "1337",
						},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "Has invalid Organization",
			fields: fields{
				UsersStore: &mocks.UsersStore{},
			},
			args: args{
				ctx: context.Background(),
				u: &cloudhub.User{
					Name:     "henrietta",
					Provider: "github",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{},
					},
				},
				orgID: "1337",
			},
			wantErr: true,
		},
		{
			name: "Organization does not match orgID",
			fields: fields{
				UsersStore: &mocks.UsersStore{},
			},
			args: args{
				ctx: context.Background(),
				u: &cloudhub.User{
					Name:     "henrietta",
					Provider: "github",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Organization: "1338",
							Name:         "editor",
						},
					},
				},
				orgID: "1337",
			},
			wantErr: true,
		},
		{
			name: "Role Name not specified",
			args: args{
				ctx: context.Background(),
				u: &cloudhub.User{
					Name:     "henrietta",
					Provider: "github",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Organization: "1337",
						},
					},
				},
				orgID: "1337",
			},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.orgID)
		s := organizations.NewUsersStore(tt.fields.UsersStore, tt.args.orgID)

		got, err := s.Add(tt.args.ctx, tt.args.u)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. UsersStore.Add() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		if got == nil && tt.want == nil {
			continue
		}
		if diff := gocmp.Diff(got, tt.want, userCloudHubOptions...); diff != "" {
			t.Errorf("%q. UsersStore.Add():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}

func TestUsersStore_Delete(t *testing.T) {
	type fields struct {
		UsersStore cloudhub.UsersStore
	}
	type args struct {
		ctx   context.Context
		user  *cloudhub.User
		orgID string
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		wantErr bool
		wantRaw *cloudhub.User
	}{
		{
			name: "No such user",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					//AddF: func(ctx context.Context, u *cloudhub.User) (*cloudhub.User, error) {
					//	return u, nil
					//},
					//UpdateF: func(ctx context.Context, u *cloudhub.User) error {
					//	return nil
					//},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						return nil, cloudhub.ErrUserNotFound
					},
				},
			},
			args: args{
				ctx: context.Background(),
				user: &cloudhub.User{
					ID: 10,
				},
				orgID: "1336",
			},
			wantErr: true,
		},
		{
			name: "Derlete user",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					UpdateF: func(ctx context.Context, u *cloudhub.User) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						return &cloudhub.User{
							ID:   1234,
							Name: "noone",
							Roles: []cloudhub.Role{
								{
									Organization: "1338",
									Name:         "The BillHilliettas",
								},
								{
									Organization: "1336",
									Name:         "The HillBilliettas",
								},
							},
						}, nil
					},
				},
			},
			args: args{
				ctx: context.Background(),
				user: &cloudhub.User{
					ID:   1234,
					Name: "noone",
					Roles: []cloudhub.Role{
						{
							Organization: "1338",
							Name:         "The BillHilliettas",
						},
						{
							Organization: "1336",
							Name:         "The HillBilliettas",
						},
					},
				},
				orgID: "1336",
			},
		},
	}
	for _, tt := range tests {
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.orgID)
		s := organizations.NewUsersStore(tt.fields.UsersStore, tt.args.orgID)
		if err := s.Delete(tt.args.ctx, tt.args.user); (err != nil) != tt.wantErr {
			t.Errorf("%q. UsersStore.Delete() error = %v, wantErr %v", tt.name, err, tt.wantErr)
		}
	}
}

func TestUsersStore_Update(t *testing.T) {
	type fields struct {
		UsersStore cloudhub.UsersStore
	}
	type args struct {
		ctx        context.Context
		usr        *cloudhub.User
		roles      []cloudhub.Role
		superAdmin bool
		orgID      string
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		want    *cloudhub.User
		wantRaw *cloudhub.User
		wantErr bool
	}{
		{
			name: "No such user",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						return nil, cloudhub.ErrUserNotFound
					},
				},
			},
			args: args{
				ctx: context.Background(),
				usr: &cloudhub.User{
					ID: 10,
				},
				orgID: "1338",
			},
			wantErr: true,
		},
		{
			name: "Update user role",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					UpdateF: func(ctx context.Context, u *cloudhub.User) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						return &cloudhub.User{
							Name:     "bobetta",
							Provider: "github",
							Scheme:   "oauth2",
							Roles: []cloudhub.Role{
								{
									Organization: "1337",
									Name:         "viewer",
								},
								{
									Organization: "1338",
									Name:         "editor",
								},
							},
						}, nil
					},
				},
			},
			args: args{
				ctx: context.Background(),
				usr: &cloudhub.User{
					Name:     "bobetta",
					Provider: "github",
					Scheme:   "oauth2",
					Roles:    []cloudhub.Role{},
				},
				roles: []cloudhub.Role{
					{
						Organization: "1338",
						Name:         "editor",
					},
				},
				orgID: "1338",
			},
			want: &cloudhub.User{
				Name:     "bobetta",
				Provider: "github",
				Scheme:   "oauth2",
				Roles: []cloudhub.Role{
					{
						Organization: "1338",
						Name:         "editor",
					},
				},
			},
		},
		{
			name: "Update user super admin",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					UpdateF: func(ctx context.Context, u *cloudhub.User) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.UserQuery) (*cloudhub.User, error) {
						return &cloudhub.User{
							Name:       "bobetta",
							Provider:   "github",
							Scheme:     "oauth2",
							SuperAdmin: false,
							Roles: []cloudhub.Role{
								{
									Organization: "1337",
									Name:         "viewer",
								},
								{
									Organization: "1338",
									Name:         "editor",
								},
							},
						}, nil
					},
				},
			},
			args: args{
				ctx: context.Background(),
				usr: &cloudhub.User{
					Name:     "bobetta",
					Provider: "github",
					Scheme:   "oauth2",
					Roles:    []cloudhub.Role{},
				},
				superAdmin: true,
				orgID:      "1338",
			},
			want: &cloudhub.User{
				Name:       "bobetta",
				Provider:   "github",
				Scheme:     "oauth2",
				SuperAdmin: true,
			},
		},
	}
	for _, tt := range tests {
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.orgID)
		s := organizations.NewUsersStore(tt.fields.UsersStore, tt.args.orgID)

		if tt.args.roles != nil {
			tt.args.usr.Roles = tt.args.roles
		}

		if tt.args.superAdmin {
			tt.args.usr.SuperAdmin = tt.args.superAdmin
		}

		if err := s.Update(tt.args.ctx, tt.args.usr); (err != nil) != tt.wantErr {
			t.Errorf("%q. UsersStore.Update() error = %v, wantErr %v", tt.name, err, tt.wantErr)
		}

		// for the empty test
		if tt.want == nil {
			continue
		}

		if diff := gocmp.Diff(tt.args.usr, tt.want, userCloudHubOptions...); diff != "" {
			t.Errorf("%q. UsersStore.Update():\n-got/+want\ndiff %s", tt.name, diff)
		}

	}
}

func TestUsersStore_All(t *testing.T) {
	type fields struct {
		UsersStore cloudhub.UsersStore
	}
	tests := []struct {
		name    string
		fields  fields
		ctx     context.Context
		want    []cloudhub.User
		wantRaw []cloudhub.User
		orgID   string
		wantErr bool
	}{
		{
			name: "No users",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					AllF: func(ctx context.Context) ([]cloudhub.User, error) {
						return []cloudhub.User{
							{
								Name:     "howdy",
								Provider: "github",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									{
										Organization: "1338",
										Name:         "viewer",
									},
									{
										Organization: "1336",
										Name:         "viewer",
									},
								},
							},
							{
								Name:     "doody2",
								Provider: "github",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									{
										Organization: "1337",
										Name:         "editor",
									},
								},
							},
							{
								Name:     "doody",
								Provider: "github",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									{
										Organization: "1338",
										Name:         "editor",
									},
								},
							},
						}, nil
					},
				},
			},
			ctx:   context.Background(),
			orgID: "2330",
		},
		{
			name:  "get all users",
			orgID: "1338",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					AllF: func(ctx context.Context) ([]cloudhub.User, error) {
						return []cloudhub.User{
							{
								Name:     "howdy",
								Provider: "github",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									{
										Organization: "1338",
										Name:         "viewer",
									},
									{
										Organization: "1336",
										Name:         "viewer",
									},
								},
							},
							{
								Name:     "doody2",
								Provider: "github",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									{
										Organization: "1337",
										Name:         "editor",
									},
								},
							},
							{
								Name:     "doody",
								Provider: "github",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									{
										Organization: "1338",
										Name:         "editor",
									},
								},
							},
						}, nil
					},
				},
			},
			ctx: context.Background(),
			want: []cloudhub.User{
				{
					Name:     "howdy",
					Provider: "github",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Organization: "1338",
							Name:         "viewer",
						},
					},
				},
				{
					Name:     "doody",
					Provider: "github",
					Scheme:   "oauth2",
					Roles: []cloudhub.Role{
						{
							Organization: "1338",
							Name:         "editor",
						},
					},
				},
			},
		},
	}
	for _, tt := range tests {
		tt.ctx = context.WithValue(tt.ctx, organizations.ContextKey, tt.orgID)
		for _, u := range tt.wantRaw {
			tt.fields.UsersStore.Add(tt.ctx, &u)
		}
		s := organizations.NewUsersStore(tt.fields.UsersStore, tt.orgID)
		gots, err := s.All(tt.ctx)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. UsersStore.All() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		if diff := gocmp.Diff(gots, tt.want, userCloudHubOptions...); diff != "" {
			t.Errorf("%q. UsersStore.All():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}

func TestUsersStore_Num(t *testing.T) {
	type fields struct {
		UsersStore cloudhub.UsersStore
	}
	tests := []struct {
		name    string
		fields  fields
		ctx     context.Context
		orgID   string
		want    int
		wantErr bool
	}{
		{
			name: "No users",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					AllF: func(ctx context.Context) ([]cloudhub.User, error) {
						return []cloudhub.User{
							{
								Name:     "howdy",
								Provider: "github",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									{
										Organization: "1338",
										Name:         "viewer",
									},
									{
										Organization: "1336",
										Name:         "viewer",
									},
								},
							},
							{
								Name:     "doody2",
								Provider: "github",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									{
										Organization: "1337",
										Name:         "editor",
									},
								},
							},
							{
								Name:     "doody",
								Provider: "github",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									{
										Organization: "1338",
										Name:         "editor",
									},
								},
							},
						}, nil
					},
				},
			},
			ctx:   context.Background(),
			orgID: "2330",
		},
		{
			name:  "get all users",
			orgID: "1338",
			fields: fields{
				UsersStore: &mocks.UsersStore{
					AllF: func(ctx context.Context) ([]cloudhub.User, error) {
						return []cloudhub.User{
							{
								Name:     "howdy",
								Provider: "github",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									{
										Organization: "1338",
										Name:         "viewer",
									},
									{
										Organization: "1336",
										Name:         "viewer",
									},
								},
							},
							{
								Name:     "doody2",
								Provider: "github",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									{
										Organization: "1337",
										Name:         "editor",
									},
								},
							},
							{
								Name:     "doody",
								Provider: "github",
								Scheme:   "oauth2",
								Roles: []cloudhub.Role{
									{
										Organization: "1338",
										Name:         "editor",
									},
								},
							},
						}, nil
					},
				},
			},
			ctx:  context.Background(),
			want: 2,
		},
	}
	for _, tt := range tests {
		tt.ctx = context.WithValue(tt.ctx, organizations.ContextKey, tt.orgID)
		s := organizations.NewUsersStore(tt.fields.UsersStore, tt.orgID)
		got, err := s.Num(tt.ctx)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. UsersStore.Num() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		if got != tt.want {
			t.Errorf("%q. UsersStore.Num() = %d. want %d", tt.name, got, tt.want)
		}
	}
}
