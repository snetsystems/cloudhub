package server

import (
	"testing"

	cmp "github.com/snetsystems/cmp/backend"
)

func TestValidTemplateRequest(t *testing.T) {
	tests := []struct {
		name     string
		template *cmp.Template
		wantErr  bool
	}{
		{
			name: "Valid Template",
			template: &cmp.Template{
				Type: "fieldKeys",
				TemplateVar: cmp.TemplateVar{
					Values: []cmp.TemplateValue{
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
			template: &cmp.Template{
				Type: "Unknown Type",
				TemplateVar: cmp.TemplateVar{
					Values: []cmp.TemplateValue{
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
			template: &cmp.Template{
				Type: "csv",
				TemplateVar: cmp.TemplateVar{
					Values: []cmp.TemplateValue{
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
			template: &cmp.Template{
				Type: "influxql",
			},
		},
		{
			name: "Valid Map type",
			template: &cmp.Template{
				Type: "map",
				TemplateVar: cmp.TemplateVar{
					Values: []cmp.TemplateValue{
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
			template: &cmp.Template{
				Type: "map",
				TemplateVar: cmp.TemplateVar{
					Values: []cmp.TemplateValue{
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
