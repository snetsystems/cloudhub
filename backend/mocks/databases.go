package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.Databases = &Databases{}

// Databases mock allows all databases methods to be set for testing
type Databases struct {
	AllDBF    func(context.Context) ([]cloudhub.Database, error)
	ConnectF  func(context.Context, *cloudhub.Source) error
	CreateDBF func(context.Context, *cloudhub.Database) (*cloudhub.Database, error)
	DropDBF   func(context.Context, string) error

	AllRPF    func(context.Context, string) ([]cloudhub.RetentionPolicy, error)
	CreateRPF func(context.Context, string, *cloudhub.RetentionPolicy) (*cloudhub.RetentionPolicy, error)
	UpdateRPF func(context.Context, string, string, *cloudhub.RetentionPolicy) (*cloudhub.RetentionPolicy, error)
	DropRPF   func(context.Context, string, string) error

	GetMeasurementsF func(ctx context.Context, db string, limit, offset int) ([]cloudhub.Measurement, error)
}

// AllDB lists all databases in the current data source
func (d *Databases) AllDB(ctx context.Context) ([]cloudhub.Database, error) {
	return d.AllDBF(ctx)
}

// Connect connects to a database in the current data source
func (d *Databases) Connect(ctx context.Context, src *cloudhub.Source) error {
	return d.ConnectF(ctx, src)
}

// CreateDB creates a database in the current data source
func (d *Databases) CreateDB(ctx context.Context, db *cloudhub.Database) (*cloudhub.Database, error) {
	return d.CreateDBF(ctx, db)
}

// DropDB drops a database in the current data source
func (d *Databases) DropDB(ctx context.Context, db string) error {
	return d.DropDBF(ctx, db)
}

// AllRP lists all retention policies in the current data source
func (d *Databases) AllRP(ctx context.Context, rpX string) ([]cloudhub.RetentionPolicy, error) {
	return d.AllRPF(ctx, rpX)
}

// CreateRP creates a retention policy in the current data source
func (d *Databases) CreateRP(ctx context.Context, rpX string, rp *cloudhub.RetentionPolicy) (*cloudhub.RetentionPolicy, error) {
	return d.CreateRPF(ctx, rpX, rp)
}

// UpdateRP updates a retention policy in the current data source
func (d *Databases) UpdateRP(ctx context.Context, rpX string, rpY string, rp *cloudhub.RetentionPolicy) (*cloudhub.RetentionPolicy, error) {
	return d.UpdateRPF(ctx, rpX, rpY, rp)
}

// DropRP drops a retention policy in the current data source
func (d *Databases) DropRP(ctx context.Context, rpX string, rpY string) error {
	return d.DropRPF(ctx, rpX, rpY)
}

// GetMeasurements lists measurements in the current data source
func (d *Databases) GetMeasurements(ctx context.Context, db string, limit, offset int) ([]cloudhub.Measurement, error) {
	return d.GetMeasurementsF(ctx, db, limit, offset)
}
