package kv_test

import (
	"context"
	"testing"

	gocmp "github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var mappingCloudHubOptions = gocmp.Options{
	cmpopts.IgnoreFields(cloudhub.Mapping{}, "ID"),
	cmpopts.EquateEmpty(),
}

func TestMappingStore_Add(t *testing.T) {
	type fields struct {
		mappings []*cloudhub.Mapping
	}
	type args struct {
		mapping *cloudhub.Mapping
	}
	type wants struct {
		mapping *cloudhub.Mapping
		err     error
	}
	tests := []struct {
		name   string
		fields fields
		args   args
		wants  wants
	}{
		{
			name: "default with wildcards",
			args: args{
				mapping: &cloudhub.Mapping{
					Organization:         "default",
					Provider:             "*",
					Scheme:               "*",
					ProviderOrganization: "*",
				},
			},
			wants: wants{
				mapping: &cloudhub.Mapping{
					Organization:         "default",
					Provider:             "*",
					Scheme:               "*",
					ProviderOrganization: "*",
				},
			},
		},
		{
			name: "simple",
			args: args{
				mapping: &cloudhub.Mapping{
					Organization:         "default",
					Provider:             "github",
					Scheme:               "oauth2",
					ProviderOrganization: "idk",
				},
			},
			wants: wants{
				mapping: &cloudhub.Mapping{
					Organization:         "default",
					Provider:             "github",
					Scheme:               "oauth2",
					ProviderOrganization: "idk",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewTestClient()
			if err != nil {
				t.Fatal(err)
			}
			defer client.Close()

			s := client.MappingsStore()
			ctx := context.Background()

			for _, mapping := range tt.fields.mappings {
				// YOLO database prepopulation
				_, _ = s.Add(ctx, mapping)
			}

			tt.args.mapping, err = s.Add(ctx, tt.args.mapping)

			if (err != nil) != (tt.wants.err != nil) {
				t.Errorf("MappingsStore.Add() error = %v, want error %v", err, tt.wants.err)
				return
			}

			got, err := s.Get(ctx, tt.args.mapping.ID)
			if err != nil {
				t.Fatalf("failed to get mapping: %v", err)
				return
			}
			if diff := gocmp.Diff(got, tt.wants.mapping, mappingCloudHubOptions...); diff != "" {
				t.Errorf("MappingStore.Add():\n-got/+want\ndiff %s", diff)
				return
			}
		})
	}
}

func TestMappingStore_All(t *testing.T) {
	type fields struct {
		mappings []*cloudhub.Mapping
	}
	type args struct {
	}
	type wants struct {
		mappings []cloudhub.Mapping
		err      error
	}
	tests := []struct {
		name   string
		fields fields
		args   args
		wants  wants
	}{
		{
			name: "simple",
			fields: fields{
				mappings: []*cloudhub.Mapping{
					{
						Organization:         "0",
						Provider:             "google",
						Scheme:               "ldap",
						ProviderOrganization: "*",
					},
				},
			},
			wants: wants{
				mappings: []cloudhub.Mapping{
					{
						Organization:         "0",
						Provider:             "google",
						Scheme:               "ldap",
						ProviderOrganization: "*",
					},
					{
						Organization:         "default",
						Provider:             "*",
						Scheme:               "*",
						ProviderOrganization: "*",
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewTestClient()
			if err != nil {
				t.Fatal(err)
			}
			defer client.Close()

			s := client.MappingsStore()
			ctx := context.Background()

			for _, mapping := range tt.fields.mappings {
				// YOLO database prepopulation
				_, _ = s.Add(ctx, mapping)
			}

			got, err := s.All(ctx)

			if (err != nil) != (tt.wants.err != nil) {
				t.Errorf("MappingsStore.All() error = %v, want error %v", err, tt.wants.err)
				return
			}

			if diff := gocmp.Diff(got, tt.wants.mappings, mappingCloudHubOptions...); diff != "" {
				t.Errorf("MappingStore.All():\n-got/+want\ndiff %s", diff)
				return
			}
		})
	}
}

func TestMappingStore_Delete(t *testing.T) {
	type fields struct {
		mappings []*cloudhub.Mapping
	}
	type args struct {
		mapping *cloudhub.Mapping
	}
	type wants struct {
		err error
	}
	tests := []struct {
		name   string
		fields fields
		args   args
		wants  wants
	}{
		{
			name: "simple",
			fields: fields{
				mappings: []*cloudhub.Mapping{
					{
						Organization:         "default",
						Provider:             "*",
						Scheme:               "*",
						ProviderOrganization: "*",
					},
					{
						Organization:         "0",
						Provider:             "google",
						Scheme:               "ldap",
						ProviderOrganization: "*",
					},
				},
			},
			args: args{
				mapping: &cloudhub.Mapping{
					ID:                   "1",
					Organization:         "default",
					Provider:             "*",
					Scheme:               "*",
					ProviderOrganization: "*",
				},
			},
			wants: wants{
				err: nil,
			},
		},
		{
			name: "mapping not found",
			fields: fields{
				mappings: []*cloudhub.Mapping{
					{
						Organization:         "default",
						Provider:             "*",
						Scheme:               "*",
						ProviderOrganization: "*",
					},
					{
						Organization:         "0",
						Provider:             "google",
						Scheme:               "ldap",
						ProviderOrganization: "*",
					},
				},
			},
			args: args{
				mapping: &cloudhub.Mapping{
					ID:                   "0",
					Organization:         "default",
					Provider:             "*",
					Scheme:               "*",
					ProviderOrganization: "*",
				},
			},
			wants: wants{
				err: cloudhub.ErrMappingNotFound,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewTestClient()
			if err != nil {
				t.Fatal(err)
			}
			defer client.Close()

			s := client.MappingsStore()
			ctx := context.Background()

			for _, mapping := range tt.fields.mappings {
				// YOLO database prepopulation
				_, _ = s.Add(ctx, mapping)
			}

			err = s.Delete(ctx, tt.args.mapping)

			if (err != nil) != (tt.wants.err != nil) {
				t.Errorf("MappingsStore.Delete() error = %v, want error %v", err, tt.wants.err)
				return
			}
		})
	}
}

func TestMappingStore_Get(t *testing.T) {
	type fields struct {
		mappings []*cloudhub.Mapping
	}
	type args struct {
		mappingID string
	}
	type wants struct {
		mapping *cloudhub.Mapping
		err     error
	}
	tests := []struct {
		name   string
		fields fields
		args   args
		wants  wants
	}{
		{
			name: "simple",
			fields: fields{
				mappings: []*cloudhub.Mapping{
					{
						Organization:         "default",
						Provider:             "*",
						Scheme:               "*",
						ProviderOrganization: "*",
					},
					{
						Organization:         "0",
						Provider:             "google",
						Scheme:               "ldap",
						ProviderOrganization: "*",
					},
				},
			},
			args: args{
				mappingID: "1",
			},
			wants: wants{
				mapping: &cloudhub.Mapping{
					ID:                   "1",
					Organization:         "default",
					Provider:             "*",
					Scheme:               "*",
					ProviderOrganization: "*",
				},
				err: nil,
			},
		},
		{
			name: "mapping not found",
			fields: fields{
				mappings: []*cloudhub.Mapping{
					{
						Organization:         "default",
						Provider:             "*",
						Scheme:               "*",
						ProviderOrganization: "*",
					},
					{
						Organization:         "0",
						Provider:             "google",
						Scheme:               "ldap",
						ProviderOrganization: "*",
					},
				},
			},
			args: args{
				mappingID: "0",
			},
			wants: wants{
				err: cloudhub.ErrMappingNotFound,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewTestClient()
			if err != nil {
				t.Fatal(err)
			}
			defer client.Close()

			s := client.MappingsStore()
			ctx := context.Background()

			for _, mapping := range tt.fields.mappings {
				// YOLO database prepopulation
				_, _ = s.Add(ctx, mapping)
			}

			got, err := s.Get(ctx, tt.args.mappingID)
			if (err != nil) != (tt.wants.err != nil) {
				t.Errorf("MappingsStore.Get() error = %v, want error %v", err, tt.wants.err)
				return
			}
			if diff := gocmp.Diff(got, tt.wants.mapping, mappingCloudHubOptions...); diff != "" {
				t.Errorf("MappingStore.Get():\n-got/+want\ndiff %s", diff)
				return
			}
		})
	}
}

func TestMappingStore_Update(t *testing.T) {
	type fields struct {
		mappings []*cloudhub.Mapping
	}
	type args struct {
		mapping *cloudhub.Mapping
	}
	type wants struct {
		mapping *cloudhub.Mapping
		err     error
	}
	tests := []struct {
		name   string
		fields fields
		args   args
		wants  wants
	}{
		{
			name: "simple",
			fields: fields{
				mappings: []*cloudhub.Mapping{
					{
						Organization:         "default",
						Provider:             "*",
						Scheme:               "*",
						ProviderOrganization: "*",
					},
					{
						Organization:         "0",
						Provider:             "google",
						Scheme:               "ldap",
						ProviderOrganization: "*",
					},
				},
			},
			args: args{
				mapping: &cloudhub.Mapping{
					ID:                   "1",
					Organization:         "default",
					Provider:             "cool",
					Scheme:               "it",
					ProviderOrganization: "works",
				},
			},
			wants: wants{
				mapping: &cloudhub.Mapping{
					ID:                   "1",
					Organization:         "default",
					Provider:             "cool",
					Scheme:               "it",
					ProviderOrganization: "works",
				},
				err: nil,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewTestClient()
			if err != nil {
				t.Fatal(err)
			}
			defer client.Close()

			s := client.MappingsStore()
			ctx := context.Background()

			for _, mapping := range tt.fields.mappings {
				// YOLO database prepopulation
				_, _ = s.Add(ctx, mapping)
			}

			err = s.Update(ctx, tt.args.mapping)
			if (err != nil) != (tt.wants.err != nil) {
				t.Errorf("MappingsStore.Update() error = %v, want error %v", err, tt.wants.err)
				return
			}
			if diff := gocmp.Diff(tt.args.mapping, tt.wants.mapping, mappingCloudHubOptions...); diff != "" {
				t.Errorf("MappingStore.Update():\n-got/+want\ndiff %s", diff)
				return
			}
		})
	}
}
