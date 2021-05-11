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
var vsphereCloudHubOptions = gocmp.Options{
	cmpopts.EquateEmpty(),
	cmpopts.IgnoreFields(cloudhub.Vsphere{}, "ID"),
}

func TestVspheres_All(t *testing.T) {
	type fields struct {
		VspheresStore cloudhub.VspheresStore
	}
	type args struct {
		organization string
		ctx          context.Context
	}
	tests := []struct {
		name    string
		args    args
		fields  fields
		want    []cloudhub.Vsphere
		wantRaw []cloudhub.Vsphere
		wantErr bool
	}{
		{
			name: "No Vspheres",
			fields: fields{
				VspheresStore: &mocks.VspheresStore{
					AllF: func(ctx context.Context) ([]cloudhub.Vsphere, error) {
						return nil, fmt.Errorf("No Vspheres")
					},
				},
			},
			wantErr: true,
		},
		{
			name: "All Vspheres",
			fields: fields{
				VspheresStore: &mocks.VspheresStore{
					AllF: func(ctx context.Context) ([]cloudhub.Vsphere, error) {
						return []cloudhub.Vsphere{
							{
								Host:         "1.1.1.1",
								Organization: "1337",
								DataSource: "45",
							},
							{
								Host:         "2.2.2.2",
								Organization: "1338",
								DataSource: "88",
							},
						}, nil
					},
				},
			},
			args: args{
				organization: "1337",
				ctx:          context.Background(),
			},
			want: []cloudhub.Vsphere{
				{
					Host:         "1.1.1.1",
					Organization: "1337",
					DataSource: "45",
				},
			},
		},
	}
	for _, tt := range tests {
		s := organizations.NewVspheresStore(tt.fields.VspheresStore, tt.args.organization)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organization)
		gots, err := s.All(tt.args.ctx)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. VspheresStore.All() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		for i, got := range gots {
			if diff := gocmp.Diff(got, tt.want[i], vsphereCloudHubOptions...); diff != "" {
				t.Errorf("%q. VspheresStore.All():\n-got/+want\ndiff %s", tt.name, diff)
			}
		}
	}
}

