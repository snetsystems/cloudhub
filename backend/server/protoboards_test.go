package server

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
)

func Test_Protoboards(t *testing.T) {
	type wants struct {
		statusCode  int
		contentType string
		body        string
	}

	tests := []struct {
		name      string
		wants     wants
		arg       []cloudhub.Protoboard
		shouldErr bool
	}{
		{
			name: "Empty protoboards",
			wants: wants{
				statusCode:  http.StatusOK,
				contentType: "application/json",
				body:        `{"protoboards":[]}`,
			},
			arg:       []cloudhub.Protoboard{},
			shouldErr: false,
		},
		{
			name: "Several protoboards",
			wants: wants{
				statusCode:  http.StatusOK,
				contentType: "application/json",
				body:        `{"protoboards":[{"id":"1","meta":{"name":"protodashboard 1","icon":"http://example.com/icon.png","version":"1.2.3","measurements":["m1","m2"],"dashboardVersion":"1.7.0","description":"this is great","author":"Chronogiraffe","license":"Apache-2.0","url":"http://example.com"},"data":{"cells":[{"x":0,"y":0,"w":0,"h":0,"name":"","queries":null,"axes":null,"type":"","colors":null,"legend":{},"tableOptions":{"verticalTimeAxis":false,"sortBy":{"internalName":"","displayName":"","visible":false},"wrapping":"","fixFirstColumn":false},"fieldOptions":null,"timeFormat":"","decimalPlaces":{"isEnforced":false,"digits":0},"note":"","noteVisibility":""}],"templates":[{"tempVar":"","values":null,"id":"","type":"","label":""}]},"links":{"self":"/cloudhub/v1/protoboards/1"}},{"id":"2","meta":{"name":"protodashboard 2","icon":"http://example.com/icon.png","version":"1.2.3","measurements":["m1","m2"],"dashboardVersion":"1.7.0","description":"this is great","author":"Chronogiraffe","license":"Apache-2.0","url":"http://example.com"},"data":{"cells":[{"x":8,"y":0,"w":3,"h":5,"name":"Untitled Cell","queries":[{"query":"SELECT mean(\"usage_steal\") AS \"mean_usage_steal\", mean(\"usage_system\") AS \"mean_usage_system\" FROM \"telegraf\".\"autogen\".\"cpu\" WHERE time \u003e :dashboardTime: AND \"host\"='denizs-MacBook-Pro.local' GROUP BY time(:interval:) FILL(null)","queryConfig":{"database":"telegraf","measurement":"cpu","retentionPolicy":"autogen","fields":[{"value":"mean","type":"func","alias":"mean_usage_steal","args":[{"value":"usage_steal","type":"field","alias":""}]},{"value":"mean","type":"func","alias":"mean_usage_system","args":[{"value":"usage_steal","type":"field","alias":""}]}],"tags":{"host":["denizs-MacBook-Pro.local"]},"groupBy":{"time":"auto","tags":[]},"areTagsAccepted":true,"fill":"null","rawText":null,"range":null,"shifts":null},"source":"","type":"influxql"}],"axes":{"x":{"bounds":["",""],"label":"","prefix":"","suffix":"","base":"10","scale":"linear"},"y":{"bounds":["",""],"label":"","prefix":"","suffix":"","base":"10","scale":"linear"},"y2":{"bounds":["",""],"label":"","prefix":"","suffix":"","base":"10","scale":"linear"}},"type":"line","colors":[],"legend":{},"tableOptions":{"verticalTimeAxis":false,"sortBy":{"internalName":"","displayName":"","visible":false},"wrapping":"","fixFirstColumn":false},"fieldOptions":[],"timeFormat":"","decimalPlaces":{"isEnforced":true,"digits":2},"note":"","noteVisibility":""}],"templates":null},"links":{"self":"/cloudhub/v1/protoboards/2"}}]}`},
			arg: []cloudhub.Protoboard{
				cloudhub.Protoboard{
					ID: "1",
					Meta: cloudhub.ProtoboardMeta{
						Name:             "protodashboard 1",
						Measurements:     []string{"m1", "m2"},
						Icon:             "http://example.com/icon.png",
						Version:          "1.2.3",
						DashboardVersion: "1.7.0",
						Description:      "this is great",
						Author:           "Chronogiraffe",
						License:          "Apache-2.0",
						URL:              "http://example.com",
					},
					Data: cloudhub.ProtoboardData{Cells: []cloudhub.ProtoboardCell{cloudhub.ProtoboardCell{}}, Templates: []cloudhub.Template{cloudhub.Template{}}}},
				cloudhub.Protoboard{
					ID:   "2",
					Meta: cloudhub.ProtoboardMeta{Name: "protodashboard 2", Measurements: []string{"m1", "m2"}, Icon: "http://example.com/icon.png", Version: "1.2.3", DashboardVersion: "1.7.0", Description: "this is great", Author: "Chronogiraffe", License: "Apache-2.0", URL: "http://example.com"},
					Data: cloudhub.ProtoboardData{Cells: []cloudhub.ProtoboardCell{cloudhub.ProtoboardCell{
						X:    8,
						Y:    0,
						W:    3,
						H:    5,
						Name: "Untitled Cell",
						Axes: map[string]cloudhub.Axis{
							"x": cloudhub.Axis{
								Bounds: []string{"", ""},
								Label:  "",
								Prefix: "",
								Suffix: "",
								Base:   "10",
								Scale:  "linear",
							},
							"y": cloudhub.Axis{
								Bounds: []string{"", ""},
								Label:  "",
								Prefix: "",
								Suffix: "",
								Base:   "10",
								Scale:  "linear",
							},
							"y2": cloudhub.Axis{
								Bounds: []string{"", ""},
								Label:  "",
								Prefix: "",
								Suffix: "",
								Base:   "10",
								Scale:  "linear",
							},
						},
						Type:       "line",
						CellColors: []cloudhub.CellColor{},
						Legend: cloudhub.Legend{
							Type:        "",
							Orientation: "",
						},
						TableOptions: cloudhub.TableOptions{
							VerticalTimeAxis: false,
							SortBy: cloudhub.RenamableField{
								InternalName: "",
								DisplayName:  "",
								Visible:      false,
							},
							Wrapping:       "",
							FixFirstColumn: false,
						},
						FieldOptions: []cloudhub.RenamableField{},
						TimeFormat:   "",
						DecimalPlaces: cloudhub.DecimalPlaces{
							IsEnforced: true,
							Digits:     2,
						},
						Note:           "",
						NoteVisibility: "",
						Queries: []cloudhub.DashboardQuery{
							cloudhub.DashboardQuery{
								Command: "SELECT mean(\"usage_steal\") AS \"mean_usage_steal\", mean(\"usage_system\") AS \"mean_usage_system\" FROM \"telegraf\".\"autogen\".\"cpu\" WHERE time > :dashboardTime: AND \"host\"='denizs-MacBook-Pro.local' GROUP BY time(:interval:) FILL(null)",
								Label:   "",
								QueryConfig: cloudhub.QueryConfig{
									ID:              "",
									Database:        "telegraf",
									Measurement:     "cpu",
									RetentionPolicy: "autogen",
									Fields: []cloudhub.Field{
										cloudhub.Field{
											Value: "mean",
											Type:  "func",
											Alias: "mean_usage_steal",
											Args: []cloudhub.Field{
												cloudhub.Field{
													Value: "usage_steal",
													Type:  "field",
													Alias: "",
												},
											},
										},
										cloudhub.Field{
											Value: "mean",
											Type:  "func",
											Alias: "mean_usage_system",
											Args: []cloudhub.Field{
												cloudhub.Field{
													Value: "usage_steal",
													Type:  "field",
													Alias: "",
												},
											},
										},
									},
									Tags: map[string][]string{
										"host": []string{
											"denizs-MacBook-Pro.local",
										},
									},
									GroupBy: cloudhub.GroupBy{
										Time: "auto",
										Tags: []string{},
									},
									AreTagsAccepted: true,
									Fill:            "null",
								},
								Type: "influxql",
							},
						},
					}}},
				}},
			shouldErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			// setup mock cloudhub.Service and mock logger
			lg := &mocks.TestLogger{}
			svc := Service{
				Store: &mocks.Store{ProtoboardsStore: &mocks.ProtoboardsStore{
					AllF: func(ctx context.Context) ([]cloudhub.Protoboard, error) {
						return tt.arg, nil
					},
				},
				},
				Logger: lg,
			}

			// setup mock request and response
			rr := httptest.NewRecorder()
			reqURL := url.URL{
				Path: "/cloudhub/v1/protoboards",
			}

			req := httptest.NewRequest("GET", reqURL.RequestURI(), strings.NewReader(""))

			svc.Protoboards(rr, req)

			resp := rr.Result()
			contentType := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)
			statusCode := resp.StatusCode

			if statusCode != tt.wants.statusCode {
				t.Errorf("%q. Protoboards() = %v, want %v", tt.name, statusCode, tt.wants.statusCode)
			}
			if contentType != tt.wants.contentType {
				t.Errorf("%q. Protoboards() = %v, want %v", tt.name, contentType, tt.wants.contentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wants.body); !eq {
				t.Errorf("%q. Protoboards() = %v, want %v", tt.name, string(body), tt.wants.body)
			}

		})
	}
}

