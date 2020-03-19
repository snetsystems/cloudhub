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
var organizationCloudHubOptions = gocmp.Options{
	cmpopts.EquateEmpty(),
	cmpopts.IgnoreFields(cloudhub.Organization{}, "ID"),
}

func TestOrganizations_All(t *testing.T) {
	type fields struct {
		OrganizationsStore cloudhub.OrganizationsStore
	}
	type args struct {
		organization string
		ctx          context.Context
	}
	tests := []struct {
		name    string
		args    args
		fields  fields
		want    []cloudhub.Organization
		wantRaw []cloudhub.Organization
		wantErr bool
	}{
		{
			name: "No Organizations",
			fields: fields{
				OrganizationsStore: &mocks.OrganizationsStore{
					AllF: func(ctx context.Context) ([]cloudhub.Organization, error) {
						return nil, fmt.Errorf("No Organizations")
					},
					DefaultOrganizationF: func(ctx context.Context) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "0",
							Name: "Default",
						}, nil
					},
				},
			},
			wantErr: true,
		},
		{
			name: "All Organizations",
			fields: fields{
				OrganizationsStore: &mocks.OrganizationsStore{
					DefaultOrganizationF: func(ctx context.Context) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "0",
							Name: "Default",
						}, nil
					},
					AllF: func(ctx context.Context) ([]cloudhub.Organization, error) {
						return []cloudhub.Organization{
							{
								Name: "howdy",
								ID:   "1337",
							},
							{
								Name: "doody",
								ID:   "1447",
							},
						}, nil
					},
				},
			},
			args: args{
				organization: "1337",
				ctx:          context.Background(),
			},
			want: []cloudhub.Organization{
				{
					Name: "howdy",
					ID:   "1337",
				},
				{
					Name: "Default",
					ID:   "0",
				},
			},
		},
	}
	for _, tt := range tests {
		s := organizations.NewOrganizationsStore(tt.fields.OrganizationsStore, tt.args.organization)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organization)
		gots, err := s.All(tt.args.ctx)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. OrganizationsStore.All() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		for i, got := range gots {
			if diff := gocmp.Diff(got, tt.want[i], organizationCloudHubOptions...); diff != "" {
				t.Errorf("%q. OrganizationsStore.All():\n-got/+want\ndiff %s", tt.name, diff)
			}
		}
	}
}

func TestOrganizations_Add(t *testing.T) {
	type fields struct {
		OrganizationsStore cloudhub.OrganizationsStore
	}
	type args struct {
		organizationID string
		ctx            context.Context
		organization   *cloudhub.Organization
	}
	tests := []struct {
		name    string
		args    args
		fields  fields
		want    *cloudhub.Organization
		wantErr bool
	}{
		{
			name: "Add Organization",
			fields: fields{
				OrganizationsStore: &mocks.OrganizationsStore{
					AddF: func(ctx context.Context, s *cloudhub.Organization) (*cloudhub.Organization, error) {
						return s, nil
					},
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "1229",
							Name: "howdy",
						}, nil
					},
				},
			},
			args: args{
				organizationID: "1229",
				ctx:            context.Background(),
				organization: &cloudhub.Organization{
					Name: "howdy",
				},
			},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		s := organizations.NewOrganizationsStore(tt.fields.OrganizationsStore, tt.args.organizationID)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organizationID)
		d, err := s.Add(tt.args.ctx, tt.args.organization)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. OrganizationsStore.Add() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		if tt.wantErr {
			continue
		}
		got, err := s.Get(tt.args.ctx, cloudhub.OrganizationQuery{ID: &d.ID})
		if diff := gocmp.Diff(got, tt.want, organizationCloudHubOptions...); diff != "" {
			t.Errorf("%q. OrganizationsStore.Add():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}

func TestOrganizations_Delete(t *testing.T) {
	type fields struct {
		OrganizationsStore cloudhub.OrganizationsStore
	}
	type args struct {
		organizationID string
		ctx            context.Context
		organization   *cloudhub.Organization
	}
	tests := []struct {
		name     string
		fields   fields
		args     args
		want     []cloudhub.Organization
		addFirst bool
		wantErr  bool
	}{
		{
			name: "Delete organization",
			fields: fields{
				OrganizationsStore: &mocks.OrganizationsStore{
					DeleteF: func(ctx context.Context, s *cloudhub.Organization) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "1229",
							Name: "howdy",
						}, nil
					},
				},
			},
			args: args{
				organizationID: "1229",
				ctx:            context.Background(),
				organization: &cloudhub.Organization{
					ID:   "1229",
					Name: "howdy",
				},
			},
			addFirst: true,
		},
	}
	for _, tt := range tests {
		s := organizations.NewOrganizationsStore(tt.fields.OrganizationsStore, tt.args.organizationID)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organizationID)
		err := s.Delete(tt.args.ctx, tt.args.organization)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. OrganizationsStore.All() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
	}
}

