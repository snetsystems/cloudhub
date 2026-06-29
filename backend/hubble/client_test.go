package hubble

import (
	"testing"
	"time"
)

func TestBackoff_Exponential_CappedAt30s(t *testing.T) {
	got := []time.Duration{
		backoffFor(0),
		backoffFor(1),
		backoffFor(2),
		backoffFor(5),
		backoffFor(10),
	}
	want := []time.Duration{1 * time.Second, 2 * time.Second, 4 * time.Second, 30 * time.Second, 30 * time.Second}
	for i := range got {
		if got[i] != want[i] {
			t.Errorf("backoffFor(%d) = %v, want %v", i, got[i], want[i])
		}
	}
}

func TestClientConfig_Validate(t *testing.T) {
	cases := []struct {
		name string
		cfg  ClientConfig
		ok   bool
	}{
		{"empty URL", ClientConfig{}, false},
		{"only URL", ClientConfig{RelayURL: "x:1"}, true},
		{"missing key", ClientConfig{RelayURL: "x:1", TLSCert: "c"}, false},
		{"full mTLS", ClientConfig{RelayURL: "x:1", TLSCA: "ca", TLSCert: "c", TLSKey: "k"}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.cfg.Validate()
			if (err == nil) != tc.ok {
				t.Errorf("Validate() err=%v, want ok=%v", err, tc.ok)
			}
		})
	}
}
