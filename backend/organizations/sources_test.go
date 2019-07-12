package organizations_test

import (
	"context"
	"fmt"
	"testing"

	gocmp "github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	cmp "github.com/snetsystems/cmp/backend"
	"github.com/snetsystems/cmp/backend/mocks"
	"github.com/snetsystems/cmp/backend/organizations"
)

// IgnoreFields is used because ID cannot be predicted reliably
// EquateEmpty is used because we want nil slices, arrays, and maps to be equal to the empty map
var sourceCmpOptions = gocmp.Options{
	cmpopts.EquateEmpty(),
	cmpopts.IgnoreFields(cmp.Source{}, "ID"),
	cmpopts.IgnoreFields(cmp.Source{}, "Default"),
}

func TestSources_All(t *testing.T) {
	type fields struct {
		SourcesStore cmp.SourcesStore
	}
	type args struct {
		organization string
		ctx          context.Context
	}
	tests := []struct {
		name    string
		args    args
		fields  fields
		want    []cmp.Source
		wantRaw []cmp.Source
		wantErr bool
	}{
		{
			name: "No Sources",
			fields: fields{
				SourcesStore: &mocks.SourcesStore{
					AllF: func(ctx context.Context) ([]cmp.Source, error) {
						return nil, fmt.Errorf("No Sources")
					},
				},
			},
			wantErr: true,
		},
		{
			name: "All Sources",
			fields: fields{
				SourcesStore: &mocks.SourcesStore{
					AllF: func(ctx context.Context) ([]cmp.Source, error) {
						return []cmp.Source{
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
			want: []cmp.Source{
				{
					Name:         "howdy",
					Organization: "1337",
				},
			},
		},
	}
	for _, tt := range tests {
		s := organizations.NewSourcesStore(tt.fields.SourcesStore, tt.args.organization)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organization)
		gots, err := s.All(tt.args.ctx)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. SourcesStore.All() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		for i, got := range gots {
			if diff := gocmp.Diff(got, tt.want[i], sourceCmpOptions...); diff != "" {
				t.Errorf("%q. SourcesStore.All():\n-got/+want\ndiff %s", tt.name, diff)
			}
		}
	}
}

func TestSources_Add(t *testing.T) {
	type fields struct {
		SourcesStore cmp.SourcesStore
	}
	type args struct {
		organization string
		ctx          context.Context
		source       cmp.Source
	}
	tests := []struct {
		name    string
		args    args
		fields  fields
		want    cmp.Source
		wantErr bool
	}{
		{
			name: "Add Source",
			fields: fields{
				SourcesStore: &mocks.SourcesStore{
					AddF: func(ctx context.Context, s cmp.Source) (cmp.Source, error) {
						return s, nil
					},
					GetF: func(ctx context.Context, id int) (cmp.Source, error) {
						return cmp.Source{
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
				source: cmp.Source{
					ID:   1229,
					Name: "howdy",
				},
			},
			want: cmp.Source{
				Name:         "howdy",
				Organization: "1337",
			},
		},
	}
	for _, tt := range tests {
		s := organizations.NewSourcesStore(tt.fields.SourcesStore, tt.args.organization)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organization)
		d, err := s.Add(tt.args.ctx, tt.args.source)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. SourcesStore.Add() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		got, err := s.Get(tt.args.ctx, d.ID)
		if diff := gocmp.Diff(got, tt.want, sourceCmpOptions...); diff != "" {
			t.Errorf("%q. SourcesStore.Add():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}

func TestSources_Delete(t *testing.T) {
	type fields struct {
		SourcesStore cmp.SourcesStore
	}
	type args struct {
		organization string
		ctx          context.Context
		source       cmp.Source
	}
	tests := []struct {
		name     string
		fields   fields
		args     args
		want     []cmp.Source
		addFirst bool
		wantErr  bool
	}{
		{
			name: "Delete source",
			fields: fields{
				SourcesStore: &mocks.SourcesStore{
					DeleteF: func(ctx context.Context, s cmp.Source) error {
						return nil
					},
					GetF: func(ctx context.Context, id int) (cmp.Source, error) {
						return cmp.Source{
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
				source: cmp.Source{
					ID:           1229,
					Name:         "howdy",
					Organization: "1337",
				},
			},
			addFirst: true,
		},
	}
	for _, tt := range tests {
		s := organizations.NewSourcesStore(tt.fields.SourcesStore, tt.args.organization)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organization)
		err := s.Delete(tt.args.ctx, tt.args.source)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. SourcesStore.All() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
	}
}

func TestSources_Get(t *testing.T) {
	type fields struct {
		SourcesStore cmp.SourcesStore
	}
	type args struct {
		organization string
		ctx          context.Context
		source       cmp.Source
	}
	tests := []struct {
		name     string
		fields   fields
		args     args
		want     cmp.Source
		addFirst bool
		wantErr  bool
	}{
		{
			name: "Get Source",
			fields: fields{
				SourcesStore: &mocks.SourcesStore{
					GetF: func(ctx context.Context, id int) (cmp.Source, error) {
						return cmp.Source{
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
				source: cmp.Source{
					ID:           1229,
					Name:         "howdy",
					Organization: "1337",
				},
			},
			want: cmp.Source{
				ID:           1229,
				Name:         "howdy",
				Organization: "1337",
			},
		},
	}
	for _, tt := range tests {
		s := organizations.NewSourcesStore(tt.fields.SourcesStore, tt.args.organization)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organization)
		got, err := s.Get(tt.args.ctx, tt.args.source.ID)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. SourcesStore.Get() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		if diff := gocmp.Diff(got, tt.want, sourceCmpOptions...); diff != "" {
			t.Errorf("%q. SourcesStore.Get():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}

func TestSources_Update(t *testing.T) {
	type fields struct {
		SourcesStore cmp.SourcesStore
	}
	type args struct {
		organization string
		ctx          context.Context
		source       cmp.Source
		name         string
	}
	tests := []struct {
		name     string
		fields   fields
		args     args
		want     cmp.Source
		addFirst bool
		wantErr  bool
	}{
		{
			name: "Update Source Name",
			fields: fields{
				SourcesStore: &mocks.SourcesStore{
					UpdateF: func(ctx context.Context, s cmp.Source) error {
						return nil
					},
					GetF: func(ctx context.Context, id int) (cmp.Source, error) {
						return cmp.Source{
							ID:           1229,
							Name:         "doody",
							Organization: "1337",
						}, nil
					},
				},
			},
			args: args{
				organization: "1337",
				ctx:          context.Background(),
				source: cmp.Source{
					ID:           1229,
					Name:         "howdy",
					Organization: "1337",
				},
				name: "doody",
			},
			want: cmp.Source{
				Name:         "doody",
				Organization: "1337",
			},
			addFirst: true,
		},
	}
	for _, tt := range tests {
		if tt.args.name != "" {
			tt.args.source.Name = tt.args.name
		}
		s := organizations.NewSourcesStore(tt.fields.SourcesStore, tt.args.organization)
		tt.args.ctx = context.WithValue(tt.args.ctx, organizations.ContextKey, tt.args.organization)
		err := s.Update(tt.args.ctx, tt.args.source)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. SourcesStore.Update() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		got, err := s.Get(tt.args.ctx, tt.args.source.ID)
		if diff := gocmp.Diff(got, tt.want, sourceCmpOptions...); diff != "" {
			t.Errorf("%q. SourcesStore.Update():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}
