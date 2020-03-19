package enterprise

import (
	"reflect"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

func TestRoles_ToCloudHub(t *testing.T) {
	tests := []struct {
		name  string
		roles []Role
		want  []cloudhub.Role
	}{
		{
			name:  "empty roles",
			roles: []Role{},
			want:  []cloudhub.Role{},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := &Roles{
				Roles: tt.roles,
			}
			if got := r.ToCloudHub(); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("Roles.ToCloudHub() = %v, want %v", got, tt.want)
			}
		})
	}
}
