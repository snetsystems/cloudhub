package organizations_test

import (
	"context"
	"fmt"
	"testing"

	gocmp "github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

// IgnoreFields is used because ID cannot be predicted reliably
// EquateEmpty is used because we want nil slices, arrays, and maps to be equal to the empty map
var serverCloudHubOptions = gocmp.Options{
	cmpopts.EquateEmpty(),
	cmpopts.IgnoreFields(cloudhub.Server{}, "ID"),
	cmpopts.IgnoreFields(cloudhub.Server{}, "Active"),
}

func TestServers_All(t *testing.T) {
	type fields struct {
		ServersStore cloudhub.ServersStore
	}
	type args struct {
		organization string
		ctx          context.Context
	}
	tests := []struct {
		name    string
		args    args
		fields  fields
		want    []cloudhub.Server
		wantRaw []cloudhub.Server
		wantErr bool
	}{
		{
			name: "No Servers",
			fields: fields{
				ServersStore: &mocks.ServersStore{
					AllF: func(ctx context.Context) ([]cloudhub.Server, error) {
						return nil, fmt.Errorf("No Servers")
					},
				},
			},
			wantErr: true,
		},
		{
			name: "All Servers",
			fields: fields{
				ServersStore: &mocks.ServersStore{
					AllF: func(ctx context.Context) ([]cloudhub.Server, error) {
						return []cloudhub.Server{
							{
								Name:         "howdy",
								Organization: "1337",
							},
							{
								Name:         "doody",
								Organization: "1338",
							},
						}, nil
					},
				},
			},
			args: args{
				organization: "1337",
				ctx:          context.Background(),
			},
			want: []cloudhub.Server{
				{
					Name:         "howdy",
					Organization: "1337",
				},
			},
		},
	}
	for _, tt := range tests {
		s := organizations.NewServersStore(tt.fields.ServersStore, tt.args.organization)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organization)
		gots, err := s.All(tt.args.ctx)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. ServersStore.All() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		for i, got := range gots {
			if diff := gocmp.Diff(got, tt.want[i], serverCloudHubOptions...); diff != "" {
				t.Errorf("%q. ServersStore.All():\n-got/+want\ndiff %s", tt.name, diff)
			}
		}
	}
}

