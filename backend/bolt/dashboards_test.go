package bolt_test

import (
	"context"
	"testing"

	gocmp "github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// IgnoreFields is used because ID is created by BoltDB and cannot be predicted reliably
// EquateEmpty is used because we want nil slices, arrays, and maps to be equal to the empty map
var diffOptions = gocmp.Options{
	cmpopts.IgnoreFields(cloudhub.Dashboard{}, "ID"),
	cmpopts.IgnoreFields(cloudhub.DashboardCell{}, "ID"),
	cmpopts.EquateEmpty(),
}

func TestDashboardsStore_Add(t *testing.T) {
	type args struct {
		ctx       context.Context
		dashboard *cloudhub.Dashboard
		addFirst  bool
	}
	tests := []struct {
		name    string
		args    args
		want    *cloudhub.Dashboard
		wantErr bool
	}{
		{
			name: "Add new Dashboard",
			args: args{
				ctx: context.Background(),
				dashboard: &cloudhub.Dashboard{
					Cells: []cloudhub.DashboardCell{
						{
							Axes: map[string]cloudhub.Axis{
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
			want: &cloudhub.Dashboard{
				Cells: []cloudhub.DashboardCell{
					{
						Axes: map[string]cloudhub.Axis{
							"x": {
								Bounds: []string{"1", "2"},
								Label:  "label",
								Prefix: "pref",
								Suffix: "suff",
								Base:   "10",
								Scale:  "log",
							},
						},
						Queries:      []cloudhub.DashboardQuery{},
						Type:         "line",
						CellColors:   []cloudhub.CellColor{},
						FieldOptions: []cloudhub.RenamableField{},
					},
				},
				Templates: []cloudhub.Template{},
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

		got, err = s.Get(tt.args.ctx, cloudhub.DashboardID(got.ID))
		if err != nil {
			t.Fatalf("failed to get Dashboard: %v", err)
		}
		if diff := gocmp.Diff(&got, tt.want, diffOptions...); diff != "" {
			t.Errorf("%q. DashboardsStore.Add():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}
