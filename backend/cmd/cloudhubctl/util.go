package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"
	"text/tabwriter"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/bolt"
	"github.com/snetsystems/cloudhub/backend/mocks"
)

// NewBoltClient DBConnect
func NewBoltClient(path string) (*bolt.Client, error) {
	c := bolt.NewClient()
	c.Path = path

	ctx := context.Background()
	logger := mocks.NewLogger()
	var bi cloudhub.BuildInfo
	if err := c.Open(ctx, logger, bi); err != nil {
		return nil, err
	}

	return c, nil
}

// NewTabWriter list-users tab
func NewTabWriter() *tabwriter.Writer {
	return tabwriter.NewWriter(os.Stdout, 0, 8, 1, '\t', 0)
}

// WriteHeaders list-users headers
func WriteHeaders(w io.Writer) {
	fmt.Fprintln(w, "ID\tName\tProvider\tScheme\tSuperAdmin\tOrganization(s)")
}

// WriteUser list-users 
func WriteUser(w io.Writer, user *cloudhub.User) {
	orgs := []string{}
	for _, role := range user.Roles {
		orgs = append(orgs, role.Organization)
	}
	fmt.Fprintf(w, "%d\t%s\t%s\t%s\t%t\t%s\n", user.ID, user.Name, user.Provider, user.Scheme, user.SuperAdmin, strings.Join(orgs, ","))
}