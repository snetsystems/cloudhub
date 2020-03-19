package kapacitor

import (
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

func TestTrigger(t *testing.T) {
	tests := []struct {
		name    string
		rule    cloudhub.AlertRule
		want    string
		wantErr bool
	}{
		{
			name: "Test Deadman",
			rule: cloudhub.AlertRule{
				Trigger: "deadman",
			},
			want: `var trigger = data
    |deadman(threshold, period)
        .stateChangesOnly()
        .message(message)
        .id(idVar)
        .idTag(idTag)
        .levelTag(levelTag)
        .messageField(messageField)
        .durationField(durationField)
`,
			wantErr: false,
		},
		{
			name: "Test Relative",
			rule: cloudhub.AlertRule{
				Trigger: "relative",
				TriggerValues: cloudhub.TriggerValues{
					Operator: "greater than",
					Change:   "% change",
				},
			},
			want: `var past = data
    |shift(shift)

var current = data

var trigger = past
    |join(current)
        .as('past', 'current')
    |eval(lambda: abs(float("current.value" - "past.value")) / float("past.value") * 100.0)
        .keep()
        .as('value')
    |alert()
        .crit(lambda: "value" > crit)
        .stateChangesOnly()
        .message(message)
        .id(idVar)
        .idTag(idTag)
        .levelTag(levelTag)
        .messageField(messageField)
        .durationField(durationField)
`,
			wantErr: false,
		},
		{
			name: "Test Relative percent change",
			rule: cloudhub.AlertRule{
				Trigger: "relative",
				TriggerValues: cloudhub.TriggerValues{
					Operator: "greater than",
					Change:   "change",
				},
			},
			want: `var past = data
    |shift(shift)

var current = data

var trigger = past
    |join(current)
        .as('past', 'current')
    |eval(lambda: float("current.value" - "past.value"))
        .keep()
        .as('value')
    |alert()
        .crit(lambda: "value" > crit)
        .stateChangesOnly()
        .message(message)
        .id(idVar)
        .idTag(idTag)
        .levelTag(levelTag)
        .messageField(messageField)
        .durationField(durationField)
`,
			wantErr: false,
		},
		{
			name: "Test Threshold",
			rule: cloudhub.AlertRule{
				Trigger: "threshold",
				TriggerValues: cloudhub.TriggerValues{
					Operator: "greater than",
				},
			},
			want: `var trigger = data
    |alert()
        .crit(lambda: "value" > crit)
        .stateChangesOnly()
        .message(message)
        .id(idVar)
        .idTag(idTag)
        .levelTag(levelTag)
        .messageField(messageField)
        .durationField(durationField)
`,
			wantErr: false,
		},
		{
			name: "Test Invalid",
			rule: cloudhub.AlertRule{
				Trigger: "invalid",
			},
			want:    ``,
			wantErr: true,
		},
	}
	for _, tt := range tests {
		got, err := Trigger(tt.rule)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. Trigger() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		formatted, err := formatTick(got)
		if err != nil {
			t.Errorf("%q. formatTick() error = %v", tt.name, err)
			continue
		}
		if string(formatted) != tt.want {
			t.Errorf("%q. Trigger() = \n%v\n want \n%v\n", tt.name, string(formatted), tt.want)
		}
	}
}
