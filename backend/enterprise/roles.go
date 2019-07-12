package enterprise

import (
	"context"

	cmp "github.com/snetsystems/cmp/backend"
)

// RolesStore uses a control client operate on Influx Enterprise roles.  Roles are
// groups of permissions applied to groups of users
type RolesStore struct {
	Ctrl
	Logger cmp.Logger
}

// Add creates a new Role in Influx Enterprise
// This must be done in three smaller steps: creating, setting permissions, setting users.
func (c *RolesStore) Add(ctx context.Context, u *cmp.Role) (*cmp.Role, error) {
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
func (c *RolesStore) Delete(ctx context.Context, u *cmp.Role) error {
	return c.Ctrl.DeleteRole(ctx, u.Name)
}

// Get retrieves a Role if name exists.
func (c *RolesStore) Get(ctx context.Context, name string) (*cmp.Role, error) {
	role, err := c.Ctrl.Role(ctx, name)
	if err != nil {
		return nil, err
	}

	// Hydrate all the users to gather their permissions and their roles.
	users := make([]cmp.User, len(role.Users))
	for i, u := range role.Users {
		user, err := c.Ctrl.User(ctx, u)
		if err != nil {
			return nil, err
		}
		users[i] = cmp.User{
			Name:        user.Name,
			Permissions: ToCMP(user.Permissions),
		}
	}
	return &cmp.Role{
		Name:        role.Name,
		Permissions: ToCMP(role.Permissions),
		Users:       users,
	}, nil
}

// Update the Role's permissions and roles
func (c *RolesStore) Update(ctx context.Context, u *cmp.Role) error {
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
func (c *RolesStore) All(ctx context.Context) ([]cmp.Role, error) {
	all, err := c.Ctrl.Roles(ctx, nil)
	if err != nil {
		return nil, err
	}

	return all.ToCMP(), nil
}

// ToCMP converts enterprise roles to cmp
func (r *Roles) ToCMP() []cmp.Role {
	res := make([]cmp.Role, len(r.Roles))
	for i, role := range r.Roles {
		users := make([]cmp.User, len(role.Users))
		for i, user := range role.Users {
			users[i] = cmp.User{
				Name: user,
			}
		}

		res[i] = cmp.Role{
			Name:        role.Name,
			Permissions: ToCMP(role.Permissions),
			Users:       users,
		}
	}
	return res
}
