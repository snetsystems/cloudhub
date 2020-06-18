package kv_test

import (
	"context"
	"testing"

	gocmp "github.com/google/go-cmp/cmp"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

func TestOrganizationConfig_FindOrCreate(t *testing.T) {
	type args struct {
		organizationID string
	}
	type wants struct {
		organizationConfig *cloudhub.OrganizationConfig
		err                error
	}
	tests := []struct {
		name     string
		args     args
		addFirst bool
		wants    wants
	}{
		{
			name: "Get non-existent default config from default org",
			args: args{
				organizationID: "default",
			},
			addFirst: false,
			wants: wants{
				organizationConfig: &cloudhub.OrganizationConfig{
					OrganizationID: "default",
					LogViewer: cloudhub.LogViewerConfig{
						Columns: []cloudhub.LogViewerColumn{
							{
								Name:     "time",
								Position: 0,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "hidden",
									},
								},
							},
							{
								Name:     "severity",
								Position: 1,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "label",
										Value: "icon",
									},
									{
										Type:  "label",
										Value: "text",
									},
									{
										Type:  "color",
										Name:  "emerg",
										Value: "ruby",
									},
									{
										Type:  "color",
										Name:  "alert",
										Value: "fire",
									},
									{
										Type:  "color",
										Name:  "crit",
										Value: "curacao",
									},
									{
										Type:  "color",
										Name:  "err",
										Value: "tiger",
									},
									{
										Type:  "color",
										Name:  "warning",
										Value: "pineapple",
									},
									{
										Type:  "color",
										Name:  "notice",
										Value: "rainforest",
									},
									{
										Type:  "color",
										Name:  "info",
										Value: "star",
									},
									{
										Type:  "color",
										Name:  "debug",
										Value: "wolf",
									},
								},
							},
							{
								Name:     "timestamp",
								Position: 2,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "message",
								Position: 3,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "facility",
								Position: 4,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "procid",
								Position: 5,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "displayName",
										Value: "Proc ID",
									},
								},
							},
							{
								Name:     "appname",
								Position: 6,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "displayName",
										Value: "Application",
									},
								},
							},
							{
								Name:     "hostname",
								Position: 7,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "host",
								Position: 8,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "Get non-existent default config from non-default org",
			args: args{
				organizationID: "1",
			},
			addFirst: false,
			wants: wants{
				organizationConfig: &cloudhub.OrganizationConfig{
					OrganizationID: "1",
					LogViewer: cloudhub.LogViewerConfig{
						Columns: []cloudhub.LogViewerColumn{
							{
								Name:     "time",
								Position: 0,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "hidden",
									},
								},
							},
							{
								Name:     "severity",
								Position: 1,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "label",
										Value: "icon",
									},
									{
										Type:  "label",
										Value: "text",
									},
									{
										Type:  "color",
										Name:  "emerg",
										Value: "ruby",
									},
									{
										Type:  "color",
										Name:  "alert",
										Value: "fire",
									},
									{
										Type:  "color",
										Name:  "crit",
										Value: "curacao",
									},
									{
										Type:  "color",
										Name:  "err",
										Value: "tiger",
									},
									{
										Type:  "color",
										Name:  "warning",
										Value: "pineapple",
									},
									{
										Type:  "color",
										Name:  "notice",
										Value: "rainforest",
									},
									{
										Type:  "color",
										Name:  "info",
										Value: "star",
									},
									{
										Type:  "color",
										Name:  "debug",
										Value: "wolf",
									},
								},
							},
							{
								Name:     "timestamp",
								Position: 2,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "message",
								Position: 3,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "facility",
								Position: 4,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "procid",
								Position: 5,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "displayName",
										Value: "Proc ID",
									},
								},
							},
							{
								Name:     "appname",
								Position: 6,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "displayName",
										Value: "Application",
									},
								},
							},
							{
								Name:     "hostname",
								Position: 7,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "host",
								Position: 8,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "Get existing/modified config from default org",
			args: args{
				organizationID: "default",
			},
			addFirst: true,
			wants: wants{
				organizationConfig: &cloudhub.OrganizationConfig{
					OrganizationID: "default",
					LogViewer: cloudhub.LogViewerConfig{
						Columns: []cloudhub.LogViewerColumn{
							{
								Name:     "time",
								Position: 1,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "hidden",
									},
								},
							},
							{
								Name:     "severity",
								Position: 0,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "hidden",
									},
									{
										Type:  "label",
										Value: "icon",
									},
									{
										Type:  "label",
										Value: "text",
									},
									{
										Type:  "color",
										Name:  "emerg",
										Value: "ruby",
									},
									{
										Type:  "color",
										Name:  "alert",
										Value: "fire",
									},
									{
										Type:  "color",
										Name:  "crit",
										Value: "curacao",
									},
									{
										Type:  "color",
										Name:  "err",
										Value: "tiger",
									},
									{
										Type:  "color",
										Name:  "warning",
										Value: "pineapple",
									},
									{
										Type:  "color",
										Name:  "notice",
										Value: "rainforest",
									},
									{
										Type:  "color",
										Name:  "info",
										Value: "star",
									},
									{
										Type:  "color",
										Name:  "debug",
										Value: "wolf",
									},
								},
							},
							{
								Name:     "timestamp",
								Position: 2,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "message",
								Position: 3,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "facility",
								Position: 4,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "procid",
								Position: 5,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "displayName",
										Value: "Proc ID",
									},
								},
							},
							{
								Name:     "appname",
								Position: 6,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "displayName",
										Value: "Application",
									},
								},
							},
							{
								Name:     "host",
								Position: 7,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "hostname",
								Position: 8,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "Get existing/modified config from non-default org",
			args: args{
				organizationID: "1",
			},
			addFirst: true,
			wants: wants{
				organizationConfig: &cloudhub.OrganizationConfig{
					OrganizationID: "1",
					LogViewer: cloudhub.LogViewerConfig{
						Columns: []cloudhub.LogViewerColumn{
							{
								Name:     "time",
								Position: 1,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "hidden",
									},
								},
							},
							{
								Name:     "severity",
								Position: 0,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "hidden",
									},
									{
										Type:  "label",
										Value: "icon",
									},
									{
										Type:  "label",
										Value: "text",
									},
									{
										Type:  "color",
										Name:  "emerg",
										Value: "ruby",
									},
									{
										Type:  "color",
										Name:  "alert",
										Value: "fire",
									},
									{
										Type:  "color",
										Name:  "crit",
										Value: "curacao",
									},
									{
										Type:  "color",
										Name:  "err",
										Value: "tiger",
									},
									{
										Type:  "color",
										Name:  "warning",
										Value: "pineapple",
									},
									{
										Type:  "color",
										Name:  "notice",
										Value: "rainforest",
									},
									{
										Type:  "color",
										Name:  "info",
										Value: "star",
									},
									{
										Type:  "color",
										Name:  "debug",
										Value: "wolf",
									},
								},
							},
							{
								Name:     "timestamp",
								Position: 2,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "message",
								Position: 3,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "facility",
								Position: 4,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "procid",
								Position: 5,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "displayName",
										Value: "Proc ID",
									},
								},
							},
							{
								Name:     "appname",
								Position: 6,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "displayName",
										Value: "Application",
									},
								},
							},
							{
								Name:     "host",
								Position: 7,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "hostname",
								Position: 8,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
						},
					},
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewTestClient()
			if err != nil {
				t.Fatal(err)
			}
			defer client.Close()

			s := client.OrganizationConfigStore()

			if tt.addFirst {
				if err := s.Put(context.Background(), tt.wants.organizationConfig); err != nil {
					t.Fatal(err)
				}
			}

			got, err := s.FindOrCreate(context.Background(), tt.args.organizationID)
			if (tt.wants.err != nil) != (err != nil) {
				t.Errorf("%q. OrganizationConfigStore.FindOrCreate() error = %v, wantErr %v", tt.name, err, tt.wants.err)
				return
			}
			if diff := gocmp.Diff(got, tt.wants.organizationConfig); diff != "" {
				t.Errorf("%q. OrganizationConfigStore.FindOrCreate():\n-got/+want\ndiff %s", tt.name, diff)
			}
		})
	}
}

