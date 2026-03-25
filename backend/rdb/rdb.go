package rdb

import "context"

// Result is returned by ExecContext and carries the number of rows affected.
type Result interface {
	RowsAffected() int64
}

// Store is the interface for a relational database connection.
// It mirrors the duck-typing pattern used by kv.Store.
type Store interface {
	// Ping verifies the connection to the database.
	Ping(ctx context.Context) error
	// Close closes the connection pool.
	Close()
	// WithTx runs the given function within a transaction boundary.
	// Implementations must commit if fn returns nil and rollback on error.
	WithTx(ctx context.Context, fn func(ctx context.Context, s Store) error) error
	// ExecContext executes a query without returning rows.
	ExecContext(ctx context.Context, sql string, args ...any) (Result, error)
	// QueryContext executes a query returning rows.
	QueryContext(ctx context.Context, sql string, args ...any) (Rows, error)
	// QueryRowContext executes a query expecting a single row.
	QueryRowContext(ctx context.Context, sql string, args ...any) Row
}

// Rows is the iterator returned by QueryContext.
type Rows interface {
	Next() bool
	Scan(dest ...any) error
	Close()
	Err() error
}

// Row is the result of QueryRowContext.
type Row interface {
	Scan(dest ...any) error
}

// BulkInserter performs high-throughput batch inserts.
// Use for data migration (KV → PostgreSQL). Not for general CRUD.
// Access via type assertion: client.(rdb.BulkInserter).CopyFrom(...)
type BulkInserter interface {
	CopyFrom(ctx context.Context, table string, columns []string, rows [][]any) (int64, error)
}
