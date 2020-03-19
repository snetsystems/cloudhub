package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.TimeSeries = &TimeSeries{}

// TimeSeries is a mockable CloudHub time series by overriding the functions.
type TimeSeries struct {
	// Connect will connect to the time series using the information in `Source`.
	ConnectF func(context.Context, *cloudhub.Source) error
	// Query retrieves time series data from the database.
	QueryF func(context.Context, cloudhub.Query) (cloudhub.Response, error)
	// Write records points into the TimeSeries
	WriteF func(context.Context, []cloudhub.Point) error
	// UsersStore represents the user accounts within the TimeSeries database
	UsersF func(context.Context) cloudhub.UsersStore
	// Permissions returns all valid names permissions in this database
	PermissionsF func(context.Context) cloudhub.Permissions
	// RolesF represents the roles. Roles group permissions and Users
	RolesF func(context.Context) (cloudhub.RolesStore, error)
}

// New implements TimeSeriesClient
func (t *TimeSeries) New(cloudhub.Source, cloudhub.Logger) (cloudhub.TimeSeries, error) {
	return t, nil
}

// Connect will connect to the time series using the information in `Source`.
func (t *TimeSeries) Connect(ctx context.Context, src *cloudhub.Source) error {
	return t.ConnectF(ctx, src)
}

// Query retrieves time series data from the database.
func (t *TimeSeries) Query(ctx context.Context, query cloudhub.Query) (cloudhub.Response, error) {
	return t.QueryF(ctx, query)
}

// Write records a point into the time series
func (t *TimeSeries) Write(ctx context.Context, points []cloudhub.Point) error {
	return t.WriteF(ctx, points)
}

// Users represents the user accounts within the TimeSeries database
func (t *TimeSeries) Users(ctx context.Context) cloudhub.UsersStore {
	return t.UsersF(ctx)
}

// Roles represents the roles. Roles group permissions and Users
func (t *TimeSeries) Roles(ctx context.Context) (cloudhub.RolesStore, error) {
	return t.RolesF(ctx)
}

// Permissions returns all valid names permissions in this database
func (t *TimeSeries) Permissions(ctx context.Context) cloudhub.Permissions {
	return t.PermissionsF(ctx)
}
