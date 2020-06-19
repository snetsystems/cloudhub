package server

import (
	"net/http"
	"time"
	"bufio"
	"net"
	"errors"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// statusWriterFlusher captures the status header of an http.ResponseWriter
// and is a flusher
type statusWriter struct {
	http.ResponseWriter
	// Flusher http.Flusher // jack: unecessary field, if need to use it should be activated.
	status  int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *statusWriter) Status() int { return w.status }

// Flush is here because the underlying HTTP chunked transfer response writer
// to implement http.Flusher.  Without it data is silently buffered.  This
// was discovered when proxying kapacitor chunked logs.
func (w *statusWriter) Flush() {
	// if w.Flusher != nil {
	// 	w.Flusher.Flush()
	// }
	if flusher, ok := w.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (w *statusWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if hijacker, ok := w.ResponseWriter.(http.Hijacker); ok {
		return hijacker.Hijack()
	}
	return nil, nil, errors.New("I'm not a Hijacker")
}

// Logger is middleware that logs the request
func Logger(logger cloudhub.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		now := time.Now()
		logger.WithField("component", "server").
			WithField("remote_addr", r.RemoteAddr).
			WithField("method", r.Method).
			WithField("url", r.URL).
			Debug("Request")

		sw := &statusWriter{
			ResponseWriter: w,
		}
		// if f, ok := w.(http.Flusher); ok {
		// 	sw.Flusher = f
		// }
		next.ServeHTTP(sw, r)
		later := time.Now()
		elapsed := later.Sub(now)

		logger.
			WithField("component", "server").
			WithField("remote_addr", r.RemoteAddr).
			WithField("method", r.Method).
			WithField("response_time", elapsed.String()).
			WithField("status", sw.Status()).
			Info("Response: ", http.StatusText(sw.Status()))
	})
}
