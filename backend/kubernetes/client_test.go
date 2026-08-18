package kubernetes

import (
	"context"
	"fmt"
	"io"
	"strings"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

type recordingLogger struct {
	messages []string
}

func (l *recordingLogger) record(args ...interface{}) {
	l.messages = append(l.messages, fmt.Sprint(args...))
}

func (l *recordingLogger) Debug(args ...interface{}) { l.record(args...) }
func (l *recordingLogger) Info(args ...interface{})  { l.record(args...) }
func (l *recordingLogger) Error(args ...interface{}) { l.record(args...) }

func (l *recordingLogger) WithField(string, interface{}) cloudhub.Logger { return l }
func (l *recordingLogger) Writer() *io.PipeWriter                        { return nil }

func TestGetTokenDoesNotLogTokenMetadata(t *testing.T) {
	logger := &recordingLogger{}
	client := NewClient(Config{
		URL:   "https://kubernetes.example",
		Token: "secret-prefix-never-log-rest",
	}, logger)

	got, err := client.GetToken(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if got != "secret-prefix-never-log-rest" {
		t.Fatal("token mismatch")
	}

	joined := strings.Join(logger.messages, "\n")
	for _, forbidden := range []string{
		"secret-prefix-never-log-rest",
		"secret-pre",
		"28",
	} {
		if strings.Contains(joined, forbidden) {
			t.Fatalf("log contains token-derived value %q", forbidden)
		}
	}
}
