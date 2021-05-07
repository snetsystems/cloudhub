package server

import (
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

func TestValidTemplateRequest(t *testing.T) {
	tests := []struct {
		name     string
		template *cloudhub.Template
		wantErr  bool
	}{
		{
			name: "Valid Template",
			template: &cloudhub.Template{
				Type: "fieldKeys",
				TemplateVar: cloudhub.TemplateVar{
					Values: []cloudhub.TemplateValue{
						{
							Type: "fieldKey",
						},
					},
				},
			},
		},
		{
			name:    "Invalid Template Type",
			wantErr: true,
			template: &cloudhub.Template{
				Type: "Unknown Type",
				TemplateVar: cloudhub.TemplateVar{
					Values: []cloudhub.TemplateValue{
						{
							Type: "fieldKey",
						},
					},
				},
			},
		},
		{
			name:    "Invalid Template Variable Type",
			wantErr: true,
			template: &cloudhub.Template{
				Type: "csv",
				TemplateVar: cloudhub.TemplateVar{
					Values: []cloudhub.TemplateValue{
						{
							Type: "unknown value",
						},
					},
				},
			},
		},
		{
			name:    "No query set",
			wantErr: true,
			template: &cloudhub.Template{
				Type: "influxql",
			},
		},
		{
			name:    "No query set",
			wantErr: true,
			template: &cloudhub.Template{
				Type: "flux",
			},
		},
		{
			name: "Valid Map type",
			template: &cloudhub.Template{
				Type: "map",
				TemplateVar: cloudhub.TemplateVar{
					Values: []cloudhub.TemplateValue{
						{
							Key:   "key",
							Value: "value",
							Type:  "map",
						},
					},
				},
			},
		},
		{
			name:    "Map without Key",
			wantErr: true,
			template: &cloudhub.Template{
				Type: "map",
				TemplateVar: cloudhub.TemplateVar{
					Values: []cloudhub.TemplateValue{
						{
							Value: "value",
							Type:  "map",
						},
					},
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := ValidTemplateRequest(tt.template); (err != nil) != tt.wantErr {
				t.Errorf("ValidTemplateRequest() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
