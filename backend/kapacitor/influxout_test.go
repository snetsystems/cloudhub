package kapacitor

import "testing"
import cmp "github.com/snetsystems/cmp/backend"

func TestInfluxOut(t *testing.T) {
	tests := []struct {
		name string
		want cmp.TICKScript
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
		got, err := InfluxOut(cmp.AlertRule{
			Name:    "name",
			Trigger: "deadman",
			Query: &cmp.QueryConfig{
				Fields: []cmp.Field{
					{
						Value: "mean",
						Type:  "func",
						Args: []cmp.Field{
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
