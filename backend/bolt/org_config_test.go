package bolt_test

import (
	"context"
	"testing"

	gocmp "github.com/google/go-cmp/cmp"
	cmp "github.com/snetsystems/cmp/backend"
)

func TestOrganizationConfig_FindOrCreate(t *testing.T) {
	type args struct {
		organizationID string
	}
	type wants struct {
		organizationConfig *cmp.OrganizationConfig
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
				organizationConfig: &cmp.OrganizationConfig{
					OrganizationID: "default",
					LogViewer: cmp.LogViewerConfig{
						Columns: []cmp.LogViewerColumn{
							{
								Name:     "time",
								Position: 0,
								Encodings: []cmp.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "hidden",
									},
								},
							},
							{
								Name:     "severity",
								Position: 1,
								Encodings: []cmp.ColumnEncoding{

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
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "message",
								Position: 3,
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "facility",
								Position: 4,
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "procid",
								Position: 5,
								Encodings: []cmp.ColumnEncoding{

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
								Encodings: []cmp.ColumnEncoding{
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
								Encodings: []cmp.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "host",
								Position: 8,
								Encodings: []cmp.ColumnEncoding{
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
				organizationConfig: &cmp.OrganizationConfig{
					OrganizationID: "1",
					LogViewer: cmp.LogViewerConfig{
						Columns: []cmp.LogViewerColumn{
							{
								Name:     "time",
								Position: 0,
								Encodings: []cmp.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "hidden",
									},
								},
							},
							{
								Name:     "severity",
								Position: 1,
								Encodings: []cmp.ColumnEncoding{

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
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "message",
								Position: 3,
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "facility",
								Position: 4,
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "procid",
								Position: 5,
								Encodings: []cmp.ColumnEncoding{

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
								Encodings: []cmp.ColumnEncoding{
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
								Encodings: []cmp.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "host",
								Position: 8,
								Encodings: []cmp.ColumnEncoding{
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
				organizationConfig: &cmp.OrganizationConfig{
					OrganizationID: "default",
					LogViewer: cmp.LogViewerConfig{
						Columns: []cmp.LogViewerColumn{
							{
								Name:     "time",
								Position: 1,
								Encodings: []cmp.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "hidden",
									},
								},
							},
							{
								Name:     "severity",
								Position: 0,
								Encodings: []cmp.ColumnEncoding{

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
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "message",
								Position: 3,
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "facility",
								Position: 4,
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "procid",
								Position: 5,
								Encodings: []cmp.ColumnEncoding{

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
								Encodings: []cmp.ColumnEncoding{
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
								Encodings: []cmp.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "hostname",
								Position: 8,
								Encodings: []cmp.ColumnEncoding{
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
				organizationConfig: &cmp.OrganizationConfig{
					OrganizationID: "1",
					LogViewer: cmp.LogViewerConfig{
						Columns: []cmp.LogViewerColumn{
							{
								Name:     "time",
								Position: 1,
								Encodings: []cmp.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "hidden",
									},
								},
							},
							{
								Name:     "severity",
								Position: 0,
								Encodings: []cmp.ColumnEncoding{

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
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "message",
								Position: 3,
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "facility",
								Position: 4,
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "procid",
								Position: 5,
								Encodings: []cmp.ColumnEncoding{

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
								Encodings: []cmp.ColumnEncoding{
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
								Encodings: []cmp.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "hostname",
								Position: 8,
								Encodings: []cmp.ColumnEncoding{
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

			s := client.OrganizationConfigStore

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

			d, err := s.Get(context.Background(), tt.args.organizationID)
			if err != nil {
				t.Errorf("%q. OrganizationConfigStore.Get(): Failed to retrieve organization config", tt.name)
			}
			if diff := gocmp.Diff(got, d); diff != "" {
				t.Errorf("%q. OrganizationConfigStore.Get():\n-got/+want\ndiff %s", tt.name, diff)
			}
		})
	}
}

func TestOrganizationConfig_Put(t *testing.T) {
	type args struct {
		organizationConfig *cmp.OrganizationConfig
		organizationID     string
	}
	type wants struct {
		organizationConfig *cmp.OrganizationConfig
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
				organizationConfig: &cmp.OrganizationConfig{
					OrganizationID: "default",
					LogViewer: cmp.LogViewerConfig{
						Columns: []cmp.LogViewerColumn{
							{
								Name:     "time",
								Position: 1,
								Encodings: []cmp.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "severity",
								Position: 0,
								Encodings: []cmp.ColumnEncoding{

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
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "message",
								Position: 3,
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "facility",
								Position: 4,
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "procid",
								Position: 5,
								Encodings: []cmp.ColumnEncoding{

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
								Encodings: []cmp.ColumnEncoding{
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
								Encodings: []cmp.ColumnEncoding{
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
				organizationConfig: &cmp.OrganizationConfig{
					LogViewer: cmp.LogViewerConfig{
						Columns: []cmp.LogViewerColumn{
							{
								Name:     "time",
								Position: 1,
								Encodings: []cmp.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "severity",
								Position: 0,
								Encodings: []cmp.ColumnEncoding{

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
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "message",
								Position: 3,
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "facility",
								Position: 4,
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "procid",
								Position: 5,
								Encodings: []cmp.ColumnEncoding{

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
								Encodings: []cmp.ColumnEncoding{
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
								Encodings: []cmp.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "hostname",
								Position: 8,
								Encodings: []cmp.ColumnEncoding{
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
				organizationConfig: &cmp.OrganizationConfig{
					OrganizationID: "1337",
					LogViewer: cmp.LogViewerConfig{
						Columns: []cmp.LogViewerColumn{
							{
								Name:     "time",
								Position: 1,
								Encodings: []cmp.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "severity",
								Position: 0,
								Encodings: []cmp.ColumnEncoding{

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
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "message",
								Position: 3,
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "facility",
								Position: 4,
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "procid",
								Position: 5,
								Encodings: []cmp.ColumnEncoding{

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
								Encodings: []cmp.ColumnEncoding{
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
								Encodings: []cmp.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "host",
								Position: 8,
								Encodings: []cmp.ColumnEncoding{
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
				organizationConfig: &cmp.OrganizationConfig{
					LogViewer: cmp.LogViewerConfig{
						Columns: []cmp.LogViewerColumn{
							{
								Name:     "time",
								Position: 1,
								Encodings: []cmp.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "severity",
								Position: 0,
								Encodings: []cmp.ColumnEncoding{

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
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "message",
								Position: 3,
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "facility",
								Position: 4,
								Encodings: []cmp.ColumnEncoding{

									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "procid",
								Position: 5,
								Encodings: []cmp.ColumnEncoding{

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
								Encodings: []cmp.ColumnEncoding{
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
								Encodings: []cmp.ColumnEncoding{
									{
										Type:  "visibility",
										Value: "visible",
									},
								},
							},
							{
								Name:     "host",
								Position: 8,
								Encodings: []cmp.ColumnEncoding{
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

			s := client.OrganizationConfigStore
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
