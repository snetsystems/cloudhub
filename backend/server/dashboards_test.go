package server

import (
	"context"
	"reflect"
	"testing"

	gocmp "github.com/google/go-cmp/cmp"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

func TestCorrectWidthHeight(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		cell cloudhub.DashboardCell
		want cloudhub.DashboardCell
	}{
		{
			name: "updates width",
			cell: cloudhub.DashboardCell{
				W: 0,
				H: 4,
			},
			want: cloudhub.DashboardCell{
				W: 4,
				H: 4,
			},
		},
		{
			name: "updates height",
			cell: cloudhub.DashboardCell{
				W: 4,
				H: 0,
			},
			want: cloudhub.DashboardCell{
				W: 4,
				H: 4,
			},
		},
		{
			name: "updates both",
			cell: cloudhub.DashboardCell{
				W: 0,
				H: 0,
			},
			want: cloudhub.DashboardCell{
				W: 4,
				H: 4,
			},
		},
		{
			name: "updates neither",
			cell: cloudhub.DashboardCell{
				W: 4,
				H: 4,
			},
			want: cloudhub.DashboardCell{
				W: 4,
				H: 4,
			},
		},
	}
	for _, tt := range tests {
		if CorrectWidthHeight(&tt.cell); !reflect.DeepEqual(tt.cell, tt.want) {
			t.Errorf("%q. CorrectWidthHeight() = %v, want %v", tt.name, tt.cell, tt.want)
		}
	}
}

func TestDashboardDefaults(t *testing.T) {
	tests := []struct {
		name string
		d    cloudhub.Dashboard
		want cloudhub.Dashboard
	}{
		{
			name: "Updates all cell widths/heights",
			d: cloudhub.Dashboard{
				Cells: []cloudhub.DashboardCell{
					{
						W: 0,
						H: 0,
					},
					{
						W: 2,
						H: 2,
					},
				},
			},
			want: cloudhub.Dashboard{
				Type: "normal",
				Cells: []cloudhub.DashboardCell{
					{
						W: 4,
						H: 4,
					},
					{
						W: 2,
						H: 2,
					},
				},
			},
		},
		{
			name: "Updates no cell",
			d: cloudhub.Dashboard{
				Cells: []cloudhub.DashboardCell{
					{
						W: 4,
						H: 4,
					}, {
						W: 2,
						H: 2,
					},
				},
			},
			want: cloudhub.Dashboard{
				Type: "normal",
				Cells: []cloudhub.DashboardCell{
					{
						W: 4,
						H: 4,
					},
					{
						W: 2,
						H: 2,
					},
				},
			},
		},
	}
	for _, tt := range tests {
		actual := DashboardDefaults(tt.d)
		want := tt.want
		for i := range actual.Cells {
			applyTableGaugeDefaults(&actual.Cells[i])
		}
		for i := range want.Cells {
			applyTableGaugeDefaults(&want.Cells[i])
		}
		if !reflect.DeepEqual(actual, want) {
			t.Errorf("%q. DashboardDefaults() = %v, want %v", tt.name, actual, want)
		}
	}
}

