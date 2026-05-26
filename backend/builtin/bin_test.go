package builtin

import (
	"context"
	"io"
	"sync"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/log"
)

type recordingLogger struct {
	mu     sync.Mutex
	errors []interface{}
}

func (l *recordingLogger) Debug(items ...interface{}) {}
func (l *recordingLogger) Info(items ...interface{})  {}

func (l *recordingLogger) Error(items ...interface{}) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.errors = append(l.errors, items...)
}

func (l *recordingLogger) WithField(key string, value interface{}) cloudhub.Logger {
	return l
}

func (l *recordingLogger) Writer() *io.PipeWriter {
	return nil
}

func (l *recordingLogger) errorCount() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.errors)
}

func TestBinDashboardsStore_All(t *testing.T) {
	t.Parallel()

	store := &BinDashboardsStore{
		Logger: log.New(log.DebugLevel),
	}

	ctx := context.Background()
	dashboards, err := store.All(ctx)
	if err != nil {
		t.Fatalf("BinDashboardsStore.All() error = %v", err)
	}

	// Should have at least one builtin dashboard (hostpage.json)
	if len(dashboards) == 0 {
		t.Error("BinDashboardsStore.All() returned no dashboards, expected at least one")
	}

	// Check that all returned dashboards have type "builtin"
	for _, dashboard := range dashboards {
		if dashboard.Type != "builtin" {
			t.Errorf("BinDashboardsStore.All() returned dashboard with type %q, expected 'builtin'", dashboard.Type)
		}
		if dashboard.Name == "" {
			t.Error("BinDashboardsStore.All() returned dashboard with empty name")
		}
	}
}

func TestBinDashboardsStore_AllIgnoresAlertTemplateAssets(t *testing.T) {
	t.Parallel()

	logger := &recordingLogger{}
	store := &BinDashboardsStore{
		Logger: logger,
	}

	_, err := store.All(context.Background())
	if err != nil {
		t.Fatalf("BinDashboardsStore.All() error = %v", err)
	}
	if logger.errorCount() != 0 {
		t.Fatalf("BinDashboardsStore.All() logged %d errors, expected none", logger.errorCount())
	}
}

func TestBinDashboardsStore_Get(t *testing.T) {
	t.Parallel()

	store := &BinDashboardsStore{
		Logger: log.New(log.DebugLevel),
	}

	ctx := context.Background()

	// First, get all dashboards to find a valid name
	allDashboards, err := store.All(ctx)
	if err != nil {
		t.Fatalf("BinDashboardsStore.All() error = %v", err)
	}

	if len(allDashboards) == 0 {
		t.Skip("No builtin dashboards available for testing")
	}

	testName := allDashboards[0].Name

	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{
			name:    "Get existing dashboard by name",
			input:   testName,
			wantErr: false,
		},
		{
			name:    "Get non-existent dashboard",
			input:   "NonExistentDashboard",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		ts := tt
		t.Run(ts.name, func(t *testing.T) {
			t.Parallel()
			dashboard, err := store.Get(ctx, ts.input)
			if (err != nil) != ts.wantErr {
				t.Errorf("BinDashboardsStore.Get() error = %v, wantErr %v", err, ts.wantErr)
				return
			}
			if !ts.wantErr {
				if dashboard.Name != ts.input {
					t.Errorf("BinDashboardsStore.Get() returned dashboard with name %q, expected %q", dashboard.Name, ts.input)
				}
				if dashboard.Type != "builtin" {
					t.Errorf("BinDashboardsStore.Get() returned dashboard with type %q, expected 'builtin'", dashboard.Type)
				}
			}
		})
	}
}

func TestBinDashboardsStore_GetByFileName(t *testing.T) {
	t.Parallel()

	store := &BinDashboardsStore{
		Logger: log.New(log.DebugLevel),
	}

	ctx := context.Background()

	tests := []struct {
		name     string
		fileName string
		wantErr  bool
		wantName string
	}{
		{
			name:     "Get server details dashboard by file name",
			fileName: "server-details",
			wantErr:  false,
			wantName: "server-details",
		},
		{
			name:     "Get server details dashboard by file name with extension",
			fileName: "server-details.json",
			wantErr:  false,
			wantName: "server-details",
		},
		{
			name:     "Get non-existent dashboard",
			fileName: "nonexistent",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		ts := tt
		t.Run(ts.name, func(t *testing.T) {
			t.Parallel()
			dashboard, err := store.GetByFileName(ctx, ts.fileName)
			if (err != nil) != ts.wantErr {
				t.Errorf("BinDashboardsStore.GetByFileName() error = %v, wantErr %v", err, ts.wantErr)
				return
			}
			if !ts.wantErr {
				if dashboard.Name != ts.wantName {
					t.Errorf("BinDashboardsStore.GetByFileName() returned dashboard with name %q, expected %q", dashboard.Name, ts.wantName)
				}
				if dashboard.Type != "builtin" {
					t.Errorf("BinDashboardsStore.GetByFileName() returned dashboard with type %q, expected 'builtin'", dashboard.Type)
				}
			}
		})
	}
}
