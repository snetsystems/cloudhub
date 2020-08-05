package main

import (
	"context"
	"strings"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// AddCommand Flags
type AddCommand struct {
	BoltPath      string  `short:"b" long:"bolt-path" description:"Full path to boltDB file (e.g. './cloudhub-v1.db')" env:"BOLT_PATH" default:"cloudhub-v1.db"`
	ID            *uint64 `short:"i" long:"id" description:"Users ID. Must be id for existing user"`
	Username      string  `short:"n" long:"name" description:"Users name. Must be Oauth-able email address or username"`
	Provider      string  `short:"p" long:"provider" description:"Name of the Auth provider (e.g. google, github, auth0, or generic)"`
	Scheme        string  `short:"s" long:"scheme" description:"Authentication scheme that matches auth provider (e.g. oauth2)" default:"oauth2"`
	Organizations string  `short:"o" long:"orgs" description:"A comma separated list of organizations that the user should be added to" default:"default"`
}

var addCommand AddCommand

// Execute add-superadmin
func (l *AddCommand) Execute(args []string) error {
	c, err := NewBoltClient(l.BoltPath)
	if err != nil {
		return err
	}
	defer c.Close()

	svc, err := NewService(c)
	if err != nil {
		return err
	}

	q := cloudhub.UserQuery{
		Name:     &l.Username,
		Provider: &l.Provider,
		Scheme:   &l.Scheme,
	}

	if l.ID != nil {
		q.ID = l.ID
	}

	ctx := context.Background()

	user, err := svc.UsersStore().Get(ctx, q)
	if err != nil && err != cloudhub.ErrUserNotFound {
		return err
	} else if err == cloudhub.ErrUserNotFound {
		user = &cloudhub.User{
			Name:     l.Username,
			Provider: l.Provider,
			Scheme:   l.Scheme,
			Roles: []cloudhub.Role{
				{
					Name:         "member",
					Organization: "default",
				},
			},
			SuperAdmin: true,
		}

		user, err = svc.UsersStore().Add(ctx, user)
		if err != nil {
			return err
		}
	} else {
		user.SuperAdmin = true
		if len(user.Roles) == 0 {
			user.Roles = []cloudhub.Role{
				{
					Name:         "member",
					Organization: "default",
				},
			}
		}
		if err = svc.UsersStore().Update(ctx, user); err != nil {
			return err
		}
	}

	// TODO(desa): Apply mapping to user and update their roles
	roles := []cloudhub.Role{}
OrgLoop:
	for _, org := range strings.Split(l.Organizations, ",") {
		// Check to see is user is already a part of the organization
		for _, r := range user.Roles {
			if r.Organization == org {
				continue OrgLoop
			}
		}

		orgQuery := cloudhub.OrganizationQuery{
			ID: &org,
		}
		o, err := svc.OrganizationsStore().Get(ctx, orgQuery)
		if err != nil {
			return err
		}

		role := cloudhub.Role{
			Organization: org,
			Name:         o.DefaultRole,
		}
		roles = append(roles, role)
	}

	user.Roles = append(user.Roles, roles...)
	if err = svc.UsersStore().Update(ctx, user); err != nil {
		return err
	}

	w := NewTabWriter()
	WriteUserHeaders(w)
	WriteUser(w, user)
	w.Flush()

	return nil
}

func init() {
	parser.AddCommand("add-superadmin",
		"Creates a new superadmin user",
		"The add-user command will create a new user with superadmin status",
		&addCommand)
}