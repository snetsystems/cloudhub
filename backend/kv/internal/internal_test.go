package internal_test

import (
	"reflect"
	"testing"

	gocmp "github.com/google/go-cmp/cmp"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

// dashboardRoundtripNormalizeType fixes actual.Type for roundtrip compare: empty Type is normalized to "normal" by getDashboardType in internal.go.
func dashboardRoundtripNormalizeType(orig, actual *cloudhub.Dashboard) {
	if orig.Type == "" && actual.Type == "normal" {
		actual.Type = ""
	}
}

func TestMarshalSource(t *testing.T) {
	v := cloudhub.Source{
		ID:       12,
		Name:     "Fountain of Truth",
		Type:     "influx",
		Username: "docbrown",
		Password: "1 point twenty-one g1g@w@tts",
		URL:      "http://twin-pines.mall.io:8086",
		MetaURL:  "http://twin-pines.meta.io:8086",
		Default:  true,
		Telegraf: "telegraf",
	}

	var vv cloudhub.Source
	if buf, err := internal.MarshalSource(v); err != nil {
		t.Fatal(err)
	} else if err := internal.UnmarshalSource(buf, &vv); err != nil {
		t.Fatal(err)
	} else if !reflect.DeepEqual(v, vv) {
		t.Fatalf("source protobuf copy error: got %#v, expected %#v", vv, v)
	}

	// Test if the new insecureskipverify works
	v.InsecureSkipVerify = true
	if buf, err := internal.MarshalSource(v); err != nil {
		t.Fatal(err)
	} else if err := internal.UnmarshalSource(buf, &vv); err != nil {
		t.Fatal(err)
	} else if !reflect.DeepEqual(v, vv) {
		t.Fatalf("source protobuf copy error: got %#v, expected %#v", vv, v)
	}
}
func TestMarshalSourceWithSecret(t *testing.T) {
	v := cloudhub.Source{
		ID:           12,
		Name:         "Fountain of Truth",
		Type:         "influx",
		Username:     "docbrown",
		SharedSecret: "hunter2s",
		URL:          "http://twin-pines.mall.io:8086",
		MetaURL:      "http://twin-pines.meta.io:8086",
		Default:      true,
		Telegraf:     "telegraf",
	}

	var vv cloudhub.Source
	if buf, err := internal.MarshalSource(v); err != nil {
		t.Fatal(err)
	} else if err := internal.UnmarshalSource(buf, &vv); err != nil {
		t.Fatal(err)
	} else if !reflect.DeepEqual(v, vv) {
		t.Fatalf("source protobuf copy error: got %#v, expected %#v", vv, v)
	}

	// Test if the new insecureskipverify works
	v.InsecureSkipVerify = true
	if buf, err := internal.MarshalSource(v); err != nil {
		t.Fatal(err)
	} else if err := internal.UnmarshalSource(buf, &vv); err != nil {
		t.Fatal(err)
	} else if !reflect.DeepEqual(v, vv) {
		t.Fatalf("source protobuf copy error: got %#v, expected %#v", vv, v)
	}
}

func TestMarshalServer(t *testing.T) {
	v := cloudhub.Server{
		ID:                 12,
		SrcID:              2,
		Name:               "Fountain of Truth",
		Username:           "docbrown",
		Password:           "1 point twenty-one g1g@w@tts",
		URL:                "http://oldmanpeabody.mall.io:9092",
		InsecureSkipVerify: true,
	}

	var vv cloudhub.Server
	if buf, err := internal.MarshalServer(v); err != nil {
		t.Fatal(err)
	} else if err := internal.UnmarshalServer(buf, &vv); err != nil {
		t.Fatal(err)
	} else if !reflect.DeepEqual(v, vv) {
		t.Fatalf("source protobuf copy error: got %#v, expected %#v", vv, v)
	}
}

func TestMarshalLayout(t *testing.T) {
	layout := cloudhub.Layout{
		ID:          "id",
		Measurement: "measurement",
		Application: "app",
		Cells: []cloudhub.Cell{
			{
				X:    1,
				Y:    1,
				W:    4,
				H:    4,
				I:    "anotherid",
				Type: "line",
				Name: "cell1",
				Axes: map[string]cloudhub.Axis{
					"y": {
						Bounds: []string{"0", "100"},
						Label:  "foo",
					},
				},
				Queries: []cloudhub.Query{
					{
						Range: &cloudhub.Range{
							Lower: 1,
							Upper: 2,
						},
						Label:   "y1",
						Command: "select mean(usage_user) as usage_user from cpu",
						Wheres: []string{
							`"host"="myhost"`,
						},
						GroupBys: []string{
							`"cpu"`,
						},
					},
				},
				TableOptions:  cloudhub.TableOptions{},
				FieldOptions:  []cloudhub.RenamableField{},
				DecimalPlaces: cloudhub.DecimalPlaces{},
			},
		},
	}

	var vv cloudhub.Layout
	if buf, err := internal.MarshalLayout(layout); err != nil {
		t.Fatal(err)
	} else if err := internal.UnmarshalLayout(buf, &vv); err != nil {
		t.Fatal(err)
	} else if !gocmp.Equal(layout, vv) {
		t.Fatal("source protobuf copy error: diff:\n", gocmp.Diff(layout, vv))
	}
}

func Test_MarshalDashboard(t *testing.T) {
	dashboard := cloudhub.Dashboard{
		ID: 1,
		Cells: []cloudhub.DashboardCell{
			{
				ID:   "9b5367de-c552-4322-a9e8-7f384cbd235c",
				X:    0,
				Y:    0,
				W:    4,
				H:    4,
				MinW: 10,
				MinH: 10,
				Name: "Super awesome query",
				Queries: []cloudhub.DashboardQuery{
					{
						Command: "select * from cpu",
						Label:   "CPU Utilization",
						Range: &cloudhub.Range{
							Upper: int64(100),
						},
						Source:        "/cloudhub/v1/sources/1",
						Shifts:        []cloudhub.TimeShift{},
						Type:          "influxql",
						QueryTargetOS: "linux",
					},
				},
				Axes: map[string]cloudhub.Axis{
					"y": {
						Bounds: []string{"0", "3", "1-7", "foo"},
						Label:  "foo",
						Prefix: "M",
						Suffix: "m",
						Base:   "2",
						Scale:  "roflscale",
					},
				},
				Type: "line",
				CellColors: []cloudhub.CellColor{
					{
						ID:    "myid",
						Type:  "min",
						Hex:   "#234567",
						Name:  "Laser",
						Value: "0",
					},
					{
						ID:    "id2",
						Type:  "max",
						Hex:   "#876543",
						Name:  "Solitude",
						Value: "100",
					},
				},
				TableOptions: cloudhub.TableOptions{},
				FieldOptions: []cloudhub.RenamableField{},
				TimeFormat:   "",
				GraphOptions: cloudhub.GraphOptions{
					FillArea:         true,
					ShowLine:         true,
					ShowPoint:        false,
					ShowTempVarCount: "",
				},
				TableGaugeChartOptions: cloudhub.TableGaugeChartOptions{
					ColumnSettings: []cloudhub.ColumnSetting{},
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
		Templates: []cloudhub.Template{},
		Name:      "Dashboard",
	}

	var actual cloudhub.Dashboard
	if buf, err := internal.MarshalDashboard(dashboard); err != nil {
		t.Fatal("Error marshaling dashboard: err", err)
	} else if err := internal.UnmarshalDashboard(buf, &actual); err != nil {
		t.Fatal("Error unmarshaling dashboard: err:", err)
	} else {
		dashboardRoundtripNormalizeType(&dashboard, &actual)
		if !gocmp.Equal(dashboard, actual) {
			t.Fatalf("Dashboard protobuf copy error: diff follows:\n%s", gocmp.Diff(dashboard, actual))
		}
	}
}

func Test_MarshalDashboard_CellHidden(t *testing.T) {
	// Clone Test_MarshalDashboard dashboard and set Hidden on the cell
	dashboard := cloudhub.Dashboard{
		ID: 2,
		Cells: []cloudhub.DashboardCell{
			{
				ID:   "9b5367de-c552-4322-a9e8-7f384cbd235c",
				X:    0,
				Y:    0,
				W:    4,
				H:    4,
				MinW: 10,
				MinH: 10,
				Name: "Super awesome query",
				Queries: []cloudhub.DashboardQuery{
					{
						Command: "select * from cpu",
						Label:   "CPU Utilization",
						Range:   &cloudhub.Range{Upper: int64(100)},
						Source:  "/cloudhub/v1/sources/1",
						Shifts:  []cloudhub.TimeShift{},
						Type:    "influxql",
					},
				},
				Axes: map[string]cloudhub.Axis{
					"y": {Bounds: []string{"0", "3", "1-7", "foo"}, Label: "foo", Prefix: "M", Suffix: "m", Base: "2", Scale: "roflscale"},
				},
				Type: "line",
				CellColors: []cloudhub.CellColor{
					{ID: "myid", Type: "min", Hex: "#234567", Name: "Laser", Value: "0"},
					{ID: "id2", Type: "max", Hex: "#876543", Name: "Solitude", Value: "100"},
				},
				TableOptions: cloudhub.TableOptions{},
				FieldOptions: []cloudhub.RenamableField{},
				TimeFormat:   "",
				GraphOptions: cloudhub.GraphOptions{FillArea: true, ShowLine: true, ShowPoint: false, ShowTempVarCount: ""},
				TableGaugeChartOptions: cloudhub.TableGaugeChartOptions{
					ColumnSettings: []cloudhub.ColumnSetting{},
					DecimalPlaces:  cloudhub.DecimalPlaces{IsEnforced: false, Digits: 0},
					IsShowValues:   true, SortBy: "name", SortByDirection: "asc",
				},
				Hidden: true,
			},
		},
		Templates: []cloudhub.Template{},
		Name:      "WithHidden",
	}
	var actual cloudhub.Dashboard
	if buf, err := internal.MarshalDashboard(dashboard); err != nil {
		t.Fatal("MarshalDashboard err:", err)
	} else if err := internal.UnmarshalDashboard(buf, &actual); err != nil {
		t.Fatal("UnmarshalDashboard err:", err)
	}
	if len(actual.Cells) != 1 {
		t.Fatalf("len(actual.Cells) = %d, want 1", len(actual.Cells))
	}
	if !actual.Cells[0].Hidden {
		t.Error("Cells[0].Hidden = false, want true after roundtrip")
	}
}

func Test_MarshalDashboard_WithTemplateOptions(t *testing.T) {
	dashboard := cloudhub.Dashboard{
		ID: 1,
		Templates: []cloudhub.Template{
			{
				ID:   "t1",
				Type: "tagValues",
				Options: &cloudhub.TemplateOptions{
					IsAllEnabled: true,
				},
				TemplateVar: cloudhub.TemplateVar{
					Var:    "host",
					Values: []cloudhub.TemplateValue{},
				},
			},
			{
				ID:   "t2",
				Type: "tagValues",
				// Options is nil
				TemplateVar: cloudhub.TemplateVar{
					Var:    "region",
					Values: []cloudhub.TemplateValue{},
				},
			},
		},
		Cells: []cloudhub.DashboardCell{},
	}

	var actual cloudhub.Dashboard
	if buf, err := internal.MarshalDashboard(dashboard); err != nil {
		t.Fatal("Error marshaling dashboard: err", err)
	} else if err := internal.UnmarshalDashboard(buf, &actual); err != nil {
		t.Fatal("Error unmarshaling dashboard: err:", err)
	} else {
		dashboardRoundtripNormalizeType(&dashboard, &actual)
		if !gocmp.Equal(dashboard, actual) {
			t.Fatalf("Dashboard protobuf copy error: diff follows:\n%s", gocmp.Diff(dashboard, actual))
		}
	}
}

func Test_MarshalDashboard_WithLegacyBounds(t *testing.T) {
	dashboard := cloudhub.Dashboard{
		ID: 1,
		Cells: []cloudhub.DashboardCell{
			{
				ID:   "9b5367de-c552-4322-a9e8-7f384cbd235c",
				X:    0,
				Y:    0,
				W:    4,
				H:    4,
				Name: "Super awesome query",
				Queries: []cloudhub.DashboardQuery{
					{
						Command: "select * from cpu",
						Label:   "CPU Utilization",
						Range: &cloudhub.Range{
							Upper: int64(100),
						},
						Shifts: []cloudhub.TimeShift{},
						Type:   "influxql",
					},
				},
				Axes: map[string]cloudhub.Axis{
					"y": {
						LegacyBounds: [2]int64{0, 5},
					},
				},
				CellColors: []cloudhub.CellColor{
					{
						ID:    "myid",
						Type:  "min",
						Hex:   "#234567",
						Name:  "Laser",
						Value: "0",
					},
					{
						ID:    "id2",
						Type:  "max",
						Hex:   "#876543",
						Name:  "Solitude",
						Value: "100",
					},
				},
				Legend: cloudhub.Legend{
					Type:        "static",
					Orientation: "bottom",
				},
				TableOptions: cloudhub.TableOptions{},
				TimeFormat:   "MM:DD:YYYY",
				FieldOptions: []cloudhub.RenamableField{},
				Type:         "line",
				GraphOptions: cloudhub.GraphOptions{
					FillArea:         true,
					ShowLine:         true,
					ShowPoint:        false,
					ShowTempVarCount: "",
				},
				TableGaugeChartOptions: cloudhub.TableGaugeChartOptions{
					ColumnSettings: []cloudhub.ColumnSetting{},
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
		Templates: []cloudhub.Template{},
		Name:      "Dashboard",
	}

	expected := cloudhub.Dashboard{
		ID: 1,
		Cells: []cloudhub.DashboardCell{
			{
				ID:   "9b5367de-c552-4322-a9e8-7f384cbd235c",
				X:    0,
				Y:    0,
				W:    4,
				H:    4,
				Name: "Super awesome query",
				Queries: []cloudhub.DashboardQuery{
					{
						Command: "select * from cpu",
						Label:   "CPU Utilization",
						Range: &cloudhub.Range{
							Upper: int64(100),
						},
						Shifts: []cloudhub.TimeShift{},
						Type:   "influxql",
					},
				},
				Axes: map[string]cloudhub.Axis{
					"y": {
						Base:  "10",
						Scale: "linear",
					},
				},
				CellColors: []cloudhub.CellColor{
					{
						ID:    "myid",
						Type:  "min",
						Hex:   "#234567",
						Name:  "Laser",
						Value: "0",
					},
					{
						ID:    "id2",
						Type:  "max",
						Hex:   "#876543",
						Name:  "Solitude",
						Value: "100",
					},
				},
				Legend: cloudhub.Legend{
					Type:        "static",
					Orientation: "bottom",
				},
				TableOptions: cloudhub.TableOptions{},
				FieldOptions: []cloudhub.RenamableField{},
				TimeFormat:   "MM:DD:YYYY",
				Type:         "line",
				GraphOptions: cloudhub.GraphOptions{
					FillArea:         true,
					ShowLine:         true,
					ShowPoint:        false,
					ShowTempVarCount: "",
				},
				TableGaugeChartOptions: cloudhub.TableGaugeChartOptions{
					ColumnSettings: []cloudhub.ColumnSetting{},
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
		Templates: []cloudhub.Template{},
		Name:      "Dashboard",
	}

	var actual cloudhub.Dashboard
	if buf, err := internal.MarshalDashboard(dashboard); err != nil {
		t.Fatal("Error marshaling dashboard: err", err)
	} else if err := internal.UnmarshalDashboard(buf, &actual); err != nil {
		t.Fatal("Error unmarshaling dashboard: err:", err)
	} else {
		dashboardRoundtripNormalizeType(&dashboard, &actual)
		if !gocmp.Equal(expected, actual) {
			t.Fatalf("Dashboard protobuf copy error: diff follows:\n%s", gocmp.Diff(expected, actual))
		}
	}
}

func Test_MarshalDashboard_WithTableGaugeChartOptions(t *testing.T) {
	dashboard := cloudhub.Dashboard{
		ID: 1,
		Cells: []cloudhub.DashboardCell{
			{
				ID:   "cell-table-gauge",
				X:    0,
				Y:    0,
				W:    4,
				H:    4,
				MinW: 2,
				MinH: 2,
				Name: "Table gauge",
				Type: "table-gauge",
				Axes: map[string]cloudhub.Axis{
					"y": {
						Bounds: []string{"", ""},
						Base:   "10",
						Scale:  "linear",
					},
				},
				Queries: []cloudhub.DashboardQuery{
					{
						Command: "SELECT * FROM cpu",
						Label:   "cpu",
						Type:    "influxql",
						Shifts:  []cloudhub.TimeShift{},
					},
				},
				CellColors: []cloudhub.CellColor{
					{ID: "c1", Type: "min", Hex: "#00FF00", Name: "min", Value: "0"},
				},
				GraphOptions: cloudhub.GraphOptions{
					FillArea:         true,
					ShowLine:         true,
					ShowPoint:        false,
					ShowTempVarCount: "",
				},
				TableGaugeChartOptions: cloudhub.TableGaugeChartOptions{
					ColumnSettings: []cloudhub.ColumnSetting{
						{
							InternalName: "cpu",
							DisplayName:  "CPU",
							Visible:      true,
							Direction:    "asc",
							Min:          0,
							Max:          100,
							Colors: []cloudhub.CellColor{
								{ID: "gc1", Type: "min", Hex: "#00C9FF", Name: "laser", Value: "0"},
							},
							ThresholdColors: []cloudhub.CellColor{
								{ID: "gt1", Type: "max", Hex: "#9394FF", Name: "comet", Value: "100"},
							},
							Unit:           "%",
							Prefix:         "",
							Suffix:         "%",
							IsShowChart:    true,
							IsPercent:      true,
							ChartType:      "continuous",
							BackgroundType: "gradient",
							IsShowValues:   true,
							ValueFormat:    "KMB",
						},
					},
					DecimalPlaces: cloudhub.DecimalPlaces{
						IsEnforced: true,
						Digits:     2,
					},
					IsShowValues:    true,
					SortBy:          "cpu",
					SortByDirection: "desc",
				},
				FieldOptions: []cloudhub.RenamableField{},
			},
		},
		Templates: []cloudhub.Template{},
	}

	var actual cloudhub.Dashboard
	buf, err := internal.MarshalDashboard(dashboard)
	if err != nil {
		t.Fatal("Error marshaling dashboard with table gauge options:", err)
	}
	if err := internal.UnmarshalDashboard(buf, &actual); err != nil {
		t.Fatal("Error unmarshaling dashboard with table gauge options:", err)
	}

	dashboardRoundtripNormalizeType(&dashboard, &actual)
	if !gocmp.Equal(dashboard, actual) {
		t.Fatalf("Dashboard protobuf copy error with table gauge options: diff follows:\n%s", gocmp.Diff(dashboard, actual))
	}
}

func Test_MarshalDashboard_WithCellOrigin(t *testing.T) {
	dashboard := cloudhub.Dashboard{
		ID: 1,
		Cells: []cloudhub.DashboardCell{
			{
				ID:         "cell-builtin",
				X:          0,
				Y:          0,
				W:          4,
				H:          4,
				MinW:       2,
				MinH:       2,
				Name:       "Builtin cell",
				Type:       "line",
				Queries:    []cloudhub.DashboardQuery{},
				Axes:       map[string]cloudhub.Axis{},
				CellOrigin: cloudhub.CellOriginBuiltin,
			},
			{
				ID:         "cell-user",
				X:          4,
				Y:          0,
				W:          4,
				H:          4,
				MinW:       2,
				MinH:       2,
				Name:       "User cell",
				Type:       "line",
				Queries:    []cloudhub.DashboardQuery{},
				Axes:       map[string]cloudhub.Axis{},
				CellOrigin: cloudhub.CellOriginUser,
			},
		},
		Templates: []cloudhub.Template{},
		Name:      "Dashboard with cell origin",
	}

	var actual cloudhub.Dashboard
	buf, err := internal.MarshalDashboard(dashboard)
	if err != nil {
		t.Fatal("Error marshaling dashboard with cell origin:", err)
	}
	if err := internal.UnmarshalDashboard(buf, &actual); err != nil {
		t.Fatal("Error unmarshaling dashboard with cell origin:", err)
	}

	if len(actual.Cells) != 2 {
		t.Fatalf("expected 2 cells, got %d", len(actual.Cells))
	}
	if actual.Cells[0].CellOrigin != cloudhub.CellOriginBuiltin {
		t.Errorf("cell[0].CellOrigin = %q, want %q", actual.Cells[0].CellOrigin, cloudhub.CellOriginBuiltin)
	}
	if actual.Cells[1].CellOrigin != cloudhub.CellOriginUser {
		t.Errorf("cell[1].CellOrigin = %q, want %q", actual.Cells[1].CellOrigin, cloudhub.CellOriginUser)
	}
	if actual.Cells[0].ID != "cell-builtin" || actual.Cells[1].ID != "cell-user" {
		t.Errorf("cell IDs not preserved: got %q, %q", actual.Cells[0].ID, actual.Cells[1].ID)
	}
}

func Test_MarshalDashboard_WithEmptyLegacyBounds(t *testing.T) {
	dashboard := cloudhub.Dashboard{
		ID: 1,
		Cells: []cloudhub.DashboardCell{
			{
				ID:   "9b5367de-c552-4322-a9e8-7f384cbd235c",
				X:    0,
				Y:    0,
				W:    4,
				H:    4,
				Name: "Super awesome query",
				Queries: []cloudhub.DashboardQuery{
					{
						Command: "select * from cpu",
						Label:   "CPU Utilization",
						Range: &cloudhub.Range{
							Upper: int64(100),
						},
						Shifts: []cloudhub.TimeShift{},
						Type:   "flux",
					},
				},
				Axes: map[string]cloudhub.Axis{
					"y": {
						LegacyBounds: [2]int64{},
					},
				},
				CellColors: []cloudhub.CellColor{
					{
						ID:    "myid",
						Type:  "min",
						Hex:   "#234567",
						Name:  "Laser",
						Value: "0",
					},
					{
						ID:    "id2",
						Type:  "max",
						Hex:   "#876543",
						Name:  "Solitude",
						Value: "100",
					},
				},
				Type:         "line",
				TableOptions: cloudhub.TableOptions{},
				FieldOptions: []cloudhub.RenamableField{},
				TimeFormat:   "MM:DD:YYYY",
				GraphOptions: cloudhub.GraphOptions{
					FillArea:         true,
					ShowLine:         true,
					ShowPoint:        false,
					ShowTempVarCount: "",
				},
				TableGaugeChartOptions: cloudhub.TableGaugeChartOptions{
					ColumnSettings: []cloudhub.ColumnSetting{},
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
		Templates: []cloudhub.Template{},
		Name:      "Dashboard",
	}

	expected := cloudhub.Dashboard{
		ID: 1,
		Cells: []cloudhub.DashboardCell{
			{
				ID:   "9b5367de-c552-4322-a9e8-7f384cbd235c",
				X:    0,
				Y:    0,
				W:    4,
				H:    4,
				Name: "Super awesome query",
				Queries: []cloudhub.DashboardQuery{
					{
						Command: "select * from cpu",
						Label:   "CPU Utilization",
						Range: &cloudhub.Range{
							Upper: int64(100),
						},
						Shifts: []cloudhub.TimeShift{},
						Type:   "flux",
					},
				},
				Axes: map[string]cloudhub.Axis{
					"y": {
						Base:  "10",
						Scale: "linear",
					},
				},
				CellColors: []cloudhub.CellColor{
					{
						ID:    "myid",
						Type:  "min",
						Hex:   "#234567",
						Name:  "Laser",
						Value: "0",
					},
					{
						ID:    "id2",
						Type:  "max",
						Hex:   "#876543",
						Name:  "Solitude",
						Value: "100",
					},
				},
				TableOptions: cloudhub.TableOptions{},
				FieldOptions: []cloudhub.RenamableField{},
				TimeFormat:   "MM:DD:YYYY",
				Type:         "line",
				GraphOptions: cloudhub.GraphOptions{
					FillArea:         true,
					ShowLine:         true,
					ShowPoint:        false,
					ShowTempVarCount: "",
				},
				TableGaugeChartOptions: cloudhub.TableGaugeChartOptions{
					ColumnSettings: []cloudhub.ColumnSetting{},
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
		Templates: []cloudhub.Template{},
		Name:      "Dashboard",
	}

	var actual cloudhub.Dashboard
	if buf, err := internal.MarshalDashboard(dashboard); err != nil {
		t.Fatal("Error marshaling dashboard: err", err)
	} else if err := internal.UnmarshalDashboard(buf, &actual); err != nil {
		t.Fatal("Error unmarshaling dashboard: err:", err)
	} else {
		dashboardRoundtripNormalizeType(&dashboard, &actual)
		if !gocmp.Equal(expected, actual) {
			t.Fatalf("Dashboard protobuf copy error: diff follows:\n%s", gocmp.Diff(expected, actual))
		}
	}
}

func Test_MarshalDashboard_WithEmptyCellType(t *testing.T) {
	dashboard := cloudhub.Dashboard{
		ID: 1,
		Cells: []cloudhub.DashboardCell{
			{
				ID: "9b5367de-c552-4322-a9e8-7f384cbd235c",
				GraphOptions: cloudhub.GraphOptions{
					FillArea:         true,
					ShowLine:         true,
					ShowPoint:        false,
					ShowTempVarCount: "",
				},
				TableGaugeChartOptions: cloudhub.TableGaugeChartOptions{
					ColumnSettings: []cloudhub.ColumnSetting{},
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
	}

	expected := cloudhub.Dashboard{
		ID: 1,
		Cells: []cloudhub.DashboardCell{
			{
				ID:           "9b5367de-c552-4322-a9e8-7f384cbd235c",
				Type:         "line",
				Queries:      []cloudhub.DashboardQuery{},
				Axes:         map[string]cloudhub.Axis{},
				CellColors:   []cloudhub.CellColor{},
				TableOptions: cloudhub.TableOptions{},
				FieldOptions: []cloudhub.RenamableField{},
				GraphOptions: cloudhub.GraphOptions{
					FillArea:         true,
					ShowLine:         true,
					ShowPoint:        false,
					ShowTempVarCount: "",
				},
				TableGaugeChartOptions: cloudhub.TableGaugeChartOptions{
					ColumnSettings: []cloudhub.ColumnSetting{},
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
		Templates: []cloudhub.Template{},
	}

	var actual cloudhub.Dashboard
	if buf, err := internal.MarshalDashboard(dashboard); err != nil {
		t.Fatal("Error marshaling dashboard: err", err)
	} else if err := internal.UnmarshalDashboard(buf, &actual); err != nil {
		t.Fatal("Error unmarshaling dashboard: err:", err)
	} else {
		dashboardRoundtripNormalizeType(&dashboard, &actual)
		if !gocmp.Equal(expected, actual) {
			t.Fatalf("Dashboard protobuf copy error: diff follows:\n%s", gocmp.Diff(expected, actual))
		}
	}
}

func TestMarshalVsphere(t *testing.T) {
	v := cloudhub.Vsphere{
		ID:           "12",
		Host:         "1.1.1.1",
		UserName:     "testtt",
		Password:     "ummmmmm",
		Protocol:     "http",
		Port:         2542,
		Interval:     10,
		Minion:       "minion01",
		Organization: "8373476",
		DataSource:   "2562",
	}

	var vv cloudhub.Vsphere
	if buf, err := internal.MarshalVsphere(v); err != nil {
		t.Fatal(err)
	} else if err := internal.UnmarshalVsphere(buf, &vv); err != nil {
		t.Fatal(err)
	} else if !reflect.DeepEqual(v, vv) {
		t.Fatalf("source protobuf copy error: got %#v, expected %#v", vv, v)
	}
}

func TestMarshalTopology(t *testing.T) {
	v := cloudhub.Topology{
		ID:           "12",
		Organization: "8373476",
		Diagram:      "<mxGraphModel><root></root></mxGraphModel>",
		Preferences: []string{
			"type:inlet,active:1,min:15,max:30",
			"type:inside,active:0,min:38,max:55",
			"type:outlet,active:0,min:30,max:50",
		},
		TopologyOptions: cloudhub.TopologyOptions{
			MinimapVisible:    true,
			HostStatusVisible: false,
			IPMIVisible:       true,
			LinkVisible:       true,
			AutoSaveOnLeave:   false,
		},
	}

	var vv cloudhub.Topology
	if buf, err := internal.MarshalTopology(&v); err != nil {
		t.Fatal(err)
	} else if err := internal.UnmarshalTopology(buf, &vv); err != nil {
		t.Fatal(err)
	} else if !reflect.DeepEqual(v, vv) {
		t.Fatalf("source protobuf copy error: got %#v, expected %#v", vv, v)
	}
}

func TestMarshalCSP(t *testing.T) {
	v := cloudhub.CSP{
		ID:           "12",
		Provider:     cloudhub.OSP,
		NameSpace:    "osp_pj_demo01",
		AccessKey:    "user01",
		SecretKey:    "password01",
		Organization: "7",
		Minion:       "minion01",
	}

	var vv cloudhub.CSP
	if buf, err := internal.MarshalCSP(&v); err != nil {
		t.Fatal(err)
	} else if err := internal.UnmarshalCSP(buf, &vv); err != nil {
		t.Fatal(err)
	} else if !reflect.DeepEqual(v, vv) {
		t.Fatalf("source protobuf copy error: got %#v, expected %#v", vv, v)
	}
}

func TestMarshalDevice(t *testing.T) {
	v := cloudhub.NetworkDevice{
		ID:                     "123",
		Organization:           "default",
		DeviceIP:               "192.168.1.1",
		Hostname:               "device01",
		DeviceType:             "Router",
		DeviceCategory:         "Network",
		DeviceOS:               "Cisco IOS",
		IsCollectingCfgWritten: false,
		SSHConfig: cloudhub.SSHConfig{
			UserID:     "admin",
			Password:   "admin123",
			EnPassword: "secret123",
			Port:       22,
		},
		SNMPConfig: cloudhub.SNMPConfig{
			Community: "public",
			Version:   "2c",
			Port:      161,
			Protocol:  "udp",
		},
		Sensitivity:            0.2,
		DeviceVendor:           "Cisco",
		LearningState:          "Ready",
		LearningBeginDatetime:  "2024-06-19T08:45:30.123Z",
		LearningFinishDatetime: "2024-06-19T08:45:30.123Z",
		IsLearning:             false,
	}

	var vv cloudhub.NetworkDevice

	if buf, err := internal.MarshalNetworkDevice(&v); err != nil {
		t.Fatal("Marshal failed:", err)
	} else if err := internal.UnmarshalNetworkDevice(buf, &vv); err != nil {
		t.Fatal("Unmarshal failed:", err)
	} else if !reflect.DeepEqual(v, vv) {
		t.Fatalf("Mismatch in original and copied NetworkDevice struct: got %#v, want %#v", vv, v)
	}
}

func TestMarshalNetworkDeviceOrg(t *testing.T) {
	v := cloudhub.NetworkDeviceOrg{
		ID:                  "default",
		LoadModule:          "learn.ch_nx_load",
		MLFunction:          "ml_linear_descent",
		DataDuration:        1,
		LearnedDevicesIDs:   []string{"1", "2", "3"},
		CollectorServer:     "ch-collector-1",
		CollectedDevicesIDs: []string{"1", "2", "3"},
		AIKapacitor: cloudhub.AIKapacitor{
			KapaID:             1,
			SrcID:              2,
			KapaURL:            "http://127.0.0.1:9094",
			Username:           "",
			Password:           "",
			InsecureSkipVerify: false,
		},
		LearningCron: "1 0 1,15 * *",
	}

	var vv cloudhub.NetworkDeviceOrg
	if buf, err := internal.MarshalNetworkDeviceOrg(&v); err != nil {
		t.Fatal("Marshal failed:", err)
	} else if err := internal.UnmarshalNetworkDeviceOrg(buf, &vv); err != nil {
		t.Fatal("Unmarshal failed:", err)
	} else if !reflect.DeepEqual(v, vv) {
		t.Fatalf("Mismatch in original and copied NetworkDeviceGroup struct: got %#v, want %#v", vv, v)
	}
}

func TestMarshalMLNxRst(t *testing.T) {
	v := cloudhub.MLNxRst{
		Device:                 "192.168.1.1",
		LearningFinishDatetime: "2024-07-26T10:00:00Z",
		Epsilon:                0.01,
		MeanMatrix:             "[1.0, 2.0]",
		CovarianceMatrix:       "[[1.0, 0.0], [0.0, 1.0]]",
		K:                      1.5,
		Mean:                   2.0,
		MDThreshold:            3.0,
		MDArray:                []float32{0.5, 1.2, 0.8},
		CPUArray:               []float32{0.2, 0.3, 0.4},
		TrafficArray:           []float32{0.1, 0.2, 0.3},
		GaussianArray:          []float32{0.05, 0.15, 0.25},
	}

	var vv cloudhub.MLNxRst
	if buf, err := internal.MarshalMLNxRst(&v); err != nil {
		t.Fatal("Marshal failed:", err)
	} else if err := internal.UnmarshalMLNxRst(buf, &vv); err != nil {
		t.Fatal("Unmarshal failed:", err)
	} else if !reflect.DeepEqual(v, vv) {
		t.Fatalf("Mismatch in original and copied MLNxRst struct: got %#v, want %#v", vv, v)
	}
}

func TestMarshalDLNxRst(t *testing.T) {
	v := cloudhub.DLNxRst{
		Device:                 "192.168.1.1",
		LearningFinishDatetime: "2024-07-30T12:34:56Z",
		DLThreshold:            0.8,
		TrainLoss:              []float32{0.1, 0.2, 0.15},
		ValidLoss:              []float32{0.12, 0.18, 0.14},
		MSE:                    []float32{0.01, 0.02, 0.015},
	}

	var vv cloudhub.DLNxRst
	if buf, err := internal.MarshalDLNxRst(&v); err != nil {
		t.Fatal("Marshal failed:", err)
	} else if err := internal.UnmarshalDLNxRst(buf, &vv); err != nil {
		t.Fatal("Unmarshal failed:", err)
	} else if !reflect.DeepEqual(v, vv) {
		t.Fatalf("Mismatch in original and copied DLNxRst struct: got %#v, want %#v", vv, v)
	}
}
func TestMarshalDLNxRstStg(t *testing.T) {
	v := cloudhub.DLNxRstStg{
		Device:                 "192.168.1.1",
		LearningFinishDatetime: "2024-07-30T12:34:56Z",
		Scaler:                 []byte{1, 2, 3, 4},
		Model:                  []byte{5, 6, 7, 8},
		DLThreshold:            0.8,
	}

	var vv cloudhub.DLNxRstStg
	if buf, err := internal.MarshalDLNxRstStg(&v); err != nil {
		t.Fatal("Marshal failed:", err)
	} else if err := internal.UnmarshalDLNxRstStg(buf, &vv); err != nil {
		t.Fatal("Unmarshal failed:", err)
	} else if !reflect.DeepEqual(v, vv) {
		t.Fatalf("Mismatch in original and copied DLNxRstStg struct: got %#v, want %#v", vv, v)
	}
}

// TestMarshalMarshalEsSource verifies that an EsSource can be
// marshaled to protobuf and unmarshaled back without loss.
func TestMarshalMarshalEsSource(t *testing.T) {
	cases := []struct {
		name string
		src  cloudhub.EsSource
	}{
		{
			name: "NoAuth",
			src: cloudhub.EsSource{
				ID:                 1,
				Name:               "no-auth",
				Default:            true,
				Role:               "viewer",
				Version:            "7.10.2",
				URL:                "https://es.local:9200",
				InsecureSkipVerify: false,
				IndexPatterns:      []string{"index-*"},
				DefaultIndex:       "index-1",
				Organization:       "org-000",
			},
		},
		{
			name: "BasicAuth",
			src: cloudhub.EsSource{
				ID:                 2,
				Name:               "with-basic",
				Default:            false,
				Role:               "admin",
				Version:            "8.0.0",
				URL:                "https://secure-es:9200",
				InsecureSkipVerify: true,
				IndexPatterns:      []string{"logs-*", "metrics-*"},
				DefaultIndex:       "logs-2025",
				Organization:       "org-123",
				BasicAuth: &cloudhub.BasicAuth{
					Username: "elastic",
					Password: "changeme",
				},
			},
		},
		{
			name: "APIKeyAuth",
			src: cloudhub.EsSource{
				ID:                 3,
				Name:               "with-apikey",
				Default:            false,
				Role:               "reader",
				Version:            "7.9.3",
				URL:                "https://api-es:9200",
				InsecureSkipVerify: false,
				IndexPatterns:      []string{"*"},
				DefaultIndex:       "default",
				Organization:       "org-456",
				APIKeyAuth: &cloudhub.APIKeyAuth{
					ID:     "key-id-xyz",
					APIKey: "secret-key-abc",
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// Marshal to protobuf
			buf, err := internal.MarshalEsSource(tc.src)
			if err != nil {
				t.Fatalf("MarshalEsSource failed: %v", err)
			}
			if len(buf) == 0 {
				t.Fatal("MarshalEsSource returned empty buffer")
			}

			// Unmarshal back into a fresh struct
			var got cloudhub.EsSource
			if err := internal.UnmarshalEsSource(buf, &got); err != nil {
				t.Fatalf("UnmarshalEsSource failed: %v", err)
			}

			// Compare original vs round-tripped
			if !reflect.DeepEqual(tc.src, got) {
				t.Fatalf("Round-trip mismatch for %q:\n got: %+v\nwant: %+v",
					tc.name, got, tc.src)
			}
		})
	}
}

func TestMarshalDeviceMeta(t *testing.T) {
	v := &cloudhub.DeviceMeta{
		IP:         "192.168.1.100",
		Hostname:   "test-host",
		AliasName:  "testhost",
		DeviceType: "switch",
		OrgID:      "org123",
		AppName:    "Cloudhub",
	}

	var vv cloudhub.DeviceMeta
	if buf, err := internal.MarshalDeviceMeta(v); err != nil {
		t.Fatal(err)
	} else if err := internal.UnmarshalDeviceMeta(buf, &vv); err != nil {
		t.Fatal(err)
	} else if !reflect.DeepEqual(*v, vv) {
		t.Fatalf("DeviceMeta protobuf copy error: got %#v, expected %#v", vv, *v)
	}
}

func TestMarshalDeviceToOrg(t *testing.T) {
	v := &cloudhub.DeviceToOrg{
		OrgID:     "org123",
		AliasName: "testhost",
	}

	var vv cloudhub.DeviceToOrg
	if buf, err := internal.MarshalDeviceToOrg(v); err != nil {
		t.Fatal(err)
	} else if err := internal.UnmarshalDeviceToOrg(buf, &vv); err != nil {
		t.Fatal(err)
	} else if !reflect.DeepEqual(*v, vv) {
		t.Fatalf("DeviceToOrg protobuf copy error: got %#v, expected %#v", vv, *v)
	}
}

func TestMarshalAliasToDevice(t *testing.T) {
	v := &cloudhub.AliasToDevice{
		OrgID:    "org123",
		Hostname: "test-host",
	}

	var vv cloudhub.AliasToDevice
	if buf, err := internal.MarshalAliasToDevice(v); err != nil {
		t.Fatal(err)
	} else if err := internal.UnmarshalAliasToDevice(buf, &vv); err != nil {
		t.Fatal(err)
	} else if !reflect.DeepEqual(*v, vv) {
		t.Fatalf("AliasToDevice protobuf copy error: got %#v, expected %#v", vv, *v)
	}
}

func TestMarshalDashboardWithDetailQueries(t *testing.T) {
	d := cloudhub.Dashboard{
		ID:   1,
		Name: "test",
		Cells: []cloudhub.DashboardCell{
			{
				ID:   "cell1",
				Name: "CPU",
				Type: "line",
				Queries: []cloudhub.DashboardQuery{
					{Command: "SELECT mean(\"usage_user\") FROM cpu", Label: "user", Type: "influxql", Shifts: []cloudhub.TimeShift{}, QueryTargetOS: "linux"},
				},
				DetailQueries: []cloudhub.DashboardQuery{
					{Command: "SELECT mean(\"usage_system\") AS \"system\", mean(\"usage_user\") AS \"user\" FROM cpu", Label: "cpu-usage", Type: "influxql", Shifts: []cloudhub.TimeShift{}, QueryTargetOS: "windows"},
					{Command: "SELECT mean(\"usage_idle\") AS \"idle\" FROM cpu", Label: "cpu-idle", Type: "influxql", Shifts: []cloudhub.TimeShift{}, QueryTargetOS: "linux"},
				},
				Axes:         map[string]cloudhub.Axis{},
				CellColors:   []cloudhub.CellColor{},
				FieldOptions: []cloudhub.RenamableField{},
				DecimalPlaces: cloudhub.DecimalPlaces{IsEnforced: true, Digits: 2},
				GraphOptions:  cloudhub.GraphOptions{FillArea: true, ShowLine: true},
				TableGaugeChartOptions: cloudhub.TableGaugeChartOptions{
					ColumnSettings:  []cloudhub.ColumnSetting{},
					SortBy:          "name",
					SortByDirection: "asc",
				},
			},
		},
	}
	d.Templates = []cloudhub.Template{}

	buf, err := internal.MarshalDashboard(d)
	if err != nil {
		t.Fatalf("MarshalDashboard error: %v", err)
	}

	var got cloudhub.Dashboard
	if err := internal.UnmarshalDashboard(buf, &got); err != nil {
		t.Fatalf("UnmarshalDashboard error: %v", err)
	}

	dashboardRoundtripNormalizeType(&d, &got)

	if diff := gocmp.Diff(d, got); diff != "" {
		t.Errorf("DetailQueries roundtrip mismatch (-want +got):\n%s", diff)
	}
}

func TestMarshalDashboard_PreservesQueryTargetOS(t *testing.T) {
	d := cloudhub.Dashboard{
		ID:   99,
		Name: "query-target-os",
		Cells: []cloudhub.DashboardCell{
			{
				ID:   "cell-os",
				Name: "OS Query",
				Type: "line",
				Queries: []cloudhub.DashboardQuery{
					{
						Command:       "SELECT mean(\"usage_user\") FROM cpu",
						Label:         "user",
						Type:          "influxql",
						QueryTargetOS: "linux",
						Shifts:        []cloudhub.TimeShift{},
					},
				},
				DetailQueries: []cloudhub.DashboardQuery{
					{
						Command:       "SELECT mean(\"usage_system\") FROM cpu",
						Label:         "system",
						Type:          "influxql",
						QueryTargetOS: "windows",
						Shifts:        []cloudhub.TimeShift{},
					},
				},
				Axes:                  map[string]cloudhub.Axis{},
				CellColors:            []cloudhub.CellColor{},
				FieldOptions:          []cloudhub.RenamableField{},
				DecimalPlaces:         cloudhub.DecimalPlaces{IsEnforced: true, Digits: 2},
				GraphOptions:          cloudhub.GraphOptions{FillArea: true, ShowLine: true},
				TableGaugeChartOptions: cloudhub.TableGaugeChartOptions{
					ColumnSettings: []cloudhub.ColumnSetting{},
					SortBy:         "name",
					SortByDirection: "asc",
				},
			},
		},
		Templates: []cloudhub.Template{},
	}

	buf, err := internal.MarshalDashboard(d)
	if err != nil {
		t.Fatalf("MarshalDashboard error: %v", err)
	}

	var got cloudhub.Dashboard
	if err := internal.UnmarshalDashboard(buf, &got); err != nil {
		t.Fatalf("UnmarshalDashboard error: %v", err)
	}

	if len(got.Cells) != 1 {
		t.Fatalf("expected 1 cell, got %d", len(got.Cells))
	}
	if len(got.Cells[0].Queries) != 1 {
		t.Fatalf("expected 1 query, got %d", len(got.Cells[0].Queries))
	}
	if got.Cells[0].Queries[0].QueryTargetOS != "linux" {
		t.Fatalf("expected Queries[0].QueryTargetOS=linux, got %q", got.Cells[0].Queries[0].QueryTargetOS)
	}
	if len(got.Cells[0].DetailQueries) != 1 {
		t.Fatalf("expected 1 detail query, got %d", len(got.Cells[0].DetailQueries))
	}
	if got.Cells[0].DetailQueries[0].QueryTargetOS != "windows" {
		t.Fatalf("expected DetailQueries[0].QueryTargetOS=windows, got %q", got.Cells[0].DetailQueries[0].QueryTargetOS)
	}
}

func TestMarshalDashboardIsDefault(t *testing.T) {
	d := cloudhub.Dashboard{
		ID:           42,
		Name:         "my-dashboard",
		IsDefault:    true,
		Organization: "org1",
		Cells:        []cloudhub.DashboardCell{},
		Templates:    []cloudhub.Template{},
	}

	buf, err := internal.MarshalDashboard(d)
	if err != nil {
		t.Fatalf("MarshalDashboard error: %v", err)
	}

	var got cloudhub.Dashboard
	if err := internal.UnmarshalDashboard(buf, &got); err != nil {
		t.Fatalf("UnmarshalDashboard error: %v", err)
	}

	if got.IsDefault != true {
		t.Errorf("expected IsDefault=true, got %v", got.IsDefault)
	}

	// false も roundtrip 確認
	d2 := cloudhub.Dashboard{
		ID:        43,
		Name:      "other",
		IsDefault: false,
		Cells:     []cloudhub.DashboardCell{},
		Templates: []cloudhub.Template{},
	}
	buf2, err := internal.MarshalDashboard(d2)
	if err != nil {
		t.Fatalf("MarshalDashboard error: %v", err)
	}
	var got2 cloudhub.Dashboard
	if err := internal.UnmarshalDashboard(buf2, &got2); err != nil {
		t.Fatalf("UnmarshalDashboard error: %v", err)
	}
	if got2.IsDefault != false {
		t.Errorf("expected IsDefault=false, got %v", got2.IsDefault)
	}
}