func TestServers_Add(t *testing.T) {
	type fields struct {
		ServersStore cloudhub.ServersStore
	}
	type args struct {
		organization string
		ctx          context.Context
		server       cloudhub.Server
	}
	tests := []struct {
		name    string
		args    args
		fields  fields
		want    cloudhub.Server
		wantErr bool
	}{
		{
			name: "Add Server",
			fields: fields{
				ServersStore: &mocks.ServersStore{
					AddF: func(ctx context.Context, s cloudhub.Server) (cloudhub.Server, error) {
						return s, nil
					},
					GetF: func(ctx context.Context, id int) (cloudhub.Server, error) {
						return cloudhub.Server{
							ID:           1229,
							Name:         "howdy",
							Organization: "1337",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.Server, error) {
						return []cloudhub.Server{}, nil
					},
				},
			},
			args: args{
				organization: "1337",
				ctx:          context.Background(),
				server: cloudhub.Server{
					ID:   1229,
					Name: "howdy",
				},
			},
			want: cloudhub.Server{
				Name:         "howdy",
				Organization: "1337",
			},
		},
	}
	for _, tt := range tests {
		s := organizations.NewServersStore(tt.fields.ServersStore, tt.args.organization)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organization)
		d, err := s.Add(tt.args.ctx, tt.args.server)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. ServersStore.Add() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		got, err := s.Get(tt.args.ctx, d.ID)
		if diff := gocmp.Diff(got, tt.want, serverCloudHubOptions...); diff != "" {
			t.Errorf("%q. ServersStore.Add():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}

func TestServers_Delete(t *testing.T) {
	type fields struct {
		ServersStore cloudhub.ServersStore
	}
	type args struct {
		organization string
		ctx          context.Context
		server       cloudhub.Server
	}
	tests := []struct {
		name     string
		fields   fields
		args     args
		want     []cloudhub.Server
		addFirst bool
		wantErr  bool
	}{
		{
			name: "Delete server",
			fields: fields{
				ServersStore: &mocks.ServersStore{
					DeleteF: func(ctx context.Context, s cloudhub.Server) error {
						return nil
					},
					GetF: func(ctx context.Context, id int) (cloudhub.Server, error) {
						return cloudhub.Server{
							ID:           1229,
							Name:         "howdy",
							Organization: "1337",
						}, nil
					},
				},
			},
			args: args{
				organization: "1337",
				ctx:          context.Background(),
				server: cloudhub.Server{
					ID:           1229,
					Name:         "howdy",
					Organization: "1337",
				},
			},
			addFirst: true,
		},
	}
	for _, tt := range tests {
		s := organizations.NewServersStore(tt.fields.ServersStore, tt.args.organization)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organization)
		err := s.Delete(tt.args.ctx, tt.args.server)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. ServersStore.All() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
	}
}

func TestServers_Get(t *testing.T) {
	type fields struct {
		ServersStore cloudhub.ServersStore
	}
	type args struct {
		organization string
		ctx          context.Context
		server       cloudhub.Server
	}
	tests := []struct {
		name     string
		fields   fields
		args     args
		want     cloudhub.Server
		addFirst bool
		wantErr  bool
	}{
		{
			name: "Get Server",
			fields: fields{
				ServersStore: &mocks.ServersStore{
					GetF: func(ctx context.Context, id int) (cloudhub.Server, error) {
						return cloudhub.Server{
							ID:           1229,
							Name:         "howdy",
							Organization: "1337",
						}, nil
					},
				},
			},
			args: args{
				organization: "1337",
				ctx:          context.Background(),
				server: cloudhub.Server{
					ID:           1229,
					Name:         "howdy",
					Organization: "1337",
				},
			},
			want: cloudhub.Server{
				ID:           1229,
				Name:         "howdy",
				Organization: "1337",
			},
		},
	}
	for _, tt := range tests {
		s := organizations.NewServersStore(tt.fields.ServersStore, tt.args.organization)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organization)
		got, err := s.Get(tt.args.ctx, tt.args.server.ID)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. ServersStore.Get() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		if diff := gocmp.Diff(got, tt.want, serverCloudHubOptions...); diff != "" {
			t.Errorf("%q. ServersStore.Get():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}

func TestServers_Update(t *testing.T) {
	type fields struct {
		ServersStore cloudhub.ServersStore
	}
	type args struct {
		organization string
		ctx          context.Context
		server       cloudhub.Server
		name         string
	}
	tests := []struct {
		name     string
		fields   fields
		args     args
		want     cloudhub.Server
		addFirst bool
		wantErr  bool
	}{
		{
			name: "Update Server Name",
			fields: fields{
				ServersStore: &mocks.ServersStore{
					UpdateF: func(ctx context.Context, s cloudhub.Server) error {
						return nil
					},
					GetF: func(ctx context.Context, id int) (cloudhub.Server, error) {
						return cloudhub.Server{
							ID:           1229,
							Name:         "doody",
							Organization: "1337",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.Server, error) {
						return []cloudhub.Server{}, nil
					},
				},
			},
			args: args{
				organization: "1337",
				ctx:          context.Background(),
				server: cloudhub.Server{
					ID:           1229,
					Name:         "howdy",
					Organization: "1337",
				},
				name: "doody",
			},
			want: cloudhub.Server{
				Name:         "doody",
				Organization: "1337",
			},
			addFirst: true,
		},
	}
	for _, tt := range tests {
		if tt.args.name != "" {
			tt.args.server.Name = tt.args.name
		}
		s := organizations.NewServersStore(tt.fields.ServersStore, tt.args.organization)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organization)
		err := s.Update(tt.args.ctx, tt.args.server)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. ServersStore.Update() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		got, err := s.Get(tt.args.ctx, tt.args.server.ID)
		if diff := gocmp.Diff(got, tt.want, serverCloudHubOptions...); diff != "" {
			t.Errorf("%q. ServersStore.Update():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}
