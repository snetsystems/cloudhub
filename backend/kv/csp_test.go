package kv_test

import (
	"context"
	"fmt"
	"reflect"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure an CSPStore can store, retrieve, update, and delete CSP.
func TestCSPStore(t *testing.T) {
	c, err := NewTestClient()
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()

	s := c.CSPStore()

	csps := []cloudhub.CSP{
		{
			ID: "",
			Provider: "aws",
			NameSpace: "seoul",
			AccessKey: "DKCICJD837RJCUWH",
			SecretKey: "KLDJWHWJ+SKDFUEH8334342DCG",
			Organization: "133",
			Minion: "minion_01",
		},
		{
			ID: "",
			Provider: "gcp",
			NameSpace: "usa",
			AccessKey: "ELDFODFBWMFDS83763UYDJKC",
			SecretKey: "LKWEJDSI9+37DJDFSHJEWKDSF",
			Organization: "226541",
			Minion: "minion_02",
		},
	}

	// Add new CSP.
	ctx := context.Background()
	for i, csp := range csps {
		var rtnCSP *cloudhub.CSP
		if rtnCSP, err = s.Add(ctx, &csp); err != nil {
			t.Fatal(err)
		}
		csps[i].ID = rtnCSP.ID
		
		// Confirm first ts in the store is the same as the original.
		if actual, err := s.Get(ctx, cloudhub.CSPQuery{ID: &rtnCSP.ID}); err != nil {
			t.Fatal(err)
		} else if !reflect.DeepEqual(*actual, csps[i]) {
			t.Fatalf("CSP loaded is different then CSP saved; actual: %v, expected %v", *actual, csps[i])
		}
	}

	// Update CSP.
	csps[1].NameSpace = "china"
	if err := s.Update(ctx, &csps[1]); err != nil {
		t.Fatal(err)
	}

	// Confirm CSP have updated.
	csp, err := s.Get(ctx, cloudhub.CSPQuery{ID: &csps[1].ID});
	fmt.Println(csp)
	if err != nil {
		t.Fatal(err)
	} else if csp.NameSpace != "china" {
		t.Fatalf("CSP 1 update error: got %v, expected %v", csp.NameSpace, "china")
	}

	// Delete an CSP.
	if err := s.Delete(ctx, csp); err != nil {
		t.Fatal(err)
	}

	// Confirm CSP has been deleted.
	if _, err := s.Get(ctx, cloudhub.CSPQuery{ID: &csps[1].ID}); err != cloudhub.ErrCSPNotFound {
		t.Fatalf("CSP delete error: got %v, expected %v", err, cloudhub.ErrCSPNotFound)
	}	
}