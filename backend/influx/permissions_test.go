package influx

import (
	"encoding/json"
	"reflect"
	"testing"

	cmp "github.com/snetsystems/cmp/backend"
)

func TestDifference(t *testing.T) {
	t.Parallel()
	type args struct {
		wants cmp.Permissions
		haves cmp.Permissions
	}
	tests := []struct {
		name       string
		args       args
		wantRevoke cmp.Permissions
		wantAdd    cmp.Permissions
	}{
		{
			name: "add write to permissions",
			args: args{
				wants: cmp.Permissions{
					cmp.Permission{
						Scope:   "database",
						Name:    "tensorflowdb",
						Allowed: []string{"READ", "WRITE"},
					},
				},
				haves: cmp.Permissions{
					cmp.Permission{
						Scope:   "database",
						Name:    "tensorflowdb",
						Allowed: []string{"READ"},
					},
				},
			},
			wantRevoke: nil,
			wantAdd: cmp.Permissions{
				cmp.Permission{
					Scope:   "database",
					Name:    "tensorflowdb",
					Allowed: []string{"READ", "WRITE"},
				},
			},
		},
		{
			name: "revoke write to permissions",
			args: args{
				wants: cmp.Permissions{
					cmp.Permission{
						Scope:   "database",
						Name:    "tensorflowdb",
						Allowed: []string{"READ"},
					},
				},
				haves: cmp.Permissions{
					cmp.Permission{
						Scope:   "database",
						Name:    "tensorflowdb",
						Allowed: []string{"READ", "WRITE"},
					},
				},
			},
			wantRevoke: nil,
			wantAdd: cmp.Permissions{
				cmp.Permission{
					Scope:   "database",
					Name:    "tensorflowdb",
					Allowed: []string{"READ"},
				},
			},
		},
		{
			name: "revoke all permissions",
			args: args{
				wants: cmp.Permissions{
					cmp.Permission{
						Scope:   "database",
						Name:    "tensorflowdb",
						Allowed: []string{},
					},
				},
				haves: cmp.Permissions{
					cmp.Permission{
						Scope:   "database",
						Name:    "tensorflowdb",
						Allowed: []string{"READ", "WRITE"},
					},
				},
			},
			wantRevoke: cmp.Permissions{
				cmp.Permission{
					Scope:   "database",
					Name:    "tensorflowdb",
					Allowed: []string{},
				},
			},
			wantAdd: nil,
		},
		{
			name: "add permissions different db",
			args: args{
				wants: cmp.Permissions{
					cmp.Permission{
						Scope:   "database",
						Name:    "new",
						Allowed: []string{"READ"},
					},
				},
				haves: cmp.Permissions{
					cmp.Permission{
						Scope:   "database",
						Name:    "old",
						Allowed: []string{"READ", "WRITE"},
					},
				},
			},
			wantRevoke: cmp.Permissions{
				cmp.Permission{
					Scope:   "database",
					Name:    "old",
					Allowed: []string{"READ", "WRITE"},
				},
			},
			wantAdd: cmp.Permissions{
				cmp.Permission{
					Scope:   "database",
					Name:    "new",
					Allowed: []string{"READ"},
				},
			},
		},
	}
	for _, tt := range tests {
		gotRevoke, gotAdd := Difference(tt.args.wants, tt.args.haves)
		if !reflect.DeepEqual(gotRevoke, tt.wantRevoke) {
			t.Errorf("%q. Difference() gotRevoke = %v, want %v", tt.name, gotRevoke, tt.wantRevoke)
		}
		if !reflect.DeepEqual(gotAdd, tt.wantAdd) {
			t.Errorf("%q. Difference() gotAdd = %v, want %v", tt.name, gotAdd, tt.wantAdd)
		}
	}
}

