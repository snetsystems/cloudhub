package kapacitor

import (
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

func TestAlertServices(t *testing.T) {
	tests := []struct {
		name    string
		rule    cloudhub.AlertRule
		want    cloudhub.TICKScript
		wantErr bool
	}{
		{
			name: "Test several valid services",
			rule: cloudhub.AlertRule{
				AlertNodes: cloudhub.AlertNodes{
					Slack:     []*cloudhub.Slack{{}},
					VictorOps: []*cloudhub.VictorOps{{}},
					Email:     []*cloudhub.Email{{}},
				},
			},
			want: `alert()
        .email()
        .victorOps()
        .slack()
`,
		},
		{
			name: "Test single valid service",
			rule: cloudhub.AlertRule{
				AlertNodes: cloudhub.AlertNodes{
					Slack: []*cloudhub.Slack{{}},
				},
			},
			want: `alert()
        .slack()
`,
		},
		{
			name: "Test pushoverservice",
			rule: cloudhub.AlertRule{
				AlertNodes: cloudhub.AlertNodes{
					Pushover: []*cloudhub.Pushover{
						{
							Device:   "asdf",
							Title:    "asdf",
							Sound:    "asdf",
							URL:      "http://moo.org",
							URLTitle: "influxdata",
						},
					},
				},
			},
			want: `alert()
        .pushover()
        .device('asdf')
        .title('asdf')
        .uRL('http://moo.org')
        .uRLTitle('influxdata')
        .sound('asdf')
`,
		},
		{
			name: "Test single valid service and property",
			rule: cloudhub.AlertRule{
				AlertNodes: cloudhub.AlertNodes{
					Slack: []*cloudhub.Slack{
						{
							Channel: "#general",
						},
					},
				},
			},
			want: `alert()
        .slack()
        .channel('#general')
`,
		},
		{
			name: "Test tcp",
			rule: cloudhub.AlertRule{
				AlertNodes: cloudhub.AlertNodes{
					TCPs: []*cloudhub.TCP{
						{
							Address: "myaddress:22",
						},
					},
				},
			},
			want: `alert()
        .tcp('myaddress:22')
`,
		},
		{
			name: "Test log",
			rule: cloudhub.AlertRule{
				AlertNodes: cloudhub.AlertNodes{
					Log: []*cloudhub.Log{
						{
							FilePath: "/tmp/alerts.log",
						},
					},
				},
			},
			want: `alert()
        .log('/tmp/alerts.log')
`,
		},
		{
			name: "Test http as post",
			rule: cloudhub.AlertRule{
				AlertNodes: cloudhub.AlertNodes{
					Posts: []*cloudhub.Post{
						{
							URL: "http://myaddress",
						},
					},
				},
			},
			want: `alert()
        .post('http://myaddress')
`,
		},
		{
			name: "Test post with headers",
			rule: cloudhub.AlertRule{
				AlertNodes: cloudhub.AlertNodes{
					Posts: []*cloudhub.Post{
						{
							URL:     "http://myaddress",
							Headers: map[string]string{"key": "value"},
						},
					},
				},
			},
			want: `alert()
        .post('http://myaddress')
        .header('key', 'value')
`,
		},
	}
	for _, tt := range tests {
		got, err := AlertServices(tt.rule)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. AlertServices() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		if tt.wantErr {
			continue
		}
		formatted, err := formatTick("alert()" + got)
		if err != nil {
			t.Errorf("%q. formatTick() error = %v", tt.name, err)
			continue
		}
		if formatted != tt.want {
			t.Errorf("%q. AlertServices() = %v, want %v", tt.name, formatted, tt.want)
		}
	}
}

func Test_addAlertNodes(t *testing.T) {
	tests := []struct {
		name     string
		handlers cloudhub.AlertNodes
		want     string
		wantErr  bool
	}{
		{
			name: "test email alerts",
			handlers: cloudhub.AlertNodes{
				IsStateChangesOnly: true,
				Email: []*cloudhub.Email{
					{
						To: []string{
							"me@me.com", "you@you.com",
						},
					},
				},
			},
			want: `
        .stateChangesOnly()
        .email()
        .to('me@me.com')
        .to('you@you.com')
`,
		},
		{
			name: "test pushover alerts",
			handlers: cloudhub.AlertNodes{
				IsStateChangesOnly: true,
				Pushover: []*cloudhub.Pushover{
					{
						Device:   "asdf",
						Title:    "asdf",
						Sound:    "asdf",
						URL:      "http://moo.org",
						URLTitle: "influxdata",
					},
				},
			},
			want: `
        .stateChangesOnly()
        .pushover()
        .device('asdf')
        .title('asdf')
        .uRL('http://moo.org')
        .uRLTitle('influxdata')
        .sound('asdf')
`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := addAlertNodes(tt.handlers)
			if (err != nil) != tt.wantErr {
				t.Errorf("addAlertNodes() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("addAlertNodes() =\n%v\n, want\n%v", got, tt.want)
			}
		})
	}
}
