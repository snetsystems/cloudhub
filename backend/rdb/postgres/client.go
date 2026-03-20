package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/snetsystems/cloudhub/backend/rdb"
)

// Ensure Client and txClient implement rdb interfaces at compile time.
var _ rdb.Store        = (*Client)(nil)
var _ rdb.Store        = (*txClient)(nil)
var _ rdb.Migrator     = (*Client)(nil)
var _ rdb.BulkInserter = (*Client)(nil)

// pgxResult adapts pgconn.CommandTag to rdb.Result.
type pgxResult struct {
	tag pgconn.CommandTag
}

func (r pgxResult) RowsAffected() int64 { return r.tag.RowsAffected() }

// Client wraps a pgxpool.Pool and implements rdb.Store.
type Client struct {
	pool *pgxpool.Pool
}

// NewClient opens a PostgreSQL connection pool.
// dsn example: "host=localhost user=cloudhub password=cloudhub dbname=cloudhub sslmode=disable"
func NewClient(ctx context.Context, dsn string) (*Client, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("postgres: connect: %w", err)
	}
	return &Client{pool: pool}, nil
}

func (c *Client) Ping(ctx context.Context) error {
	return c.pool.Ping(ctx)
}

func (c *Client) Close() {
	c.pool.Close()
}

// WithTx executes fn within a database transaction.
// If fn returns an error, the transaction is rolled back and the error is returned.
// If fn returns nil, the transaction is committed and any commit error is returned.
func (c *Client) WithTx(ctx context.Context, fn func(ctx context.Context, s rdb.Store) error) error {
	tx, err := c.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("postgres: begin tx: %w", err)
	}

	txClient := &txClient{tx: tx}

	if err := fn(ctx, txClient); err != nil {
		if rbErr := tx.Rollback(ctx); rbErr != nil {
			return fmt.Errorf("postgres: tx rollback after error %v: %w", err, rbErr)
		}
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("postgres: commit tx: %w", err)
	}
	return nil
}

func (c *Client) ExecContext(ctx context.Context, sql string, args ...any) (rdb.Result, error) {
	tag, err := c.pool.Exec(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return pgxResult{tag: tag}, nil
}

func (c *Client) CopyFrom(ctx context.Context, table string, columns []string, rows [][]any) (int64, error) {
	n, err := c.pool.CopyFrom(ctx, pgx.Identifier{table}, columns, pgx.CopyFromRows(rows))
	if err != nil {
		return 0, fmt.Errorf("postgres: copy from: %w", err)
	}
	return n, nil
}

func (c *Client) QueryContext(ctx context.Context, sql string, args ...any) (rdb.Rows, error) {
	rows, err := c.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return &pgxRows{rows: rows}, nil
}

func (c *Client) QueryRowContext(ctx context.Context, sql string, args ...any) rdb.Row {
	row := c.pool.QueryRow(ctx, sql, args...)
	return &pgxRow{row: row}
}

// pgxRows adapts pgx.Rows to rdb.Rows.
type pgxRows struct {
	rows pgx.Rows
}

func (r *pgxRows) Next() bool             { return r.rows.Next() }
func (r *pgxRows) Close()                 { r.rows.Close() }
func (r *pgxRows) Err() error             { return r.rows.Err() }
func (r *pgxRows) Scan(dest ...any) error { return r.rows.Scan(dest...) }

// pgxRow adapts pgx.Row to rdb.Row.
type pgxRow struct {
	row pgx.Row
}

func (r *pgxRow) Scan(dest ...any) error { return r.row.Scan(dest...) }

// txClient adapts pgx.Tx to the rdb.Store interface for use inside WithTx.
type txClient struct {
	tx pgx.Tx
}

func (c *txClient) Ping(ctx context.Context) error {
	// Within a transaction, use a simple query to verify liveness.
	if _, err := c.tx.Exec(ctx, "SELECT 1"); err != nil {
		return fmt.Errorf("postgres: tx ping: %w", err)
	}
	return nil
}

func (c *txClient) Close() {
	// No-op for a transaction-scoped client; lifecycle is managed by WithTx.
}

func (c *txClient) WithTx(ctx context.Context, fn func(ctx context.Context, s rdb.Store) error) error {
	// Nested transactions are not supported at this abstraction level.
	// If needed in the future, this can be extended with savepoints.
	return fmt.Errorf("postgres: nested transactions not supported")
}

func (c *txClient) ExecContext(ctx context.Context, sql string, args ...any) (rdb.Result, error) {
	tag, err := c.tx.Exec(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return pgxResult{tag: tag}, nil
}

func (c *txClient) QueryContext(ctx context.Context, sql string, args ...any) (rdb.Rows, error) {
	rows, err := c.tx.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return &pgxRows{rows: rows}, nil
}

func (c *txClient) QueryRowContext(ctx context.Context, sql string, args ...any) rdb.Row {
	row := c.tx.QueryRow(ctx, sql, args...)
	return &pgxRow{row: row}
}