func Test_ProtoboardsID(t *testing.T) {
	type wants struct {
		statusCode  int
		contentType string
		body        string
	}
	type args struct {
		id string
	}

	tests := []struct {
		name      string
		wants     wants
		args      args
		shouldErr bool
	}{
		{
			name: "Get protoboard with id",
			wants: wants{
				statusCode:  http.StatusOK,
				contentType: "application/json",
				body:        `{"id":"1","meta":{"name":"","version":"","dashboardVersion":""},"data":{"cells":null},"links":{"self":"/cloudhub/v1/protoboards/1"}}`,
			},
			args: args{
				id: "1",
			},
			shouldErr: false,
		},
		{
			name: "Not found",
			wants: wants{
				statusCode:  http.StatusNotFound,
				contentType: "application/json",
				body:        `{"code":404,"message":"ID 5 not found"}`,
			},
			args: args{
				id: "5",
			},
			shouldErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			// setup mock cloudhub.Service and mock logger
			lg := &mocks.TestLogger{}
			svc := Service{
				Store: &mocks.Store{ProtoboardsStore: &mocks.ProtoboardsStore{
					GetF: func(ctx context.Context, id string) (cloudhub.Protoboard, error) {
						switch id {
						case "1":
							return cloudhub.Protoboard{
								ID:   "1",
								Meta: cloudhub.ProtoboardMeta{},
								Data: cloudhub.ProtoboardData{},
							}, nil
						case "2":
							return cloudhub.Protoboard{
								ID:   "2",
								Meta: cloudhub.ProtoboardMeta{},
								Data: cloudhub.ProtoboardData{},
							}, nil
						}
						return cloudhub.Protoboard{}, cloudhub.ErrProtoboardNotFound
					},
				},
				},
				Logger: lg,
			}

			// setup mock request and response
			rr := httptest.NewRecorder()
			reqURL := url.URL{
				Path: fmt.Sprintf("/cloudhub/v1/protoboards/%s", tt.args.id),
			}

			req := httptest.NewRequest("GET", reqURL.RequestURI(), strings.NewReader(""))
			req = req.WithContext(httprouter.WithParams(
				context.Background(),
				httprouter.Params{
					{
						Key:   "id",
						Value: tt.args.id,
					},
				}))

			svc.ProtoboardsID(rr, req)

			resp := rr.Result()
			statusCode := resp.StatusCode
			contentType := resp.Header.Get("Content-Type")
			body, _ := ioutil.ReadAll(resp.Body)

			if statusCode != tt.wants.statusCode {
				t.Errorf("%q. Protoboards() = %v, want %v", tt.name, statusCode, tt.wants.statusCode)
			}
			if contentType != tt.wants.contentType {
				t.Errorf("%q. Protoboards() = %v, want %v", tt.name, contentType, tt.wants.contentType)
			}
			if eq, _ := jsonEqual(string(body), tt.wants.body); !eq {
				t.Errorf("%q. Protoboards() = %v, want %v", tt.name, string(body), tt.wants.body)
			}

		})
	}
}
