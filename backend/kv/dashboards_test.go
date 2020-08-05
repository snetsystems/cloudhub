package kv_test

import (
	"context"
	"testing"

	gocmp "github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/stretchr/testify/require"
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

		s := client.DashboardsStore()
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

func TestDashboardStore_All(t *testing.T) {
	type fields struct {
		dashboard cloudhub.Dashboard
	}
	tests := []struct {
		name   string
		fields fields
		want   []cloudhub.Dashboard
	}{
		{
			name: "simple",
			fields: fields{
				dashboard: cloudhub.Dashboard{
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
			want: []cloudhub.Dashboard{
				{
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
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewTestClient()
			if err != nil {
				t.Fatal(err)
			}
			defer client.Close()

			s := client.DashboardsStore()
			ctx := context.Background()

			s.Add(ctx, tt.fields.dashboard)

			got, err := s.All(ctx)
			require.NoError(t, err)
			require.Equal(t, 1, len(got))

			if diff := gocmp.Diff(got, tt.want, diffOptions...); diff != "" {
				t.Errorf("LayoutStore.All():\n-got/+want\ndiff %s", diff)
				return
			}
		})
	}
}

func TestDashboardStore_Delete(t *testing.T) {
	type fields struct {
		dashboards []cloudhub.Dashboard
	}
	type wants struct {
		err error
	}
	tests := []struct {
		name   string
		fields fields
		wants  wants
	}{
		{
			name: "simple",
			fields: fields{
				dashboards: []cloudhub.Dashboard{
					{
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
			},
			wants: wants{
				err: nil,
			},
		},
		{
			name: "dashboard not found",
			fields: fields{
				dashboards: []cloudhub.Dashboard{
					{
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

			s := client.DashboardsStore()
			ctx := context.Background()

			var d cloudhub.Dashboard
			for _, dashboard := range tt.fields.dashboards {
				d, _ = s.Add(ctx, dashboard)
			}

			err = s.Delete(ctx, d)
			err = s.Delete(ctx, d)
			if (err != nil) != (tt.wants.err != nil) {
				t.Errorf("DashboardsStore.Delete() error = %v, want error %v", err, tt.wants.err)
				return
			}
		})
	}
}

func TestDashboardStore_Get(t *testing.T) {
	type fields struct {
		dashboards []cloudhub.Dashboard
	}
	type wants struct {
		dashboard cloudhub.Dashboard
		err       error
	}
	tests := []struct {
		name   string
		fields fields
		wants  wants
	}{
		{
			name: "simple",
			fields: fields{
				dashboards: []cloudhub.Dashboard{
					{
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
					{
						Cells: []cloudhub.DashboardCell{
							{
								Axes: map[string]cloudhub.Axis{
									"x": {
										Bounds: []string{"3", "4"},
										Label:  "label1",
										Prefix: "pref1",
										Suffix: "suff1",
										Base:   "101",
										Scale:  "log1",
									},
								},
								Queries:      []cloudhub.DashboardQuery{},
								Type:         "line1",
								CellColors:   []cloudhub.CellColor{},
								FieldOptions: []cloudhub.RenamableField{},
							},
						},
						Templates: []cloudhub.Template{},
						Name:      "best name1",
					},
				},
			},
			wants: wants{
				dashboard: cloudhub.Dashboard{
					Cells: []cloudhub.DashboardCell{
						{
							Axes: map[string]cloudhub.Axis{
								"x": {
									Bounds: []string{"3", "4"},
									Label:  "label1",
									Prefix: "pref1",
									Suffix: "suff1",
									Base:   "101",
									Scale:  "log1",
								},
							},
							Queries:      []cloudhub.DashboardQuery{},
							Type:         "line1",
							CellColors:   []cloudhub.CellColor{},
							FieldOptions: []cloudhub.RenamableField{},
						},
					},
					Templates: []cloudhub.Template{},
					Name:      "best name1",
				},
				err: nil,
			},
		},
		{
			name: "dashboard not found",
			fields: fields{
				dashboards: []cloudhub.Dashboard{},
			},
			wants: wants{
				err: cloudhub.ErrDashboardNotFound,
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

			s := client.DashboardsStore()
			ctx := context.Background()

			var d cloudhub.Dashboard
			for _, dashboard := range tt.fields.dashboards {
				d, _ = s.Add(ctx, dashboard)
			}

			if tt.wants.err != nil {
				s.Delete(ctx, d)
			}

			got, err := s.Get(ctx, d.ID)
			if (err != nil) != (tt.wants.err != nil) {
				t.Errorf("DashboardsStore.Get() error = %v, want error %v", err, tt.wants.err)
				return
			}

			if diff := gocmp.Diff(got, tt.wants.dashboard, diffOptions...); diff != "" {
				t.Errorf("LayoutStore.Get():\n-got/+want\ndiff %s", diff)
				return
			}
		})
	}
}

func TestDashboardStore_Update(t *testing.T) {
	type fields struct {
		dashboards []cloudhub.Dashboard
	}
	type wants struct {
		dashboard cloudhub.Dashboard
		err       error
	}
	tests := []struct {
		name   string
		fields fields
		wants  wants
	}{
		{
			name: "simple",
			fields: fields{
				dashboards: []cloudhub.Dashboard{
					{
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
					{
						Cells: []cloudhub.DashboardCell{
							{
								Axes: map[string]cloudhub.Axis{
									"x": {
										Bounds: []string{"3", "4"},
										Label:  "label1",
										Prefix: "pref1",
										Suffix: "suff1",
										Base:   "101",
										Scale:  "log1",
									},
								},
								Queries:      []cloudhub.DashboardQuery{},
								Type:         "line1",
								CellColors:   []cloudhub.CellColor{},
								FieldOptions: []cloudhub.RenamableField{},
							},
						},
						Templates: []cloudhub.Template{},
						Name:      "best name1",
					},
				},
			},
			wants: wants{
				dashboard: cloudhub.Dashboard{
					Cells: []cloudhub.DashboardCell{
						{
							Axes: map[string]cloudhub.Axis{
								"x": {
									Bounds: []string{"5", "6"},
									Label:  "label2",
									Prefix: "pref2",
									Suffix: "suff2",
									Base:   "102",
									Scale:  "log2",
								},
							},
							Queries:      []cloudhub.DashboardQuery{},
							Type:         "line2",
							CellColors:   []cloudhub.CellColor{},
							FieldOptions: []cloudhub.RenamableField{},
						},
					},
					Templates: []cloudhub.Template{},
					Name:      "best name2",
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

			s := client.DashboardsStore()
			ctx := context.Background()

			var d cloudhub.Dashboard
			for _, dashboard := range tt.fields.dashboards {
				d, _ = s.Add(ctx, dashboard)
			}

			id := d.ID
			d = tt.wants.dashboard
			d.ID = id

			err = s.Update(ctx, d)
			if (err != nil) != (tt.wants.err != nil) {
				t.Errorf("DashboardsStore.Update() error = %v, want error %v", err, tt.wants.err)
				return
			}

			got, _ := s.Get(ctx, d.ID)
			if diff := gocmp.Diff(got, tt.wants.dashboard, diffOptions...); diff != "" {
				t.Errorf("LayoutStore.Update():\n-got/+want\ndiff %s", diff)
				return
			}
		})
	}
}
