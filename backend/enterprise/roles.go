package enterprise

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// RolesStore uses a control client operate on Influx Enterprise roles.  Roles are
// groups of permissions applied to groups of users
type RolesStore struct {
	Ctrl
	Logger cloudhub.Logger
}

// Add creates a new Role in Influx Enterprise
// This must be done in three smaller steps: creating, setting permissions, setting users.
func (c *RolesStore) Add(ctx context.Context, u *cloudhub.Role) (*cloudhub.Role, error) {
	if err := c.Ctrl.CreateRole(ctx, u.Name); err != nil {
		return nil, err
	}
	if err := c.Ctrl.SetRolePerms(ctx, u.Name, ToEnterprise(u.Permissions)); err != nil {
		return nil, err
	}

	users := make([]string, len(u.Users))
	for i, u := range u.Users {
		users[i] = u.Name
	}
	if err := c.Ctrl.SetRoleUsers(ctx, u.Name, users); err != nil {
		return nil, err
	}
	return u, nil
}

// Delete the Role from Influx Enterprise
func (c *RolesStore) Delete(ctx context.Context, u *cloudhub.Role) error {
	return c.Ctrl.DeleteRole(ctx, u.Name)
}

// Get retrieves a Role if name exists.
func (c *RolesStore) Get(ctx context.Context, name string) (*cloudhub.Role, error) {
	role, err := c.Ctrl.Role(ctx, name)
	if err != nil {
		return nil, err
	}

	// Hydrate all the users to gather their permissions and their roles.
	users := make([]cloudhub.User, len(role.Users))
	for i, u := range role.Users {
		user, err := c.Ctrl.User(ctx, u)
		if err != nil {
			return nil, err
		}
		users[i] = cloudhub.User{
			Name:        user.Name,
			Permissions: ToCloudHub(user.Permissions),
		}
	}
	return &cloudhub.Role{
		Name:        role.Name,
		Permissions: ToCloudHub(role.Permissions),
		Users:       users,
	}, nil
}

// Update the Role's permissions and roles
func (c *RolesStore) Update(ctx context.Context, u *cloudhub.Role) error {
	if u.Permissions != nil {
		perms := ToEnterprise(u.Permissions)
		if err := c.Ctrl.SetRolePerms(ctx, u.Name, perms); err != nil {
			return err
		}
	}
	if u.Users != nil {
		users := make([]string, len(u.Users))
		for i, u := range u.Users {
			users[i] = u.Name
		}
		return c.Ctrl.SetRoleUsers(ctx, u.Name, users)
	}
	return nil
}

// All is all Roles in influx
func (c *RolesStore) All(ctx context.Context) ([]cloudhub.Role, error) {
	all, err := c.Ctrl.Roles(ctx, nil)
	if err != nil {
		return nil, err
	}

	return all.ToCloudHub(), nil
}

// ToCloudHub converts enterprise roles to cloudhub
func (r *Roles) ToCloudHub() []cloudhub.Role {
	res := make([]cloudhub.Role, len(r.Roles))
	for i, role := range r.Roles {
		users := make([]cloudhub.User, len(role.Users))
		for i, user := range role.Users {
			users[i] = cloudhub.User{
				Name: user,
			}
		}

		res[i] = cloudhub.Role{
			Name:        role.Name,
			Permissions: ToCloudHub(role.Permissions),
			Users:       users,
		}
	}
	return res
}
