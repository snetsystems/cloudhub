package enterprise

import (
	"context"
	"fmt"

	cmp "github.com/snetsystems/cmp/backend"
)

// UserStore uses a control client operate on Influx Enterprise users
type UserStore struct {
	Ctrl
	Logger cmp.Logger
}

// Add creates a new User in Influx Enterprise
func (c *UserStore) Add(ctx context.Context, u *cmp.User) (*cmp.User, error) {
	if err := c.Ctrl.CreateUser(ctx, u.Name, u.Passwd); err != nil {
		return nil, err
	}
	perms := ToEnterprise(u.Permissions)

	if err := c.Ctrl.SetUserPerms(ctx, u.Name, perms); err != nil {
		return nil, err
	}
	for _, role := range u.Roles {
		if err := c.Ctrl.AddRoleUsers(ctx, role.Name, []string{u.Name}); err != nil {
			return nil, err
		}
	}

	return c.Get(ctx, cmp.UserQuery{Name: &u.Name})
}

// Delete the User from Influx Enterprise
func (c *UserStore) Delete(ctx context.Context, u *cmp.User) error {
	return c.Ctrl.DeleteUser(ctx, u.Name)
}

// Num of users in Influx
func (c *UserStore) Num(ctx context.Context) (int, error) {
	all, err := c.All(ctx)
	if err != nil {
		return 0, err
	}

	return len(all), nil
}

// Get retrieves a user if name exists.
func (c *UserStore) Get(ctx context.Context, q cmp.UserQuery) (*cmp.User, error) {
	if q.Name == nil {
		return nil, fmt.Errorf("query must specify name")
	}
	u, err := c.Ctrl.User(ctx, *q.Name)
	if err != nil {
		return nil, err
	}

	ur, err := c.Ctrl.UserRoles(ctx)
	if err != nil {
		return nil, err
	}

	role := ur[*q.Name]
	cr := role.ToCMP()
	// For now we are removing all users from a role being returned.
	for i, r := range cr {
		r.Users = []cmp.User{}
		cr[i] = r
	}
	return &cmp.User{
		Name:        u.Name,
		Permissions: ToCMP(u.Permissions),
		Roles:       cr,
	}, nil
}

// Update the user's permissions or roles
func (c *UserStore) Update(ctx context.Context, u *cmp.User) error {
	// Only allow one type of change at a time. If it is a password
	// change then do it and return without any changes to permissions
	if u.Passwd != "" {
		return c.Ctrl.ChangePassword(ctx, u.Name, u.Passwd)
	}

	if u.Roles != nil {
		// Make a list of the roles we want this user to have:
		want := make([]string, len(u.Roles))
		for i, r := range u.Roles {
			want[i] = r.Name
		}

		// Find the list of all roles this user is currently in
		userRoles, err := c.UserRoles(ctx)
		if err != nil {
			return nil
		}
		// Make a list of the roles the user currently has
		roles := userRoles[u.Name]
		have := make([]string, len(roles.Roles))
		for i, r := range roles.Roles {
			have[i] = r.Name
		}

		// Calculate the roles the user will be removed from and the roles the user
		// will be added to.
		revoke, add := Difference(want, have)

		// First, add the user to the new roles
		for _, role := range add {
			if err := c.Ctrl.AddRoleUsers(ctx, role, []string{u.Name}); err != nil {
				return err
			}
		}

		// ... and now remove the user from an extra roles
		for _, role := range revoke {
			if err := c.Ctrl.RemoveRoleUsers(ctx, role, []string{u.Name}); err != nil {
				return err
			}
		}
	}

	if u.Permissions != nil {
		perms := ToEnterprise(u.Permissions)
		return c.Ctrl.SetUserPerms(ctx, u.Name, perms)
	}
	return nil
}

// All is all users in influx
func (c *UserStore) All(ctx context.Context) ([]cmp.User, error) {
	all, err := c.Ctrl.Users(ctx, nil)
	if err != nil {
		return nil, err
	}

	ur, err := c.Ctrl.UserRoles(ctx)
	if err != nil {
		return nil, err
	}

	res := make([]cmp.User, len(all.Users))
	for i, user := range all.Users {
		role := ur[user.Name]
		cr := role.ToCMP()
		// For now we are removing all users from a role being returned.
		for i, r := range cr {
			r.Users = []cmp.User{}
			cr[i] = r
		}

		res[i] = cmp.User{
			Name:        user.Name,
			Permissions: ToCMP(user.Permissions),
			Roles:       cr,
		}
	}
	return res, nil
}

// ToEnterprise converts cmp permission shape to enterprise
func ToEnterprise(perms cmp.Permissions) Permissions {
	res := Permissions{}
	for _, perm := range perms {
		if perm.Scope == cmp.AllScope {
			// Enterprise uses empty string as the key for all databases
			res[""] = perm.Allowed
		} else {
			res[perm.Name] = perm.Allowed
		}
	}
	return res
}

// ToCMP converts enterprise permissions shape to cmp shape
func ToCMP(perms Permissions) cmp.Permissions {
	res := cmp.Permissions{}
	for db, perm := range perms {
		// Enterprise uses empty string as the key for all databases
		if db == "" {
			res = append(res, cmp.Permission{
				Scope:   cmp.AllScope,
				Allowed: perm,
			})
		} else {
			res = append(res, cmp.Permission{
				Scope:   cmp.DBScope,
				Name:    db,
				Allowed: perm,
			})

		}
	}
	return res
}