func TestOrganizationConfig_Put(t *testing.T) {
	type args struct {
		organizationConfig *cloudhub.OrganizationConfig
		organizationID     string
	}
	type wants struct {
		organizationConfig *cloudhub.OrganizationConfig
		err                error
	}
	tests := []struct {
		name  string
		args  args
		wants wants
	}{
		{
			name: "Set default org config",
			args: args{
				organizationConfig: &cloudhub.OrganizationConfig{
					OrganizationID: "default",
					LogViewer: cloudhub.LogViewerConfig{
						Columns: []cloudhub.LogViewerColumn{
							{
								Name:     "time",
								Position: 1,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "severity",
								Position: 0,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "label",
										Value: "text",
									},
								},
							},
							{
								Name:     "timestamp",
								Position: 2,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "message",
								Position: 3,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "facility",
								Position: 4,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "procid",
								Position: 5,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "displayName",
										Value: "Milkshake",
									},
								},
							},
							{
								Name:     "appname",
								Position: 6,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "displayName",
										Value: "Application",
									},
								},
							},
							{
								Name:     "host",
								Position: 7,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
						},
					},
				},
				organizationID: "default",
			},
			wants: wants{
				organizationConfig: &cloudhub.OrganizationConfig{
					LogViewer: cloudhub.LogViewerConfig{
						Columns: []cloudhub.LogViewerColumn{
							{
								Name:     "time",
								Position: 1,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "severity",
								Position: 0,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "label",
										Value: "text",
									},
								},
							},
							{
								Name:     "timestamp",
								Position: 2,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "message",
								Position: 3,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "facility",
								Position: 4,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "procid",
								Position: 5,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "displayName",
										Value: "Milkshake",
									},
								},
							},
							{
								Name:     "appname",
								Position: 6,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "displayName",
										Value: "Application",
									},
								},
							},
							{
								Name:     "host",
								Position: 7,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "hostname",
								Position: 8,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
						},
					},
					OrganizationID: "default",
				},
			},
		},
		{
			name: "Set non-default org config",
			args: args{
				organizationConfig: &cloudhub.OrganizationConfig{
					OrganizationID: "1337",
					LogViewer: cloudhub.LogViewerConfig{
						Columns: []cloudhub.LogViewerColumn{
							{
								Name:     "time",
								Position: 1,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "severity",
								Position: 0,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "label",
										Value: "text",
									},
								},
							},
							{
								Name:     "timestamp",
								Position: 2,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "message",
								Position: 3,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "facility",
								Position: 4,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "procid",
								Position: 5,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "displayName",
										Value: "Milkshake",
									},
								},
							},
							{
								Name:     "appname",
								Position: 6,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "displayName",
										Value: "Application",
									},
								},
							},
							{
								Name:     "hostname",
								Position: 7,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "host",
								Position: 8,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
						},
					},
				},
				organizationID: "1337",
			},
			wants: wants{
				organizationConfig: &cloudhub.OrganizationConfig{
					LogViewer: cloudhub.LogViewerConfig{
						Columns: []cloudhub.LogViewerColumn{
							{
								Name:     "time",
								Position: 1,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "severity",
								Position: 0,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "label",
										Value: "text",
									},
								},
							},
							{
								Name:     "timestamp",
								Position: 2,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "message",
								Position: 3,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "facility",
								Position: 4,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "procid",
								Position: 5,
								Encodings: []cloudhub.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "displayName",
										Value: "Milkshake",
									},
								},
							},
							{
								Name:     "appname",
								Position: 6,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
									{
										Type:  "displayName",
										Value: "Application",
									},
								},
							},
							{
								Name:     "hostname",
								Position: 7,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "host",
								Position: 8,
								Encodings: []cloudhub.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
						},
					},
					OrganizationID: "1337",
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewTestClient()
			if err != nil {
				t.Fatal(err)
			}
			defer client.Close()

			s := client.OrganizationConfigStore()
			err = s.Put(context.Background(), tt.args.organizationConfig)
			if (tt.wants.err != nil) != (err != nil) {
				t.Errorf("%q. OrganizationConfigStore.Put() error = %v, wantErr %v", tt.name, err, tt.wants.err)
				return
			}

			got, _ := s.FindOrCreate(context.Background(), tt.args.organizationID)
			if (tt.wants.err != nil) != (err != nil) {
				t.Errorf("%q. OrganizationConfigStore.Put() error = %v, wantErr %v", tt.name, err, tt.wants.err)
				return
			}

			if diff := gocmp.Diff(got, tt.wants.organizationConfig); diff != "" {
				t.Errorf("%q. OrganizationConfigStore.Put():\n-got/+want\ndiff %s", tt.name, diff)
			}
		})
	}
}