func TestVspheres_Add(t *testing.T) {
	type fields struct {
		VspheresStore cloudhub.VspheresStore
	}
	type args struct {
		organization string
		ctx          context.Context
		vsphere      cloudhub.Vsphere
	}
	tests := []struct {
		name    string
		args    args
		fields  fields
		want    cloudhub.Vsphere
		wantErr bool
	}{
		{
			name: "Add Vsphere",
			fields: fields{
				VspheresStore: &mocks.VspheresStore{
					AddF: func(ctx context.Context, s cloudhub.Vsphere) (cloudhub.Vsphere, error) {
						return s, nil
					},
					GetF: func(ctx context.Context, id string) (cloudhub.Vsphere, error) {
						return cloudhub.Vsphere{
							ID:           "1229",
							Host:         "1.1.1.1",
							Organization: "1337",
							DataSource: "45",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.Vsphere, error) {
						return []cloudhub.Vsphere{}, nil
					},
				},
			},
			args: args{
				organization: "1337",
				ctx:          context.Background(),
				vsphere: cloudhub.Vsphere{
					ID:   "1229",
					Host: "1.1.1.1",
					DataSource: "45",
				},
			},
			want: cloudhub.Vsphere{
				Host:         "1.1.1.1",
				Organization: "1337",
				DataSource: "45",
			},
		},
	}
	for _, tt := range tests {
		s := organizations.NewVspheresStore(tt.fields.VspheresStore, tt.args.organization)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organization)
		d, err := s.Add(tt.args.ctx, tt.args.vsphere)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. VspheresStore.Add() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		got, err := s.Get(tt.args.ctx, d.ID)
		if diff := gocmp.Diff(got, tt.want, vsphereCloudHubOptions...); diff != "" {
			t.Errorf("%q. VspheresStore.Add():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}

func TestVspheres_Delete(t *testing.T) {
	type fields struct {
		VspheresStore cloudhub.VspheresStore
	}
	type args struct {
		organization string
		ctx          context.Context
		vsphere      cloudhub.Vsphere
	}
	tests := []struct {
		name     string
		fields   fields
		args     args
		want     []cloudhub.Vsphere
		addFirst bool
		wantErr  bool
	}{
		{
			name: "Delete vsphere",
			fields: fields{
				VspheresStore: &mocks.VspheresStore{
					DeleteF: func(ctx context.Context, s cloudhub.Vsphere) error {
						return nil
					},
					GetF: func(ctx context.Context, id string) (cloudhub.Vsphere, error) {
						return cloudhub.Vsphere{
							ID:           "1229",
							Host:         "1.1.1.1",
							Organization: "1337",
							DataSource: "45",
						}, nil
					},
				},
			},
			args: args{
				organization: "1337",
				ctx:          context.Background(),
				vsphere: cloudhub.Vsphere{
					ID:           "1229",
					Host:         "1.1.1.1",
					Organization: "1337",
					DataSource: "45",
				},
			},
			addFirst: true,
		},
	}
	for _, tt := range tests {
		s := organizations.NewVspheresStore(tt.fields.VspheresStore, tt.args.organization)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organization)
		err := s.Delete(tt.args.ctx, tt.args.vsphere)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. VspheresStore.All() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
	}
}

func TestVspheres_Get(t *testing.T) {
	type fields struct {
		VspheresStore cloudhub.VspheresStore
	}
	type args struct {
		organization string
		ctx          context.Context
		vsphere      cloudhub.Vsphere
	}
	tests := []struct {
		name     string
		fields   fields
		args     args
		want     cloudhub.Vsphere
		addFirst bool
		wantErr  bool
	}{
		{
			name: "Get Server",
			fields: fields{
				VspheresStore: &mocks.VspheresStore{
					GetF: func(ctx context.Context, id string) (cloudhub.Vsphere, error) {
						return cloudhub.Vsphere{
							ID:           "1229",
							Host:         "1.1.1.1",
							Organization: "1337",
							DataSource: "45",
						}, nil
					},
				},
			},
			args: args{
				organization: "1337",
				ctx:          context.Background(),
				vsphere: cloudhub.Vsphere{
					ID:           "1229",
					Host:         "1.1.1.1",
					Organization: "1337",
					DataSource: "45",
				},
			},
			want: cloudhub.Vsphere{
				ID:           "1229",
				Host:         "1.1.1.1",
				Organization: "1337",
				DataSource: "45",
			},
		},
	}
	for _, tt := range tests {
		s := organizations.NewVspheresStore(tt.fields.VspheresStore, tt.args.organization)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organization)
		got, err := s.Get(tt.args.ctx, tt.args.vsphere.ID)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. VspheresStore.Get() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		if diff := gocmp.Diff(got, tt.want, vsphereCloudHubOptions...); diff != "" {
			t.Errorf("%q. VspheresStore.Get():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}

func TestVspheres_Update(t *testing.T) {
	type fields struct {
		VspheresStore cloudhub.VspheresStore
	}
	type args struct {
		organization string
		ctx          context.Context
		vsphere      cloudhub.Vsphere
		name         string
		datasource   string
	}
	tests := []struct {
		name     string
		fields   fields
		args     args
		want     cloudhub.Vsphere
		addFirst bool
		wantErr  bool
	}{
		{
			name: "Update Vsphere Name and DataSource",
			fields: fields{
				VspheresStore: &mocks.VspheresStore{
					UpdateF: func(ctx context.Context, s cloudhub.Vsphere) error {
						return nil
					},
					GetF: func(ctx context.Context, id string) (cloudhub.Vsphere, error) {
						return cloudhub.Vsphere{
							ID:           "1229",
							UserName:     "test@vmware.com",
							Host:         "1.1.1.1",
							Organization: "1337",
							DataSource: "45",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.Vsphere, error) {
						return []cloudhub.Vsphere{}, nil
					},
				},
			},
			args: args{
				organization: "1337",

				ctx:          context.Background(),
				vsphere: cloudhub.Vsphere{
					ID:           "1229",
					UserName:     "asdfsdfasdf@vmware.com",
					Host:         "1.1.1.1",
					Organization: "1337",
					DataSource: "35",
				},
				name: "test@vmware.com",
				datasource: "45",
			},
			want: cloudhub.Vsphere{
				UserName:     "test@vmware.com",
				Host:         "1.1.1.1",
				Organization: "1337",
				DataSource: "45",
			},
			addFirst: true,
		},
	}
	for _, tt := range tests {
		if tt.args.name != "" {
			tt.args.vsphere.UserName = tt.args.name
			tt.args.vsphere.DataSource = tt.args.datasource
		}
		s := organizations.NewVspheresStore(tt.fields.VspheresStore, tt.args.organization)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organization)
		err := s.Update(tt.args.ctx, tt.args.vsphere)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. VspheresStore.Update() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		got, err := s.Get(tt.args.ctx, tt.args.vsphere.ID)
		if diff := gocmp.Diff(got, tt.want, vsphereCloudHubOptions...); diff != "" {
			t.Errorf("%q. VspheresStore.Update():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}