func TestToPriv(t *testing.T) {
	t.Parallel()
	type args struct {
		a cmp.Allowances
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{
			name: "no privs",
			args: args{
				a: cmp.Allowances{},
			},
			want: NoPrivileges,
		},
		{
			name: "read and write privs",
			args: args{
				a: cmp.Allowances{"READ", "WRITE"},
			},
			want: All,
		},
		{
			name: "write privs",
			args: args{
				a: cmp.Allowances{"WRITE"},
			},
			want: Write,
		},
		{
			name: "read privs",
			args: args{
				a: cmp.Allowances{"READ"},
			},
			want: Read,
		},
		{
			name: "all privs",
			args: args{
				a: cmp.Allowances{"ALL"},
			},
			want: All,
		},
		{
			name: "bad privs",
			args: args{
				a: cmp.Allowances{"BAD"},
			},
			want: NoPrivileges,
		},
	}
	for _, tt := range tests {
		if got := ToPriv(tt.args.a); got != tt.want {
			t.Errorf("%q. ToPriv() = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestToGrant(t *testing.T) {
	t.Parallel()
	type args struct {
		username string
		perm     cmp.Permission
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{
			name: "grant all for all dbs",
			args: args{
				username: "biff",
				perm: cmp.Permission{
					Scope:   cmp.AllScope,
					Allowed: cmp.Allowances{"ALL"},
				},
			},
			want: `GRANT ALL PRIVILEGES TO "biff"`,
		},
		{
			name: "grant all for one db",
			args: args{
				username: "biff",
				perm: cmp.Permission{
					Scope:   cmp.DBScope,
					Name:    "gray_sports_almanac",
					Allowed: cmp.Allowances{"ALL"},
				},
			},
			want: `GRANT ALL ON "gray_sports_almanac" TO "biff"`,
		},
		{
			name: "bad allowance",
			args: args{
				username: "biff",
				perm: cmp.Permission{
					Scope:   cmp.DBScope,
					Name:    "gray_sports_almanac",
					Allowed: cmp.Allowances{"bad"},
				},
			},
			want: "",
		},
	}
	for _, tt := range tests {
		if got := ToGrant(tt.args.username, tt.args.perm); got != tt.want {
			t.Errorf("%q. ToGrant() = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestToRevoke(t *testing.T) {
	t.Parallel()
	type args struct {
		username string
		perm     cmp.Permission
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{
			name: "revoke all for all dbs",
			args: args{
				username: "biff",
				perm: cmp.Permission{
					Scope:   cmp.AllScope,
					Allowed: cmp.Allowances{"ALL"},
				},
			},
			want: `REVOKE ALL PRIVILEGES FROM "biff"`,
		},
		{
			name: "revoke all for one db",
			args: args{
				username: "biff",
				perm: cmp.Permission{
					Scope:   cmp.DBScope,
					Name:    "pleasure_paradice",
					Allowed: cmp.Allowances{},
				},
			},
			want: `REVOKE ALL PRIVILEGES ON "pleasure_paradice" FROM "biff"`,
		},
	}
	for _, tt := range tests {
		if got := ToRevoke(tt.args.username, tt.args.perm); got != tt.want {
			t.Errorf("%q. ToRevoke() = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func Test_showResults_Users(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name   string
		octets []byte
		want   []cmp.User
	}{
		{
			name:   "admin and non-admin",
			octets: []byte(`[{"series":[{"columns":["user","admin"],"values":[["admin",true],["reader",false]]}]}]`),
			want: []cmp.User{
				{
					Name: "admin",
					Permissions: cmp.Permissions{
						{
							Scope:   cmp.AllScope,
							Allowed: cmp.Allowances{"ALL"},
						},
					},
				},
				{
					Name:        "reader",
					Permissions: cmp.Permissions{},
				},
			},
		},
		{
			name:   "bad JSON",
			octets: []byte(`[{"series":[{"columns":["user","admin"],"values":[[1,true],["reader","false"]]}]}]`),
			want:   []cmp.User{},
		},
	}

	for _, tt := range tests {
		r := &showResults{}
		json.Unmarshal(tt.octets, r)
		if got := r.Users(); !reflect.DeepEqual(got, tt.want) {
			t.Errorf("%q. showResults.Users() = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func Test_showResults_Permissions(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name   string
		octets []byte
		want   cmp.Permissions
	}{
		{
			name:   "write for one db",
			octets: []byte(`[{"series":[{"columns":["database","privilege"],"values":[["tensorflowdb","WRITE"]]}]}]`),
			want: cmp.Permissions{
				cmp.Permission{
					Scope:   "database",
					Name:    "tensorflowdb",
					Allowed: []string{"WRITE"},
				},
			},
		},
		{
			name:   "all for one db",
			octets: []byte(`[{"series":[{"columns":["database","privilege"],"values":[["tensorflowdb","ALL PRIVILEGES"]]}]}]`),
			want: cmp.Permissions{
				cmp.Permission{
					Scope:   "database",
					Name:    "tensorflowdb",
					Allowed: []string{"WRITE", "READ"},
				},
			},
		},
		{
			name:   "read for one db",
			octets: []byte(`[{"series":[{"columns":["database","privilege"],"values":[["tensorflowdb","READ"]]}]}]`),
			want: cmp.Permissions{
				cmp.Permission{
					Scope:   "database",
					Name:    "tensorflowdb",
					Allowed: []string{"READ"},
				},
			},
		},
		{
			name:   "other all for one db",
			octets: []byte(`[{"series":[{"columns":["database","privilege"],"values":[["tensorflowdb","ALL"]]}]}]`),
			want: cmp.Permissions{
				cmp.Permission{
					Scope:   "database",
					Name:    "tensorflowdb",
					Allowed: []string{"WRITE", "READ"},
				},
			},
		},
		{
			name:   "other all for one db",
			octets: []byte(`[{"series":[{"columns":["database","privilege"],"values":[["tensorflowdb","NO PRIVILEGES"]]}]}]`),
			want:   cmp.Permissions{},
		},
		{
			name:   "bad JSON",
			octets: []byte(`[{"series":[{"columns":["database","privilege"],"values":[[1,"WRITE"]]}]}]`),
			want:   cmp.Permissions{},
		},
		{
			name:   "bad JSON",
			octets: []byte(`[{"series":[{"columns":["database","privilege"],"values":[["tensorflowdb",1]]}]}]`),
			want:   cmp.Permissions{},
		},
	}

	for _, tt := range tests {
		r := &showResults{}
		json.Unmarshal(tt.octets, r)
		if got := r.Permissions(); !reflect.DeepEqual(got, tt.want) {
			t.Errorf("%q. showResults.Users() = %v, want %v", tt.name, got, tt.want)
		}
	}
}
