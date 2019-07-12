package bolt_test

import (
	"context"
	"testing"

	gocmp "github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	cmp "github.com/snetsystems/cmp/backend"
)

// IgnoreFields is used because ID is created by BoltDB and cannot be predicted reliably
// EquateEmpty is used because we want nil slices, arrays, and maps to be equal to the empty map
var diffOptions = gocmp.Options{
	cmpopts.IgnoreFields(cmp.Dashboard{}, "ID"),
	cmpopts.IgnoreFields(cmp.DashboardCell{}, "ID"),
	cmpopts.EquateEmpty(),
}

func TestDashboardsStore_Add(t *testing.T) {
	type args struct {
		ctx       context.Context
		dashboard *cmp.Dashboard
		addFirst  bool
	}
	tests := []struct {
		name    string
		args    args
		want    *cmp.Dashboard
		wantErr bool
	}{
		{
			name: "Add new Dashboard",
			args: args{
				ctx: context.Background(),
				dashboard: &cmp.Dashboard{
					Cells: []cmp.DashboardCell{
						{
							Axes: map[string]cmp.Axis{
								"x": {
									Bounds: []string{"1", "2"},
									Label:  "label",
									Prefix: "pref",
									Suffix: "suff",
									Base:   "10",
									Scale:  "log",
								},
							},
						},
					},
					Name: "best name",
				},
			},
			want: &cmp.Dashboard{
				Cells: []cmp.DashboardCell{
					{
						Axes: map[string]cmp.Axis{
							"x": {
								Bounds: []string{"1", "2"},
								Label:  "label",
								Prefix: "pref",
								Suffix: "suff",
								Base:   "10",
								Scale:  "log",
							},
						},
						Queries:      []cmp.DashboardQuery{},
						Type:         "line",
						CellColors:   []cmp.CellColor{},
						FieldOptions: []cmp.RenamableField{},
					},
				},
				Templates: []cmp.Template{},
				Name:      "best name",
			},
		},
	}
	for _, tt := range tests {
		client, err := NewTestClient()
		if err != nil {
			t.Fatal(err)
		}
		defer client.Close()

		s := client.DashboardsStore
		if tt.args.addFirst {
			_, _ = s.Add(tt.args.ctx, *tt.args.dashboard)
		}
		got, err := s.Add(tt.args.ctx, *tt.args.dashboard)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. DashboardsStore.Add() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}

		if tt.wantErr {
			continue
		}

		got, err = s.Get(tt.args.ctx, cmp.DashboardID(got.ID))
		if err != nil {
			t.Fatalf("failed to get Dashboard: %v", err)
		}
		if diff := gocmp.Diff(&got, tt.want, diffOptions...); diff != "" {
			t.Errorf("%q. DashboardsStore.Add():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}