func TestOrganizations_Get(t *testing.T) {
	type fields struct {
		OrganizationsStore cloudhub.OrganizationsStore
	}
	type args struct {
		organizationID string
		ctx            context.Context
		organization   *cloudhub.Organization
	}
	tests := []struct {
		name     string
		fields   fields
		args     args
		want     *cloudhub.Organization
		addFirst bool
		wantErr  bool
	}{
		{
			name: "Get Organization",
			fields: fields{
				OrganizationsStore: &mocks.OrganizationsStore{
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "1337",
							Name: "howdy",
						}, nil
					},
				},
			},
			args: args{
				organizationID: "1337",
				ctx:            context.Background(),
				organization: &cloudhub.Organization{
					ID:   "1337",
					Name: "howdy",
				},
			},
			want: &cloudhub.Organization{
				ID:   "1337",
				Name: "howdy",
			},
		},
	}
	for _, tt := range tests {
		s := organizations.NewOrganizationsStore(tt.fields.OrganizationsStore, tt.args.organizationID)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organizationID)
		got, err := s.Get(tt.args.ctx, cloudhub.OrganizationQuery{ID: &tt.args.organization.ID})
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. OrganizationsStore.Get() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		if diff := gocmp.Diff(got, tt.want, organizationCloudHubOptions...); diff != "" {
			t.Errorf("%q. OrganizationsStore.Get():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}

func TestOrganizations_Update(t *testing.T) {
	type fields struct {
		OrganizationsStore cloudhub.OrganizationsStore
	}
	type args struct {
		organizationID string
		ctx            context.Context
		organization   *cloudhub.Organization
		name           string
	}
	tests := []struct {
		name     string
		fields   fields
		args     args
		want     *cloudhub.Organization
		addFirst bool
		wantErr  bool
	}{
		{
			name: "Update Organization Name",
			fields: fields{
				OrganizationsStore: &mocks.OrganizationsStore{
					UpdateF: func(ctx context.Context, s *cloudhub.Organization) error {
						return nil
					},
					GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
						return &cloudhub.Organization{
							ID:   "1229",
							Name: "doody",
						}, nil
					},
				},
			},
			args: args{
				organizationID: "1229",
				ctx:            context.Background(),
				organization: &cloudhub.Organization{
					ID:   "1229",
					Name: "howdy",
				},
				name: "doody",
			},
			want: &cloudhub.Organization{
				Name: "doody",
			},
			addFirst: true,
		},
	}
	for _, tt := range tests {
		if tt.args.name != "" {
			tt.args.organization.Name = tt.args.name
		}
		s := organizations.NewOrganizationsStore(tt.fields.OrganizationsStore, tt.args.organizationID)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organizationID)
		err := s.Update(tt.args.ctx, tt.args.organization)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. OrganizationsStore.Update() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		got, err := s.Get(tt.args.ctx, cloudhub.OrganizationQuery{ID: &tt.args.organization.ID})
		if diff := gocmp.Diff(got, tt.want, organizationCloudHubOptions...); diff != "" {
			t.Errorf("%q. OrganizationsStore.Update():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}
