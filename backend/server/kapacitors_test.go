package server_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/bouk/httprouter"
	gocmp "github.com/google/go-cmp/cmp"
	cmp "github.com/snetsystems/cmp/backend"
	"github.com/snetsystems/cmp/backend/mocks"
	"github.com/snetsystems/cmp/backend/server"
)

const tickScript = `
stream
	|from()
		.measurement('cpu')
	|alert()
		.crit(lambda: "usage_idle" < 10)
		.log('/tmp/alert')
`

func TestValidRuleRequest(t *testing.T) {
	tests := []struct {
		name    string
		rule    cmp.AlertRule
		wantErr bool
	}{
		{
			name: "No every with functions",
			rule: cmp.AlertRule{
				Query: &cmp.QueryConfig{
					Fields: []cmp.Field{
						{
							Value: "max",
							Type:  "func",
							Args: []cmp.Field{
								{
									Value: "oldmanpeabody",
									Type:  "field",
								},
							},
						},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "With every",
			rule: cmp.AlertRule{
				Every: "10s",
				Query: &cmp.QueryConfig{
					Fields: []cmp.Field{
						{
							Value: "max",
							Type:  "func",
							Args: []cmp.Field{
								{
									Value: "oldmanpeabody",
									Type:  "field",
								},
							},
						},
					},
				},
			},
		},
		{
			name:    "No query config",
			rule:    cmp.AlertRule{},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := server.ValidRuleRequest(tt.rule); (err != nil) != tt.wantErr {
				t.Errorf("ValidRuleRequest() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func Test_KapacitorRulesGet(t *testing.T) {
	kapaTests := []struct {
		name        string
		requestPath string
		mockAlerts  []cmp.AlertRule
		expected    []cmp.AlertRule
	}{
		{
			name:        "basic",
			requestPath: "/cmp/v1/sources/1/kapacitors/1/rules",
			mockAlerts: []cmp.AlertRule{
				{
					ID:         "cpu_alert",
					Name:       "cpu_alert",
					Status:     "enabled",
					Type:       "stream",
					DBRPs:      []cmp.DBRP{{DB: "telegraf", RP: "autogen"}},
					TICKScript: tickScript,
				},
			},
			expected: []cmp.AlertRule{
				{
					ID:         "cpu_alert",
					Name:       "cpu_alert",
					Status:     "enabled",
					Type:       "stream",
					DBRPs:      []cmp.DBRP{{DB: "telegraf", RP: "autogen"}},
					TICKScript: tickScript,
					AlertNodes: cmp.AlertNodes{
						Posts:      []*cmp.Post{},
						TCPs:       []*cmp.TCP{},
						Email:      []*cmp.Email{},
						Exec:       []*cmp.Exec{},
						Log:        []*cmp.Log{},
						VictorOps:  []*cmp.VictorOps{},
						PagerDuty:  []*cmp.PagerDuty{},
						PagerDuty2: []*cmp.PagerDuty{},
						Pushover:   []*cmp.Pushover{},
						Sensu:      []*cmp.Sensu{},
						Slack:      []*cmp.Slack{},
						Telegram:   []*cmp.Telegram{},
						HipChat:    []*cmp.HipChat{},
						Alerta:     []*cmp.Alerta{},
						OpsGenie:   []*cmp.OpsGenie{},
						OpsGenie2:  []*cmp.OpsGenie{},
						Talk:       []*cmp.Talk{},
						Kafka:      []*cmp.Kafka{},
					},
				},
			},
		},
	}

	for _, test := range kapaTests {
		test := test // needed to avoid data race
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			// setup mock kapa API
			kapaSrv := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
				params := r.URL.Query()
				limit, err := strconv.Atoi(params.Get("limit"))
				if err != nil {
					rw.WriteHeader(http.StatusBadRequest)
					return
				}
				offset, err := strconv.Atoi(params.Get("offset"))
				if err != nil {
					rw.WriteHeader(http.StatusBadRequest)
					return
				}

				tsks := []map[string]interface{}{}
				for _, task := range test.mockAlerts {
					tsks = append(tsks, map[string]interface{}{
						"id":     task.ID,
						"script": tickScript,
						"status": "enabled",
						"type":   "stream",
						"dbrps": []cmp.DBRP{
							{
								DB: "telegraf",
								RP: "autogen",
							},
						},
						"link": map[string]interface{}{
							"rel":  "self",
							"href": "/kapacitor/v1/tasks/cpu_alert",
						},
					})
				}

				var tasks map[string]interface{}

				if offset >= len(tsks) {
					tasks = map[string]interface{}{
						"tasks": []map[string]interface{}{},
					}
				} else if limit+offset > len(tsks) {
					tasks = map[string]interface{}{
						"tasks": tsks[offset:],
					}
				}
				//} else {
				//tasks = map[string]interface{}{
				//"tasks": tsks[offset : offset+limit],
				//}
				//}

				err = json.NewEncoder(rw).Encode(&tasks)
				if err != nil {
					t.Error("Failed to encode JSON. err:", err)
				}
			}))
			defer kapaSrv.Close()

			// setup mock service and test logger
			testLogger := mocks.TestLogger{}
			svc := &server.Service{
				Store: &mocks.Store{
					SourcesStore: &mocks.SourcesStore{
						GetF: func(ctx context.Context, ID int) (cmp.Source, error) {
							return cmp.Source{
								ID:                 ID,
								InsecureSkipVerify: true,
							}, nil
						},
					},
					ServersStore: &mocks.ServersStore{
						GetF: func(ctx context.Context, ID int) (cmp.Server, error) {
							return cmp.Server{
								SrcID: ID,
								URL:   kapaSrv.URL,
							}, nil
						},
					},
				},
				Logger: &testLogger,
			}

			// setup request and response recorder
			req := httptest.NewRequest("GET", test.requestPath, strings.NewReader(""))
			rr := httptest.NewRecorder()

			// setup context and request params
			bg := context.Background()
			params := httprouter.Params{
				{
					Key:   "id",
					Value: "1",
				},
				{
					Key:   "kid",
					Value: "1",
				},
			}
			ctx := httprouter.WithParams(bg, params)
			req = req.WithContext(ctx)

			// invoke KapacitorRulesGet endpoint
			svc.KapacitorRulesGet(rr, req)

			// destructure response
			frame := struct {
				Rules []struct {
					cmp.AlertRule
					Links json.RawMessage `json:"links"`
				} `json:"rules"`
			}{}

			resp := rr.Result()

			err := json.NewDecoder(resp.Body).Decode(&frame)
			if err != nil {
				t.Fatal("Err decoding kapa rule response: err:", err)
			}

			actual := make([]cmp.AlertRule, len(frame.Rules))

			for i := range frame.Rules {
				actual[i] = frame.Rules[i].AlertRule
			}

			if resp.StatusCode != http.StatusOK {
				t.Fatal("Expected HTTP 200 OK but got", resp.Status)
			}

			if !gocmp.Equal(test.expected, actual) {
				t.Fatalf("%q - Alert rules differ! diff:\n%s\n", test.name, gocmp.Diff(test.expected, actual))
			}
		})
	}
}
