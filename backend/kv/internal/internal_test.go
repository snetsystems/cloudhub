package internal_test

import (
	"reflect"
	"testing"

	gocmp "github.com/google/go-cmp/cmp"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv/internal"
)

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
				TableOptions: cloudhub.TableOptions{},
				FieldOptions: []cloudhub.RenamableField{},
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
						Source: "/cloudhub/v1/sources/1",
						Shifts: []cloudhub.TimeShift{},
						Type:   "influxql",
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
	} else if !gocmp.Equal(dashboard, actual) {
		t.Fatalf("Dashboard protobuf copy error: diff follows:\n%s", gocmp.Diff(dashboard, actual))
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
	} else if !gocmp.Equal(expected, actual) {
		t.Fatalf("Dashboard protobuf copy error: diff follows:\n%s", gocmp.Diff(expected, actual))
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
	} else if !gocmp.Equal(expected, actual) {
		t.Fatalf("Dashboard protobuf copy error: diff follows:\n%s", gocmp.Diff(expected, actual))
	}
}

func Test_MarshalDashboard_WithEmptyCellType(t *testing.T) {
	dashboard := cloudhub.Dashboard{
		ID: 1,
		Cells: []cloudhub.DashboardCell{
			{
				ID: "9b5367de-c552-4322-a9e8-7f384cbd235c",
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
			},
		},
		Templates: []cloudhub.Template{},
	}

	var actual cloudhub.Dashboard
	if buf, err := internal.MarshalDashboard(dashboard); err != nil {
		t.Fatal("Error marshaling dashboard: err", err)
	} else if err := internal.UnmarshalDashboard(buf, &actual); err != nil {
		t.Fatal("Error unmarshaling dashboard: err:", err)
	} else if !gocmp.Equal(expected, actual) {
		t.Fatalf("Dashboard protobuf copy error: diff follows:\n%s", gocmp.Diff(expected, actual))
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