func TestValidDashboardRequest(t *testing.T) {
	tests := []struct {
		name    string
		d       cloudhub.Dashboard
		want    cloudhub.Dashboard
		wantErr bool
	}{
		{
			name: "Updates all cell widths/heights",
			d: cloudhub.Dashboard{
				Organization: "1337",
				Cells: []cloudhub.DashboardCell{
					{
						W: 0,
						H: 0,
						Queries: []cloudhub.DashboardQuery{
							{
								Command: "SELECT donors from hill_valley_preservation_society where time > 1985-10-25T08:00:00",
								Type:    "influxql",
							},
						},
					},
					{
						W: 2,
						H: 2,
						Queries: []cloudhub.DashboardQuery{
							{
								Command: "SELECT winning_horses from grays_sports_alamanc where time > 1955-11-1T00:00:00",
								Type:    "influxql",
							},
						},
					},
				},
			},
			want: cloudhub.Dashboard{
				Organization: "1337",
				Type:         "normal",
				Cells: []cloudhub.DashboardCell{
					{
						W: 4,
						H: 4,
						Queries: []cloudhub.DashboardQuery{
							{
								Command: "SELECT donors from hill_valley_preservation_society where time > 1985-10-25T08:00:00",
								Type:    "influxql",
							},
						},
						NoteVisibility: "default",
					},
					{
						W: 2,
						H: 2,
						Queries: []cloudhub.DashboardQuery{
							{
								Command: "SELECT winning_horses from grays_sports_alamanc where time > 1955-11-1T00:00:00",
								Type:    "influxql",
							},
						},
						NoteVisibility: "default",
					},
				},
			},
		},
		{
			name: "Updates no cell",
			d: cloudhub.Dashboard{
				Organization: "0",
				Cells: []cloudhub.DashboardCell{
					{
						W: 4,
						H: 4,
					},
					{
						W: 2,
						H: 2,
					},
				},
			},
			want: cloudhub.Dashboard{
				Organization: "0",
				Type:         "normal",
				Cells: []cloudhub.DashboardCell{
					{
						W:              4,
						H:              4,
						NoteVisibility: "default",
					},
					{
						W:              2,
						H:              2,
						NoteVisibility: "default",
					},
				},
			},
		},
		{
			name: "Dashboard with Template Options",
			d: cloudhub.Dashboard{
				Organization: "1337",
				Templates: []cloudhub.Template{
					{
						ID:   "t1",
						Type: "tagValues",
						Options: &cloudhub.TemplateOptions{
							IsAllEnabled: true,
						},
					},
				},
			},
			want: cloudhub.Dashboard{
				Organization: "1337",
				Type:         "normal",
				Templates: []cloudhub.Template{
					{
						ID:   "t1",
						Type: "tagValues",
						Options: &cloudhub.TemplateOptions{
							IsAllEnabled: true,
						},
					},
				},
				Cells: []cloudhub.DashboardCell{},
			},
		},
	}
	for _, tt := range tests {
		// TODO(desa): this Okay?
		err := ValidDashboardRequest(&tt.d, "0")
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. ValidDashboardRequest() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		for i := range tt.want.Cells {
			applyTableGaugeDefaults(&tt.want.Cells[i])
		}
		if diff := gocmp.Diff(tt.d, tt.want); diff != "" {
			t.Errorf("%q. ValidDashboardRequest(). got/want diff:\n%s", tt.name, diff)
		}
	}
}

