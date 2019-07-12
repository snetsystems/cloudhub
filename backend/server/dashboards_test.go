package server

import (
	"reflect"
	"testing"

	gocmp "github.com/google/go-cmp/cmp"
	cmp "github.com/snetsystems/cmp/backend"
)

func TestCorrectWidthHeight(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		cell cmp.DashboardCell
		want cmp.DashboardCell
	}{
		{
			name: "updates width",
			cell: cmp.DashboardCell{
				W: 0,
				H: 4,
			},
			want: cmp.DashboardCell{
				W: 4,
				H: 4,
			},
		},
		{
			name: "updates height",
			cell: cmp.DashboardCell{
				W: 4,
				H: 0,
			},
			want: cmp.DashboardCell{
				W: 4,
				H: 4,
			},
		},
		{
			name: "updates both",
			cell: cmp.DashboardCell{
				W: 0,
				H: 0,
			},
			want: cmp.DashboardCell{
				W: 4,
				H: 4,
			},
		},
		{
			name: "updates neither",
			cell: cmp.DashboardCell{
				W: 4,
				H: 4,
			},
			want: cmp.DashboardCell{
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
		d    cmp.Dashboard
		want cmp.Dashboard
	}{
		{
			name: "Updates all cell widths/heights",
			d: cmp.Dashboard{
				Cells: []cmp.DashboardCell{
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
			want: cmp.Dashboard{
				Cells: []cmp.DashboardCell{
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
			d: cmp.Dashboard{
				Cells: []cmp.DashboardCell{
					{
						W: 4,
						H: 4,
					}, {
						W: 2,
						H: 2,
					},
				},
			},
			want: cmp.Dashboard{
				Cells: []cmp.DashboardCell{
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
		if actual := DashboardDefaults(tt.d); !reflect.DeepEqual(actual, tt.want) {
			t.Errorf("%q. DashboardDefaults() = %v, want %v", tt.name, tt.d, tt.want)
		}
	}
}

func TestValidDashboardRequest(t *testing.T) {
	tests := []struct {
		name    string
		d       cmp.Dashboard
		want    cmp.Dashboard
		wantErr bool
	}{
		{
			name: "Updates all cell widths/heights",
			d: cmp.Dashboard{
				Organization: "1337",
				Cells: []cmp.DashboardCell{
					{
						W: 0,
						H: 0,
						Queries: []cmp.DashboardQuery{
							{
								Command: "SELECT donors from hill_valley_preservation_society where time > 1985-10-25T08:00:00",
								Type:    "influxql",
							},
						},
					},
					{
						W: 2,
						H: 2,
						Queries: []cmp.DashboardQuery{
							{
								Command: "SELECT winning_horses from grays_sports_alamanc where time > 1955-11-1T00:00:00",
								Type:    "influxql",
							},
						},
					},
				},
			},
			want: cmp.Dashboard{
				Organization: "1337",
				Cells: []cmp.DashboardCell{
					{
						W: 4,
						H: 4,
						Queries: []cmp.DashboardQuery{
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
						Queries: []cmp.DashboardQuery{
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
	}
	for _, tt := range tests {
		// TODO(desa): this Okay?
		err := ValidDashboardRequest(&tt.d, "0")
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. ValidDashboardRequest() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		if diff := gocmp.Diff(tt.d, tt.want); diff != "" {
			t.Errorf("%q. ValidDashboardRequest(). got/want diff:\n%s", tt.name, diff)
		}
	}
}

func Test_newDashboardResponse(t *testing.T) {
	tests := []struct {
		name string
		d    cmp.Dashboard
		want *dashboardResponse
	}{
		{
			name: "creates a dashboard response",
			d: cmp.Dashboard{
				Organization: "0",
				Cells: []cmp.DashboardCell{
					{
						ID: "a",
						W:  0,
						H:  0,
						Queries: []cmp.DashboardQuery{
							{
								Source:  "/cmp/v1/sources/1",
								Command: "SELECT donors from hill_valley_preservation_society where time > '1985-10-25 08:00:00'",
								Shifts: []cmp.TimeShift{
									{
										Label:    "Best Week Evar",
										Unit:     "d",
										Quantity: "7",
									},
								},
								Type: "flux",
							},
						},
						Axes: map[string]cmp.Axis{
							"x": cmp.Axis{
								Bounds: []string{"0", "100"},
							},
							"y": cmp.Axis{
								Bounds: []string{"2", "95"},
								Label:  "foo",
							},
						},
					},
					{
						ID: "b",
						W:  0,
						H:  0,
						Queries: []cmp.DashboardQuery{
							{
								Type:    "flux",
								Source:  "/cmp/v1/sources/2",
								Command: "SELECT winning_horses from grays_sports_alamanc where time > now() - 15m",
							},
						},
					},
				},
			},
			want: &dashboardResponse{
				Organization: "0",
				Templates:    []templateResponse{},
				Cells: []dashboardCellResponse{
					dashboardCellResponse{
						Links: dashboardCellLinks{
							Self: "/cmp/v1/dashboards/0/cells/a",
						},
						DashboardCell: cmp.DashboardCell{
							ID: "a",
							W:  4,
							H:  4,
							Queries: []cmp.DashboardQuery{
								{
									Command: "SELECT donors from hill_valley_preservation_society where time > '1985-10-25 08:00:00'",
									Source:  "/cmp/v1/sources/1",
									QueryConfig: cmp.QueryConfig{
										RawText: &[]string{"SELECT donors from hill_valley_preservation_society where time > '1985-10-25 08:00:00'"}[0],
										Fields:  []cmp.Field{},
										GroupBy: cmp.GroupBy{
											Tags: []string{},
										},
										Tags:            make(map[string][]string, 0),
										AreTagsAccepted: false,
										Shifts: []cmp.TimeShift{
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
							CellColors: []cmp.CellColor{},
							Axes: map[string]cmp.Axis{
								"x": cmp.Axis{
									Bounds: []string{"0", "100"},
								},
								"y": cmp.Axis{
									Bounds: []string{"2", "95"},
									Label:  "foo",
								},
								"y2": cmp.Axis{
									Bounds: []string{"", ""},
								},
							},
							NoteVisibility: "default",
						},
					},
					dashboardCellResponse{
						Links: dashboardCellLinks{
							Self: "/cmp/v1/dashboards/0/cells/b",
						},
						DashboardCell: cmp.DashboardCell{
							ID: "b",
							W:  4,
							H:  4,
							Axes: map[string]cmp.Axis{
								"x": cmp.Axis{
									Bounds: []string{"", ""},
								},
								"y": cmp.Axis{
									Bounds: []string{"", ""},
								},
								"y2": cmp.Axis{
									Bounds: []string{"", ""},
								},
							},
							CellColors: []cmp.CellColor{},
							Queries: []cmp.DashboardQuery{
								{
									Command: "SELECT winning_horses from grays_sports_alamanc where time > now() - 15m",
									Source:  "/cmp/v1/sources/2",
									QueryConfig: cmp.QueryConfig{
										Measurement: "grays_sports_alamanc",
										Fields: []cmp.Field{
											{
												Type:  "field",
												Value: "winning_horses",
											},
										},
										GroupBy: cmp.GroupBy{
											Tags: []string{},
										},
										Tags:            make(map[string][]string, 0),
										AreTagsAccepted: false,
										Range: &cmp.DurationRange{
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
					Self:      "/cmp/v1/dashboards/0",
					Cells:     "/cmp/v1/dashboards/0/cells",
					Templates: "/cmp/v1/dashboards/0/templates",
				},
			},
		},
	}
	for _, tt := range tests {
		if got := newDashboardResponse(tt.d); !gocmp.Equal(got, tt.want) {
			t.Errorf("%q. newDashboardResponse() = diff:\n%s", tt.name, gocmp.Diff(got, tt.want))
		}
	}
}
