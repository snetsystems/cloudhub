package bolt_test

// import (
// 	"testing"

// 	gocmp "github.com/google/go-cmp/cmp"
// 	cloudhub "github.com/snetsystems/cloudhub/backend"
// )

// func
// func TestBuildStore_Get(t *testing.T) {
// 	type wants struct {
// 		build *cloudhub.BuildInfo
// 		err   error
// 	}
// 	tests := []struct {
// 		name  string
// 		wants wants
// 	}{
// 		{
// 			name: "When the build info is missing",
// 			wants: wants{
// 				build: &cloudhub.BuildInfo{
// 					Version: "pre-1.4.0.0",
// 					Commit:  "",
// 				},
// 			},
// 		},
// 	}
// 	for _, tt := range tests {
// 		client, err := NewTestClient()
// 		if err != nil {
// 			t.Fatal(err)
// 		}
// 		if err := client.Open(context.TODO()); err != nil {
// 			t.Fatal(err)
// 		}
// 		defer client.Close()

// 		b := client.BuildStore
// 		got, err := b.Get(context.Background())
// 		if (tt.wants.err != nil) != (err != nil) {
// 			t.Errorf("%q. BuildStore.Get() error = %v, wantErr %v", tt.name, err, tt.wants.err)
// 			continue
// 		}
// 		if diff := gocmp.Diff(got, tt.wants.build); diff != "" {
// 			t.Errorf("%q. BuildStore.Get():\n-got/+want\ndiff %s", tt.name, diff)
// 		}
// 	}
// }

// func TestBuildStore_Update(t *testing.T) {

// }
