package mocks

import (
	"context"

	cmp "github.com/snetsystems/cmp/backend"
)

var _ cmp.Databases = &Databases{}

// Databases mock allows all databases methods to be set for testing
type Databases struct {
	AllDBF    func(context.Context) ([]cmp.Database, error)
	ConnectF  func(context.Context, *cmp.Source) error
	CreateDBF func(context.Context, *cmp.Database) (*cmp.Database, error)
	DropDBF   func(context.Context, string) error

	AllRPF    func(context.Context, string) ([]cmp.RetentionPolicy, error)
	CreateRPF func(context.Context, string, *cmp.RetentionPolicy) (*cmp.RetentionPolicy, error)
	UpdateRPF func(context.Context, string, string, *cmp.RetentionPolicy) (*cmp.RetentionPolicy, error)
	DropRPF   func(context.Context, string, string) error

	GetMeasurementsF func(ctx context.Context, db string, limit, offset int) ([]cmp.Measurement, error)
}

// AllDB lists all databases in the current data source
func (d *Databases) AllDB(ctx context.Context) ([]cmp.Database, error) {
	return d.AllDBF(ctx)
}

// Connect connects to a database in the current data source
func (d *Databases) Connect(ctx context.Context, src *cmp.Source) error {
	return d.ConnectF(ctx, src)
}

// CreateDB creates a database in the current data source
func (d *Databases) CreateDB(ctx context.Context, db *cmp.Database) (*cmp.Database, error) {
	return d.CreateDBF(ctx, db)
}

// DropDB drops a database in the current data source
func (d *Databases) DropDB(ctx context.Context, db string) error {
	return d.DropDBF(ctx, db)
}

// AllRP lists all retention policies in the current data source
func (d *Databases) AllRP(ctx context.Context, rpX string) ([]cmp.RetentionPolicy, error) {
	return d.AllRPF(ctx, rpX)
}

// CreateRP creates a retention policy in the current data source
func (d *Databases) CreateRP(ctx context.Context, rpX string, rp *cmp.RetentionPolicy) (*cmp.RetentionPolicy, error) {
	return d.CreateRPF(ctx, rpX, rp)
}

// UpdateRP updates a retention policy in the current data source
func (d *Databases) UpdateRP(ctx context.Context, rpX string, rpY string, rp *cmp.RetentionPolicy) (*cmp.RetentionPolicy, error) {
	return d.UpdateRPF(ctx, rpX, rpY, rp)
}

// DropRP drops a retention policy in the current data source
func (d *Databases) DropRP(ctx context.Context, rpX string, rpY string) error {
	return d.DropRPF(ctx, rpX, rpY)
}

// GetMeasurements lists measurements in the current data source
func (d *Databases) GetMeasurements(ctx context.Context, db string, limit, offset int) ([]cmp.Measurement, error) {
	return d.GetMeasurementsF(ctx, db, limit, offset)
}
