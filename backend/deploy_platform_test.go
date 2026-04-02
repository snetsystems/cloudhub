package cloudhub

import "testing"

func TestNormalizeDeployPlatform(t *testing.T) {
	t.Parallel()
	tests := []struct {
		in      string
		want    string
		wantErr bool
	}{
		{in: "", want: DeployPlatformHost},
		{in: DeployPlatformHost, want: DeployPlatformHost},
		{in: "  HOST  ", want: DeployPlatformHost},
		{in: DeployPlatformK8s, want: DeployPlatformK8s},
		{in: "K8S", want: DeployPlatformK8s},
		{in: DeployPlatformInputKubernetes, want: DeployPlatformK8s},
		{in: "baremetal", wantErr: true},
		{in: "BareMetal", wantErr: true},
		{in: "production", wantErr: true},
	}
	for _, tt := range tests {
		tt := tt
		t.Run(tt.in, func(t *testing.T) {
			t.Parallel()
			got, err := NormalizeDeployPlatform(tt.in)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected err: %v", err)
			}
			if got != tt.want {
				t.Fatalf("got %q, want %q", got, tt.want)
			}
		})
	}
}
