package kapacitor

import "testing"
import cloudhub "github.com/snetsystems/cloudhub/backend"

func TestInfluxOut(t *testing.T) {
	tests := []struct {
		name string
		want cloudhub.TICKScript
	}{
		{
			name: "Test influxDBOut kapacitor node",
			want: `trigger
    |eval(lambda: "emitted")
        .as('value')
        .keep('value', messageField, durationField)
    |eval(lambda: float("value"))
        .as('value')
        .keep()
    |influxDBOut()
        .create()
        .database(outputDB)
        .retentionPolicy(outputRP)
        .measurement(outputMeasurement)
        .tag('alertName', name)
        .tag('triggerType', triggerType)
`,
		},
	}
	for _, tt := range tests {
		got, err := InfluxOut(cloudhub.AlertRule{
			Name:    "name",
			Trigger: "deadman",
			Query: &cloudhub.QueryConfig{
				Fields: []cloudhub.Field{
					{
						Value: "mean",
						Type:  "func",
						Args: []cloudhub.Field{
							{
								Value: "usage_user",
								Type:  "field",
							},
						},
					},
				},
			},
		})
		if err != nil {
			t.Errorf("%q. InfluxOut()) error = %v", tt.name, err)
			continue
		}
		formatted, err := formatTick(got)
		if err != nil {
			t.Errorf("%q. formatTick() error = %v", tt.name, err)
			continue
		}
		if formatted != tt.want {
			t.Errorf("%q. InfluxOut() = %v, want %v", tt.name, formatted, tt.want)
		}
	}
}
