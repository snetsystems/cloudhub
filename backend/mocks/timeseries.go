package mocks

import (
	"context"

	cmp "github.com/snetsystems/cmp/backend"
)

var _ cmp.TimeSeries = &TimeSeries{}

// TimeSeries is a mockable CMP time series by overriding the functions.
type TimeSeries struct {
	// Connect will connect to the time series using the information in `Source`.
	ConnectF func(context.Context, *cmp.Source) error
	// Query retrieves time series data from the database.
	QueryF func(context.Context, cmp.Query) (cmp.Response, error)
	// Write records points into the TimeSeries
	WriteF func(context.Context, []cmp.Point) error
	// UsersStore represents the user accounts within the TimeSeries database
	UsersF func(context.Context) cmp.UsersStore
	// Permissions returns all valid names permissions in this database
	PermissionsF func(context.Context) cmp.Permissions
	// RolesF represents the roles. Roles group permissions and Users
	RolesF func(context.Context) (cmp.RolesStore, error)
}

// New implements TimeSeriesClient
func (t *TimeSeries) New(cmp.Source, cmp.Logger) (cmp.TimeSeries, error) {
	return t, nil
}

// Connect will connect to the time series using the information in `Source`.
func (t *TimeSeries) Connect(ctx context.Context, src *cmp.Source) error {
	return t.ConnectF(ctx, src)
}

// Query retrieves time series data from the database.
func (t *TimeSeries) Query(ctx context.Context, query cmp.Query) (cmp.Response, error) {
	return t.QueryF(ctx, query)
}

// Write records a point into the time series
func (t *TimeSeries) Write(ctx context.Context, points []cmp.Point) error {
	return t.WriteF(ctx, points)
}

// Users represents the user accounts within the TimeSeries database
func (t *TimeSeries) Users(ctx context.Context) cmp.UsersStore {
	return t.UsersF(ctx)
}

// Roles represents the roles. Roles group permissions and Users
func (t *TimeSeries) Roles(ctx context.Context) (cmp.RolesStore, error) {
	return t.RolesF(ctx)
}

// Permissions returns all valid names permissions in this database
func (t *TimeSeries) Permissions(ctx context.Context) cmp.Permissions {
	return t.PermissionsF(ctx)
}