func Test_newDashboardResponse(t *testing.T) {
	tests := []struct {
		name string
		d    cloudhub.Dashboard
		want *dashboardResponse
	}{
		{
			name: "creates a dashboard response",
			d: cloudhub.Dashboard{
				Organization: "0",
				Cells: []cloudhub.DashboardCell{
					{
						ID: "a",
						W:  0,
						H:  0,
						Queries: []cloudhub.DashboardQuery{
							{
								Source:  "/cloudhub/v1/sources/1",
								Command: "SELECT donors from hill_valley_preservation_society where time > '1985-10-25 08:00:00'",
								Shifts: []cloudhub.TimeShift{
									{
										Label:    "Best Week Evar",
										Unit:     "d",
										Quantity: "7",
									},
								},
								Type: "flux",
							},
						},
						Axes: map[string]cloudhub.Axis{
							"x": {
								Bounds: []string{"0", "100"},
							},
							"y": {
								Bounds: []string{"2", "95"},
								Label:  "foo",
							},
						},
					},
					{
						ID: "b",
						W:  0,
						H:  0,
						Queries: []cloudhub.DashboardQuery{
							{
								Type:    "flux",
								Source:  "/cloudhub/v1/sources/2",
								Command: "SELECT winning_horses from grays_sports_alamanc where time > now() - 15m",
							},
						},
					},
				},
			},
			want: &dashboardResponse{
				Organization: "0",
				Type:         "normal",
				Templates:   []templateResponse{},
				Cells: []dashboardCellResponse{
					{
						Links: dashboardCellLinks{
							Self: "/cloudhub/v1/dashboards/0/cells/a",
						},
						DashboardCell: cloudhub.DashboardCell{
							ID: "a",
							W:  4,
							H:  4,
							Queries: []cloudhub.DashboardQuery{
								{
									Command: "SELECT donors from hill_valley_preservation_society where time > '1985-10-25 08:00:00'",
									Source:  "/cloudhub/v1/sources/1",
									QueryConfig: cloudhub.QueryConfig{
										RawText: &[]string{"SELECT donors from hill_valley_preservation_society where time > '1985-10-25 08:00:00'"}[0],
										Fields:  []cloudhub.Field{},
										GroupBy: cloudhub.GroupBy{
											Tags: []string{},
										},
										Tags:            make(map[string][]string, 0),
										AreTagsAccepted: false,
										Shifts: []cloudhub.TimeShift{
											{
												Label:    "Best Week Evar",
												Unit:     "d",
												Quantity: "7",
											},
										},
									},
									Type: "flux",
								},
							},
							CellColors: []cloudhub.CellColor{},
							Axes: map[string]cloudhub.Axis{
								"x": {
									Bounds: []string{"0", "100"},
								},
								"y": {
									Bounds: []string{"2", "95"},
									Label:  "foo",
								},
								"y2": {
									Bounds: []string{"", ""},
								},
							},
							NoteVisibility: "default",
						},
					},
					{
						Links: dashboardCellLinks{
							Self: "/cloudhub/v1/dashboards/0/cells/b",
						},
						DashboardCell: cloudhub.DashboardCell{
							ID: "b",
							W:  4,
							H:  4,
							Axes: map[string]cloudhub.Axis{
								"x": {
									Bounds: []string{"", ""},
								},
								"y": {
									Bounds: []string{"", ""},
								},
								"y2": {
									Bounds: []string{"", ""},
								},
							},
							CellColors: []cloudhub.CellColor{},
							Queries: []cloudhub.DashboardQuery{
								{
									Command: "SELECT winning_horses from grays_sports_alamanc where time > now() - 15m",
									Source:  "/cloudhub/v1/sources/2",
									QueryConfig: cloudhub.QueryConfig{
										Measurement: "grays_sports_alamanc",
										Fields: []cloudhub.Field{
											{
												Type:  "field",
												Value: "winning_horses",
											},
										},
										GroupBy: cloudhub.GroupBy{
											Tags: []string{},
										},
										Tags:            make(map[string][]string, 0),
										AreTagsAccepted: false,
										Range: &cloudhub.DurationRange{
											Lower: "now() - 15m",
										},
									},
									Type: "flux",
								},
							},
							NoteVisibility: "default",
						},
					},
				},
				Links: dashboardLinks{
					Self:      "/cloudhub/v1/dashboards/0",
					Cells:     "/cloudhub/v1/dashboards/0/cells",
					Templates: "/cloudhub/v1/dashboards/0/templates",
				},
			},
		},
		{
			name: "sets default width if width is zero",
			d: cloudhub.Dashboard{
				Organization: "0",
				Cells: []cloudhub.DashboardCell{
					{
						ID: "a",
						W:  0,
						H:  4,
					},
				},
			},
			want: &dashboardResponse{
				Organization: "0",
				Type:         "normal",
				Templates:    []templateResponse{},
				Cells: []dashboardCellResponse{
					{
						Links: dashboardCellLinks{
							Self: "/cloudhub/v1/dashboards/0/cells/a",
						},
						DashboardCell: cloudhub.DashboardCell{
							ID:             "a",
							W:              4,
							H:              4,
							NoteVisibility: "default",
							Queries:        []cloudhub.DashboardQuery{},
							CellColors:     []cloudhub.CellColor{},
							Axes: map[string]cloudhub.Axis{
								"x":  {Bounds: []string{"", ""}},
								"y":  {Bounds: []string{"", ""}},
								"y2": {Bounds: []string{"", ""}},
							},
						},
					},
				},
				Links: dashboardLinks{
					Self:      "/cloudhub/v1/dashboards/0",
					Cells:     "/cloudhub/v1/dashboards/0/cells",
					Templates: "/cloudhub/v1/dashboards/0/templates",
				},
			},
		},
		{
			name: "sets default height if height is zero",
			d: cloudhub.Dashboard{
				Organization: "0",
				Cells: []cloudhub.DashboardCell{
					{
						ID: "a",
						W:  4,
						H:  0,
					},
				},
			},
			want: &dashboardResponse{
				Organization: "0",
				Type:         "normal",
				Templates:    []templateResponse{},
				Cells: []dashboardCellResponse{
					{
						Links: dashboardCellLinks{
							Self: "/cloudhub/v1/dashboards/0/cells/a",
						},
						DashboardCell: cloudhub.DashboardCell{
							ID:             "a",
							W:              4,
							H:              4,
							NoteVisibility: "default",
							Queries:        []cloudhub.DashboardQuery{},
							CellColors:     []cloudhub.CellColor{},
							Axes: map[string]cloudhub.Axis{
								"x":  {Bounds: []string{"", ""}},
								"y":  {Bounds: []string{"", ""}},
								"y2": {Bounds: []string{"", ""}},
							},
						},
					},
				},
				Links: dashboardLinks{
					Self:      "/cloudhub/v1/dashboards/0",
					Cells:     "/cloudhub/v1/dashboards/0/cells",
					Templates: "/cloudhub/v1/dashboards/0/templates",
				},
			},
		},
		{
			name: "sets default height and width if height and width are zero",
			d: cloudhub.Dashboard{
				Organization: "0",
				Cells: []cloudhub.DashboardCell{
					{
						ID: "a",
						W:  0,
						H:  0,
					},
				},
			},
			want: &dashboardResponse{
				Organization: "0",
				Type:         "normal",
				Templates:    []templateResponse{},
				Cells: []dashboardCellResponse{
					{
						Links: dashboardCellLinks{
							Self: "/cloudhub/v1/dashboards/0/cells/a",
						},
						DashboardCell: cloudhub.DashboardCell{
							ID:             "a",
							W:              4,
							H:              4,
							NoteVisibility: "default",
							Queries:        []cloudhub.DashboardQuery{},
							CellColors:     []cloudhub.CellColor{},
							Axes: map[string]cloudhub.Axis{
								"x":  {Bounds: []string{"", ""}},
								"y":  {Bounds: []string{"", ""}},
								"y2": {Bounds: []string{"", ""}},
							},
						},
					},
				},
				Links: dashboardLinks{
					Self:      "/cloudhub/v1/dashboards/0",
					Cells:     "/cloudhub/v1/dashboards/0/cells",
					Templates: "/cloudhub/v1/dashboards/0/templates",
				},
			},
		},
		{
			name: "creates a dashboard response with Template Options",
			d: cloudhub.Dashboard{
				Organization: "0",
				Templates: []cloudhub.Template{
					{
						ID:   "t1",
						Type: "tagValues",
						Options: &cloudhub.TemplateOptions{
							IsAllEnabled: true,
						},
					},
				},
			},
			want: &dashboardResponse{
				Organization: "0",
				Type:         "normal",
				Templates: []templateResponse{
					{
						Template: cloudhub.Template{
							ID:   "t1",
							Type: "tagValues",
							Options: &cloudhub.TemplateOptions{
								IsAllEnabled: true,
							},
						},
						Links: templateLinks{
							Self: "/cloudhub/v1/dashboards/0/templates/t1",
						},
					},
				},
				Cells: []dashboardCellResponse{},
				Links: dashboardLinks{
					Self:      "/cloudhub/v1/dashboards/0",
					Cells:     "/cloudhub/v1/dashboards/0/cells",
					Templates: "/cloudhub/v1/dashboards/0/templates",
				},
			},
		},
		{
			name: "creates a dashboard response without Template Options",
			d: cloudhub.Dashboard{
				Organization: "0",
				Templates: []cloudhub.Template{
					{
						ID:   "t2",
						Type: "tagValues",
						// Options is nil
					},
				},
			},
			want: &dashboardResponse{
				Organization: "0",
				Type:         "normal",
				Templates: []templateResponse{
					{
						Template: cloudhub.Template{
							ID:   "t2",
							Type: "tagValues",
						},
						Links: templateLinks{
							Self: "/cloudhub/v1/dashboards/0/templates/t2",
						},
					},
				},
				Cells: []dashboardCellResponse{},
				Links: dashboardLinks{
					Self:      "/cloudhub/v1/dashboards/0",
					Cells:     "/cloudhub/v1/dashboards/0/cells",
					Templates: "/cloudhub/v1/dashboards/0/templates",
				},
			},
		},
	}
	for _, tt := range tests {
		for i := range tt.want.Cells {
			applyTableGaugeDefaults(&tt.want.Cells[i].DashboardCell)
		}
		if got := newDashboardResponse(tt.d); !gocmp.Equal(got, tt.want) {
			t.Errorf("%q. newDashboardResponse() = diff:\n%s", tt.name, gocmp.Diff(got, tt.want))
		}
	}
}

