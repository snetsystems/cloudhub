package enterprise

import (
	"reflect"
	"testing"

	cmp "github.com/snetsystems/cmp/backend"
)

func TestRoles_ToCMP(t *testing.T) {
	tests := []struct {
		name  string
		roles []Role
		want  []cmp.Role
	}{
		{
			name:  "empty roles",
			roles: []Role{},
			want:  []cmp.Role{},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := &Roles{
				Roles: tt.roles,
			}
			if got := r.ToCMP(); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("Roles.ToCMP() = %v, want %v", got, tt.want)
			}
		})
	}
}
