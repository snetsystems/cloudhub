package bolt_test

import (
	"context"
	"testing"

	gocmp "github.com/google/go-cmp/cmp"
	cmp "github.com/snetsystems/cmp/backend"
)

func TestConfig_Get(t *testing.T) {
	type wants struct {
		config *cmp.Config
		err    error
	}
	tests := []struct {
		name  string
		wants wants
	}{
		{
			name: "Get config",
			wants: wants{
				config: &cmp.Config{
					Auth: cmp.AuthConfig{
						SuperAdminNewUsers: false,
					},
				},
			},
		},
	}
	for _, tt := range tests {
		client, err := NewTestClient()
		if err != nil {
			t.Fatal(err)
		}
		defer client.Close()

		s := client.ConfigStore
		got, err := s.Get(context.Background())
		if (tt.wants.err != nil) != (err != nil) {
			t.Errorf("%q. ConfigStore.Get() error = %v, wantErr %v", tt.name, err, tt.wants.err)
			continue
		}
		if diff := gocmp.Diff(got, tt.wants.config); diff != "" {
			t.Errorf("%q. ConfigStore.Get():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}

func TestConfig_Update(t *testing.T) {
	type args struct {
		config *cmp.Config
	}
	type wants struct {
		config *cmp.Config
		err    error
	}
	tests := []struct {
		name  string
		args  args
		wants wants
	}{
		{
			name: "Set config",
			args: args{
				config: &cmp.Config{
					Auth: cmp.AuthConfig{
						SuperAdminNewUsers: false,
					},
				},
			},
			wants: wants{
				config: &cmp.Config{
					Auth: cmp.AuthConfig{
						SuperAdminNewUsers: false,
					},
				},
			},
		},
	}
	for _, tt := range tests {
		client, err := NewTestClient()
		if err != nil {
			t.Fatal(err)
		}
		defer client.Close()

		s := client.ConfigStore
		err = s.Update(context.Background(), tt.args.config)
		if (tt.wants.err != nil) != (err != nil) {
			t.Errorf("%q. ConfigStore.Get() error = %v, wantErr %v", tt.name, err, tt.wants.err)
			continue
		}

		got, _ := s.Get(context.Background())
		if (tt.wants.err != nil) != (err != nil) {
			t.Errorf("%q. ConfigStore.Get() error = %v, wantErr %v", tt.name, err, tt.wants.err)
			continue
		}

		if diff := gocmp.Diff(got, tt.wants.config); diff != "" {
			t.Errorf("%q. ConfigStore.Get():\n-got/+want\ndiff %s", tt.name, diff)
		}
	}
}