func TestDashboard_TableGaugeChartOptions_ValueFormat(t *testing.T) {
	tests := []struct {
		name string
		d    cloudhub.Dashboard
		want cloudhub.Dashboard
	}{
		{
			name: "empty ValueFormat remains empty (frontend handles default)",
			d: cloudhub.Dashboard{
				Organization: "1337",
				Cells: []cloudhub.DashboardCell{
					{
						W: 4,
						H: 4,
						TableGaugeChartOptions: cloudhub.TableGaugeChartOptions{
							ColumnSettings: []cloudhub.ColumnSetting{
								{
									InternalName: "cpu",
									DisplayName:  "CPU Usage",
									Visible:      true,
									// ValueFormat not provided, should remain empty
								},
							},
						},
					},
				},
			},
			want: cloudhub.Dashboard{
				Organization: "1337",
				Type:         "normal",
				Cells: []cloudhub.DashboardCell{
					{
						W: 4,
						H: 4,
						TableGaugeChartOptions: cloudhub.TableGaugeChartOptions{
							ColumnSettings: []cloudhub.ColumnSetting{
								{
									InternalName: "cpu",
									DisplayName:  "CPU Usage",
									Visible:      true,
									ValueFormat:  "",
								},
							},
							DecimalPlaces: cloudhub.DecimalPlaces{
								IsEnforced: false,
								Digits:     0,
							},
							IsShowValues:    true,
							SortBy:          "name",
							SortByDirection: "asc",
						},
					},
				},
			},
		},
		{
			name: "preserves provided ValueFormat",
			d: cloudhub.Dashboard{
				Organization: "1337",
				Cells: []cloudhub.DashboardCell{
					{
						W: 4,
						H: 4,
						TableGaugeChartOptions: cloudhub.TableGaugeChartOptions{
							ColumnSettings: []cloudhub.ColumnSetting{
								{
									InternalName: "memory",
									DisplayName:  "Memory Usage",
									Visible:      true,
									ValueFormat:  "KMB",
								},
								{
									InternalName: "disk",
									DisplayName:  "Disk Usage",
									Visible:      true,
									ValueFormat:  "KMG",
								},
							},
							IsShowValues:    true,
							SortBy:          "memory",
							SortByDirection: "desc",
						},
					},
				},
			},
			want: cloudhub.Dashboard{
				Organization: "1337",
				Type:         "normal",
				Cells: []cloudhub.DashboardCell{
					{
						W: 4,
						H: 4,
						TableGaugeChartOptions: cloudhub.TableGaugeChartOptions{
							ColumnSettings: []cloudhub.ColumnSetting{
								{
									InternalName: "memory",
									DisplayName:  "Memory Usage",
									Visible:      true,
									ValueFormat:  "KMB",
								},
								{
									InternalName: "disk",
									DisplayName:  "Disk Usage",
									Visible:      true,
									ValueFormat:  "KMG",
								},
							},
							DecimalPlaces: cloudhub.DecimalPlaces{
								IsEnforced: false,
								Digits:     0,
							},
							IsShowValues:    true,
							SortBy:          "memory",
							SortByDirection: "desc",
						},
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := DashboardDefaults(tt.d)
			want := tt.want
			for i := range want.Cells {
				applyTableGaugeDefaults(&want.Cells[i])
			}
			if !gocmp.Equal(actual, want) {
				t.Errorf("DashboardDefaults() = diff:\n%s", gocmp.Diff(actual, want))
			}
		})
	}
}

func TestValidDashboardRequest_TableGaugeChartOptions_ValueFormat(t *testing.T) {
	tests := []struct {
		name    string
		d       cloudhub.Dashboard
		want    cloudhub.Dashboard
		wantErr bool
	}{
		{
			name: "empty ValueFormat remains empty in validation",
			d: cloudhub.Dashboard{
				Organization: "1337",
				Cells: []cloudhub.DashboardCell{
					{
						W: 4,
						H: 4,
						Queries: []cloudhub.DashboardQuery{
							{
								Command: "SELECT * FROM cpu",
								Type:    "influxql",
							},
						},
						TableGaugeChartOptions: cloudhub.TableGaugeChartOptions{
							ColumnSettings: []cloudhub.ColumnSetting{
								{
									InternalName: "cpu",
									DisplayName:  "CPU",
									Visible:      true,
								},
							},
						},
					},
				},
			},
			want: cloudhub.Dashboard{
				Organization: "1337",
				Type:         "normal",
				Cells: []cloudhub.DashboardCell{
					{
						W: 4,
						H: 4,
						Queries: []cloudhub.DashboardQuery{
							{
								Command: "SELECT * FROM cpu",
								Type:    "influxql",
							},
						},
						TableGaugeChartOptions: cloudhub.TableGaugeChartOptions{
							ColumnSettings: []cloudhub.ColumnSetting{
								{
									InternalName: "cpu",
									DisplayName:  "CPU",
									Visible:      true,
									ValueFormat:  "",
								},
							},
							DecimalPlaces: cloudhub.DecimalPlaces{
								IsEnforced: false,
								Digits:     0,
							},
							IsShowValues:    false,
							SortBy:          "name",
							SortByDirection: "asc",
						},
						NoteVisibility: "default",
					},
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidDashboardRequest(&tt.d, "0")
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidDashboardRequest() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			for i := range tt.want.Cells {
				applyTableGaugeDefaults(&tt.want.Cells[i])
			}
			if diff := gocmp.Diff(tt.d, tt.want); diff != "" {
				t.Errorf("ValidDashboardRequest() diff:\n%s", diff)
			}
		})
	}
}

func TestSetBuiltinVersionInfo(t *testing.T) {
	ctx := context.Background()
	tests := []struct {
		name       string
		d          cloudhub.Dashboard
		getVersion func(context.Context, string) string
		wantLatest string
		wantUpdate bool
	}{
		{
			name: "non-builtin dashboard leaves response unchanged",
			d: cloudhub.Dashboard{
				Type:    "normal",
				Name:    "my-dash",
				Version: "1.0.0",
			},
			getVersion: func(ctx context.Context, name string) string { return "1.1.0" },
			wantLatest: "",
			wantUpdate: false,
		},
		{
			name: "builtin with no latest version in store",
			d: cloudhub.Dashboard{
				Type:    "builtin",
				Name:    "host_page",
				Version: "1.0.0",
			},
			getVersion: func(ctx context.Context, name string) string { return "" },
			wantLatest: "",
			wantUpdate: false,
		},
		{
			name: "builtin same version as latest",
			d: cloudhub.Dashboard{
				Type:    "builtin",
				Name:    "host_page",
				Version: "1.0.0",
			},
			getVersion: func(ctx context.Context, name string) string { return "1.0.0" },
			wantLatest: "1.0.0",
			wantUpdate: false,
		},
		{
			name: "builtin older version than latest",
			d: cloudhub.Dashboard{
				Type:    "builtin",
				Name:    "host_page",
				Version: "1.0.0",
			},
			getVersion: func(ctx context.Context, name string) string { return "1.1.0" },
			wantLatest: "1.1.0",
			wantUpdate: true,
		},
		{
			name: "builtin legacy dashboard with no version",
			d: cloudhub.Dashboard{
				Type:    "builtin",
				Name:    "host_page",
				Version: "",
			},
			getVersion: func(ctx context.Context, name string) string { return "1.0.0" },
			wantLatest: "1.0.0",
			wantUpdate: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := &dashboardResponse{}
			setBuiltinVersionInfo(resp, tt.d, tt.getVersion, ctx)
			if resp.LatestVersion != tt.wantLatest {
				t.Errorf("LatestVersion = %q, want %q", resp.LatestVersion, tt.wantLatest)
			}
			if resp.UpdateAvailable != tt.wantUpdate {
				t.Errorf("UpdateAvailable = %v, want %v", resp.UpdateAvailable, tt.wantUpdate)
			}
		})
	}
}

func Test_newDashboardResponse_includesVersion(t *testing.T) {
	d := cloudhub.Dashboard{
		ID:            cloudhub.DashboardID(1),
		Name:          "host_page",
		Organization:  "org1",
		Type:          "builtin",
		Version:       "1.0.0",
		Cells:         []cloudhub.DashboardCell{},
		Templates:     []cloudhub.Template{},
	}
	got := newDashboardResponse(d)
	if got.Version != "1.0.0" {
		t.Errorf("Version = %q, want 1.0.0", got.Version)
	}
	if got.Type != "builtin" {
		t.Errorf("Type = %q, want builtin", got.Type)
	}
	// LatestVersion and UpdateAvailable are set by setBuiltinVersionInfo in handlers, not newDashboardResponse
	if got.LatestVersion != "" {
		t.Errorf("LatestVersion = %q, want empty (set by handler)", got.LatestVersion)
	}
}
