package server

import (
	"reflect"
	"testing"
	"time"
)

func TestNewCustomLinks(t *testing.T) {
	tests := []struct {
		name    string
		args    map[string]string
		want    []CustomLink
		wantErr bool
	}{
		{
			name: "Unknown error in NewCustomLinks",
			args: map[string]string{
				"cubeapple": "https://cube.apple",
			},
			want: []CustomLink{
				{
					Name: "cubeapple",
					URL:  "https://cube.apple",
				},
			},
		},
		{
			name: "CustomLink missing Name",
			args: map[string]string{
				"": "https://cube.apple",
			},
			wantErr: true,
		},
		{
			name: "CustomLink missing URL",
			args: map[string]string{
				"cubeapple": "",
			},
			wantErr: true,
		},
		{
			name: "Missing protocol scheme",
			args: map[string]string{
				"cubeapple": ":k%8a#",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		got, err := NewCustomLinks(tt.args)
		if (err != nil) != tt.wantErr {
			t.Errorf("%q. NewCustomLinks() error = %v, wantErr %v", tt.name, err, tt.wantErr)
			continue
		}
		if !reflect.DeepEqual(got, tt.want) {
			t.Errorf("%q. NewCustomLinks() = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestNewHubbleConfig_ExcludedNSDefaults(t *testing.T) {
	// No patterns given → sensible defaults so "Hide system NS" works
	// out of the box.
	cfg, err := NewHubbleConfig(
		5*time.Minute, 10*time.Second, 2*time.Second, 300, nil, "",
	)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"kube-system", "kube-public", "kube-node-lease"}
	if !reflect.DeepEqual(cfg.ExcludedNamespaceGlobs, want) {
		t.Errorf("default ExcludedNamespaceGlobs = %v, want %v", cfg.ExcludedNamespaceGlobs, want)
	}

	// Explicit patterns override the defaults untouched.
	custom := []string{"longhorn-*"}
	cfg, err = NewHubbleConfig(
		5*time.Minute, 10*time.Second, 2*time.Second, 300, custom, "",
	)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(cfg.ExcludedNamespaceGlobs, custom) {
		t.Errorf("custom ExcludedNamespaceGlobs = %v, want %v", cfg.ExcludedNamespaceGlobs, custom)
	}
}
