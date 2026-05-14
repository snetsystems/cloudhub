package pgsql

import "testing"

func TestNormalizeAlertKapacitorURL(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "trim trailing slash",
			in:   "http://kapacitor.example:9092/",
			want: "http://kapacitor.example:9092",
		},
		{
			name: "keep url without trailing slash",
			in:   "http://kapacitor.example:9092",
			want: "http://kapacitor.example:9092",
		},
		{
			name: "preserve root slash for bare host",
			in:   "http://kapacitor.example/",
			want: "http://kapacitor.example",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeAlertKapacitorURL(tt.in)
			if got != tt.want {
				t.Fatalf("normalizeAlertKapacitorURL(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}
