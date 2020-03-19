package server_test

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	gocmp "github.com/google/go-cmp/cmp"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/server"
)

func Test_Layouts(t *testing.T) {
	layoutTests := []struct {
		name       string
		expected   cloudhub.Layout
		allLayouts []cloudhub.Layout
		focusedApp string // should filter all layouts to this app only
		shouldErr  bool
	}{
		{
			"empty layout",
			cloudhub.Layout{},
			[]cloudhub.Layout{},
			"",
			false,
		},
		{
			"several layouts",
			cloudhub.Layout{
				ID:          "d20a21c8-69f1-4780-90fe-e69f5e4d138c",
				Application: "influxdb",
				Measurement: "influxdb",
			},
			[]cloudhub.Layout{
				cloudhub.Layout{
					ID:          "d20a21c8-69f1-4780-90fe-e69f5e4d138c",
					Application: "influxdb",
					Measurement: "influxdb",
				},
			},
			"",
			false,
		},
		{
			"filtered app",
			cloudhub.Layout{
				ID:          "d20a21c8-69f1-4780-90fe-e69f5e4d138c",
				Application: "influxdb",
				Measurement: "influxdb",
			},
			[]cloudhub.Layout{
				cloudhub.Layout{
					ID:          "d20a21c8-69f1-4780-90fe-e69f5e4d138c",
					Application: "influxdb",
					Measurement: "influxdb",
				},
				cloudhub.Layout{
					ID:          "b020101b-ea6b-4c8c-9f0e-db0ba501f4ef",
					Application: "cloudhub",
					Measurement: "cloudhub",
				},
			},
			"influxdb",
			false,
		},
		{
			"axis zero values",
			cloudhub.Layout{
				ID:          "d20a21c8-69f1-4780-90fe-e69f5e4d138c",
				Application: "influxdb",
				Measurement: "influxdb",
				Cells: []cloudhub.Cell{
					{
						X:          0,
						Y:          0,
						W:          4,
						H:          4,
						I:          "3b0e646b-2ca3-4df2-95a5-fd80915459dd",
						Name:       "A Graph",
						CellColors: []cloudhub.CellColor{},
						Axes: map[string]cloudhub.Axis{
							"x": cloudhub.Axis{
								Bounds: []string{},
							},
							"y": cloudhub.Axis{
								Bounds: []string{},
							},
							"y2": cloudhub.Axis{
								Bounds: []string{},
							},
						},
					},
				},
			},
			[]cloudhub.Layout{
				cloudhub.Layout{
					ID:          "d20a21c8-69f1-4780-90fe-e69f5e4d138c",
					Application: "influxdb",
					Measurement: "influxdb",
					Cells: []cloudhub.Cell{
						{
							X:          0,
							Y:          0,
							W:          4,
							H:          4,
							I:          "3b0e646b-2ca3-4df2-95a5-fd80915459dd",
							CellColors: []cloudhub.CellColor{},
							Name:       "A Graph",
						},
					},
				},
			},
			"",
			false,
		},
	}

	for _, test := range layoutTests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			// setup mock cloudhub.Service and mock logger
			lg := &mocks.TestLogger{}
			svc := server.Service{
				Store: &mocks.Store{LayoutsStore: &mocks.LayoutsStore{
					AllF: func(ctx context.Context) ([]cloudhub.Layout, error) {
						if len(test.allLayouts) == 0 {
							return []cloudhub.Layout{
								test.expected,
							}, nil
						} else {
							return test.allLayouts, nil
						}
					},
				},
				},
				Logger: lg,
			}

			// setup mock request and response
			rr := httptest.NewRecorder()
			reqURL := url.URL{
				Path: "/cloudhub/v1/layouts",
			}
			params := reqURL.Query()

			// add query params required by test
			if test.focusedApp != "" {
				params.Add("app", test.focusedApp)
			}

			// re-inject query params
			reqURL.RawQuery = params.Encode()

			req := httptest.NewRequest("GET", reqURL.RequestURI(), strings.NewReader(""))

			// invoke handler for layouts endpoint
			svc.Layouts(rr, req)

			// create a throwaway frame to unwrap Layouts
			respFrame := struct {
				Layouts []struct {
					cloudhub.Layout
					Link interface{} `json:"-"`
				} `json:"layouts"`
			}{}

			// decode resp into respFrame
			resp := rr.Result()
			if err := json.NewDecoder(resp.Body).Decode(&respFrame); err != nil {
				t.Fatalf("%q - Error unmarshaling JSON: err: %s", test.name, err.Error())
			}

			// compare actual and expected
			if !gocmp.Equal(test.expected, respFrame.Layouts[0].Layout) {
				t.Fatalf("%q - Expected layouts to be equal: diff:\n\t%s", test.name, gocmp.Diff(test.expected, respFrame.Layouts[0].Layout))
			}
		})
	}
}
