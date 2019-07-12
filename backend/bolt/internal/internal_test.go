package internal_test

import (
	"reflect"
	"testing"

	gocmp "github.com/google/go-cmp/cmp"
	cmp "github.com/snetsystems/cmp/backend"
	"github.com/snetsystems/cmp/backend/bolt/internal"
)

func TestMarshalSource(t *testing.T) {
	v := cmp.Source{
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

	var vv cmp.Source
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
	v := cmp.Source{
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

	var vv cmp.Source
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
	v := cmp.Server{
		ID:                 12,
		SrcID:              2,
		Name:               "Fountain of Truth",
		Username:           "docbrown",
		Password:           "1 point twenty-one g1g@w@tts",
		URL:                "http://oldmanpeabody.mall.io:9092",
		InsecureSkipVerify: true,
	}

	var vv cmp.Server
	if buf, err := internal.MarshalServer(v); err != nil {
		t.Fatal(err)
	} else if err := internal.UnmarshalServer(buf, &vv); err != nil {
		t.Fatal(err)
	} else if !reflect.DeepEqual(v, vv) {
		t.Fatalf("source protobuf copy error: got %#v, expected %#v", vv, v)
	}
}

func TestMarshalLayout(t *testing.T) {
	layout := cmp.Layout{
		ID:          "id",
		Measurement: "measurement",
		Application: "app",
		Cells: []cmp.Cell{
			{
				X:    1,
				Y:    1,
				W:    4,
				H:    4,
				I:    "anotherid",
				Type: "line",
				Name: "cell1",
				Axes: map[string]cmp.Axis{
					"y": cmp.Axis{
						Bounds: []string{"0", "100"},
						Label:  "foo",
					},
				},
				Queries: []cmp.Query{
					{
						Range: &cmp.Range{
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
			},
		},
	}

	var vv cmp.Layout
	if buf, err := internal.MarshalLayout(layout); err != nil {
		t.Fatal(err)
	} else if err := internal.UnmarshalLayout(buf, &vv); err != nil {
		t.Fatal(err)
	} else if !gocmp.Equal(layout, vv) {
		t.Fatal("source protobuf copy error: diff:\n", gocmp.Diff(layout, vv))
	}
}

func Test_MarshalDashboard(t *testing.T) {
	dashboard := cmp.Dashboard{
		ID: 1,
		Cells: []cmp.DashboardCell{
			{
				ID:   "9b5367de-c552-4322-a9e8-7f384cbd235c",
				X:    0,
				Y:    0,
				W:    4,
				H:    4,
				Name: "Super awesome query",
				Queries: []cmp.DashboardQuery{
					{
						Command: "select * from cpu",
						Label:   "CPU Utilization",
						Range: &cmp.Range{
							Upper: int64(100),
						},
						Source: "/cmp/v1/sources/1",
						Shifts: []cmp.TimeShift{},
						Type:   "influxql",
					},
				},
				Axes: map[string]cmp.Axis{
					"y": cmp.Axis{
						Bounds: []string{"0", "3", "1-7", "foo"},
						Label:  "foo",
						Prefix: "M",
						Suffix: "m",
						Base:   "2",
						Scale:  "roflscale",
					},
				},
				Type: "line",
				CellColors: []cmp.CellColor{
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
				TableOptions: cmp.TableOptions{},
				FieldOptions: []cmp.RenamableField{},
				TimeFormat:   "",
			},
		},
		Templates: []cmp.Template{},
		Name:      "Dashboard",
	}

	var actual cmp.Dashboard
	if buf, err := internal.MarshalDashboard(dashboard); err != nil {
		t.Fatal("Error marshaling dashboard: err", err)
	} else if err := internal.UnmarshalDashboard(buf, &actual); err != nil {
		t.Fatal("Error unmarshaling dashboard: err:", err)
	} else if !gocmp.Equal(dashboard, actual) {
		t.Fatalf("Dashboard protobuf copy error: diff follows:\n%s", gocmp.Diff(dashboard, actual))
	}
}

func Test_MarshalDashboard_WithLegacyBounds(t *testing.T) {
	dashboard := cmp.Dashboard{
		ID: 1,
		Cells: []cmp.DashboardCell{
			{
				ID:   "9b5367de-c552-4322-a9e8-7f384cbd235c",
				X:    0,
				Y:    0,
				W:    4,
				H:    4,
				Name: "Super awesome query",
				Queries: []cmp.DashboardQuery{
					{
						Command: "select * from cpu",
						Label:   "CPU Utilization",
						Range: &cmp.Range{
							Upper: int64(100),
						},
						Shifts: []cmp.TimeShift{},
						Type:   "influxql",
					},
				},
				Axes: map[string]cmp.Axis{
					"y": cmp.Axis{
						LegacyBounds: [2]int64{0, 5},
					},
				},
				CellColors: []cmp.CellColor{
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
				Legend: cmp.Legend{
					Type:        "static",
					Orientation: "bottom",
				},
				TableOptions: cmp.TableOptions{},
				TimeFormat:   "MM:DD:YYYY",
				FieldOptions: []cmp.RenamableField{},
				Type:         "line",
			},
		},
		Templates: []cmp.Template{},
		Name:      "Dashboard",
	}

	expected := cmp.Dashboard{
		ID: 1,
		Cells: []cmp.DashboardCell{
			{
				ID:   "9b5367de-c552-4322-a9e8-7f384cbd235c",
				X:    0,
				Y:    0,
				W:    4,
				H:    4,
				Name: "Super awesome query",
				Queries: []cmp.DashboardQuery{
					{
						Command: "select * from cpu",
						Label:   "CPU Utilization",
						Range: &cmp.Range{
							Upper: int64(100),
						},
						Shifts: []cmp.TimeShift{},
						Type:   "influxql",
					},
				},
				Axes: map[string]cmp.Axis{
					"y": cmp.Axis{
						Base:  "10",
						Scale: "linear",
					},
				},
				CellColors: []cmp.CellColor{
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
				Legend: cmp.Legend{
					Type:        "static",
					Orientation: "bottom",
				},
				TableOptions: cmp.TableOptions{},
				FieldOptions: []cmp.RenamableField{},
				TimeFormat:   "MM:DD:YYYY",
				Type:         "line",
			},
		},
		Templates: []cmp.Template{},
		Name:      "Dashboard",
	}

	var actual cmp.Dashboard
	if buf, err := internal.MarshalDashboard(dashboard); err != nil {
		t.Fatal("Error marshaling dashboard: err", err)
	} else if err := internal.UnmarshalDashboard(buf, &actual); err != nil {
		t.Fatal("Error unmarshaling dashboard: err:", err)
	} else if !gocmp.Equal(expected, actual) {
		t.Fatalf("Dashboard protobuf copy error: diff follows:\n%s", gocmp.Diff(expected, actual))
	}
}

func Test_MarshalDashboard_WithEmptyLegacyBounds(t *testing.T) {
	dashboard := cmp.Dashboard{
		ID: 1,
		Cells: []cmp.DashboardCell{
			{
				ID:   "9b5367de-c552-4322-a9e8-7f384cbd235c",
				X:    0,
				Y:    0,
				W:    4,
				H:    4,
				Name: "Super awesome query",
				Queries: []cmp.DashboardQuery{
					{
						Command: "select * from cpu",
						Label:   "CPU Utilization",
						Range: &cmp.Range{
							Upper: int64(100),
						},
						Shifts: []cmp.TimeShift{},
						Type:   "flux",
					},
				},
				Axes: map[string]cmp.Axis{
					"y": cmp.Axis{
						LegacyBounds: [2]int64{},
					},
				},
				CellColors: []cmp.CellColor{
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
				TableOptions: cmp.TableOptions{},
				FieldOptions: []cmp.RenamableField{},
				TimeFormat:   "MM:DD:YYYY",
			},
		},
		Templates: []cmp.Template{},
		Name:      "Dashboard",
	}

	expected := cmp.Dashboard{
		ID: 1,
		Cells: []cmp.DashboardCell{
			{
				ID:   "9b5367de-c552-4322-a9e8-7f384cbd235c",
				X:    0,
				Y:    0,
				W:    4,
				H:    4,
				Name: "Super awesome query",
				Queries: []cmp.DashboardQuery{
					{
						Command: "select * from cpu",
						Label:   "CPU Utilization",
						Range: &cmp.Range{
							Upper: int64(100),
						},
						Shifts: []cmp.TimeShift{},
						Type:   "flux",
					},
				},
				Axes: map[string]cmp.Axis{
					"y": cmp.Axis{
						Base:  "10",
						Scale: "linear",
					},
				},
				CellColors: []cmp.CellColor{
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
				TableOptions: cmp.TableOptions{},
				FieldOptions: []cmp.RenamableField{},
				TimeFormat:   "MM:DD:YYYY",
				Type:         "line",
			},
		},
		Templates: []cmp.Template{},
		Name:      "Dashboard",
	}

	var actual cmp.Dashboard
	if buf, err := internal.MarshalDashboard(dashboard); err != nil {
		t.Fatal("Error marshaling dashboard: err", err)
	} else if err := internal.UnmarshalDashboard(buf, &actual); err != nil {
		t.Fatal("Error unmarshaling dashboard: err:", err)
	} else if !gocmp.Equal(expected, actual) {
		t.Fatalf("Dashboard protobuf copy error: diff follows:\n%s", gocmp.Diff(expected, actual))
	}
}

func Test_MarshalDashboard_WithEmptyCellType(t *testing.T) {
	dashboard := cmp.Dashboard{
		ID: 1,
		Cells: []cmp.DashboardCell{
			{
				ID: "9b5367de-c552-4322-a9e8-7f384cbd235c",
			},
		},
	}

	expected := cmp.Dashboard{
		ID: 1,
		Cells: []cmp.DashboardCell{
			{
				ID:           "9b5367de-c552-4322-a9e8-7f384cbd235c",
				Type:         "line",
				Queries:      []cmp.DashboardQuery{},
				Axes:         map[string]cmp.Axis{},
				CellColors:   []cmp.CellColor{},
				TableOptions: cmp.TableOptions{},
				FieldOptions: []cmp.RenamableField{},
			},
		},
		Templates: []cmp.Template{},
	}

	var actual cmp.Dashboard
	if buf, err := internal.MarshalDashboard(dashboard); err != nil {
		t.Fatal("Error marshaling dashboard: err", err)
	} else if err := internal.UnmarshalDashboard(buf, &actual); err != nil {
		t.Fatal("Error unmarshaling dashboard: err:", err)
	} else if !gocmp.Equal(expected, actual) {
		t.Fatalf("Dashboard protobuf copy error: diff follows:\n%s", gocmp.Diff(expected, actual))
	}
}
