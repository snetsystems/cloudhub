package postgres

import (
	"context"
	"embed"
	"fmt"
	"io/fs"

	"github.com/jackc/tern/v2/migrate"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// Migrate runs all pending up migrations using jackc/tern.
// Uses embedded SQL files and tracks applied versions in schema_version table.
// Safe to call on every startup — skips already-applied migrations.
func (c *Client) Migrate(ctx context.Context) error {
	conn, err := c.pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("migrate: acquire connection: %w", err)
	}
	defer conn.Release()

	migrator, err := migrate.NewMigrator(ctx, conn.Conn(), "schema_version")
	if err != nil {
		return fmt.Errorf("migrate: new migrator: %w", err)
	}

	migrationsSubFS, subErr := fs.Sub(migrationsFS, "migrations")
	if subErr != nil {
		return fmt.Errorf("migrate: sub fs: %w", subErr)
	}
	if err := migrator.LoadMigrations(migrationsSubFS); err != nil {
		return fmt.Errorf("migrate: load migrations: %w", err)
	}

	if err := migrator.Migrate(ctx); err != nil {
		return fmt.Errorf("migrate: up: %w", err)
	}

	return nil
}
