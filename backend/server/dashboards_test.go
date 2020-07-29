package server

import (
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
		if actual := DashboardDefaults(tt.d); !reflect.DeepEqual(actual, tt.want) {
			t.Errorf("%q. DashboardDefaults() = %v, want %v", tt.name, tt.d, tt.want)
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
				Templates:    []templateResponse{},
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
	}
	for _, tt := range tests {
		if got := newDashboardResponse(tt.d); !gocmp.Equal(got, tt.want) {
			t.Errorf("%q. newDashboardResponse() = diff:\n%s", tt.name, gocmp.Diff(got, tt.want))
		}
	}
}
