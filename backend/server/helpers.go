package server

import (
	"net/http"
	"path"
	"bufio"
	"net"
	"errors"
	"os/exec"
	"unsafe"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

func location(w http.ResponseWriter, self string) {
	w.Header().Add("Location", self)
}

// hsts add HTTP Strict Transport Security header with a max-age of two years
// Inspired from https://blog.bracebin.com/achieving-perfect-ssl-labs-score-with-go
func hsts(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
		next.ServeHTTP(w, r)
	})
}

// version handler adds X-CloudHub-Version header to responses
func version(version string, h http.Handler) http.Handler {
	fn := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("X-CloudHub-Version", version)
		h.ServeHTTP(w, r)
	}
	return http.HandlerFunc(fn)
}

// logout chooses the correct provider logout route and redirects to it
func logout(nextURL, basepath string, routes AuthRoutes) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		principal, err := getPrincipal(ctx)
		if err != nil {
			http.Redirect(w, r, path.Join(basepath, nextURL), http.StatusTemporaryRedirect)
			return
		}
		route, ok := routes.Lookup(principal.Issuer)
		if !ok {
			http.Redirect(w, r, path.Join(basepath, nextURL), http.StatusTemporaryRedirect)
			return
		}
		http.Redirect(w, r, route.Logout, http.StatusTemporaryRedirect)
	}
}

type flushingResponseWriter struct {
	http.ResponseWriter
}

func (f *flushingResponseWriter) WriteHeader(status int) {
	f.ResponseWriter.WriteHeader(status)
}

// Flush is here because the underlying HTTP chunked transfer response writer
// to implement http.Flusher.  Without it data is silently buffered.  This
// was discovered when proxying kapacitor chunked logs.
func (f *flushingResponseWriter) Flush() {
	if flusher, ok := f.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (f *flushingResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if hijacker, ok := f.ResponseWriter.(http.Hijacker); ok {
		return hijacker.Hijack()
	}
	return nil, nil, errors.New("I'm not a Hijacker")
}

// FlushingHandler may not actually do anything, but it was ostensibly
// implemented to flush response writers that can be flushed for the
// purposes in the comment above.
func FlushingHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		iw := &flushingResponseWriter{
			ResponseWriter: w,
		}
		next.ServeHTTP(iw, r)
	})
}

func programExec(program string, args []string, logger cloudhub.Logger) bool {
    cmd := exec.Command(program, args...)
	out, err := cmd.CombinedOutput()

    if err != nil { 
		logger.WithField("component", program).Error("Error message ", err.Error())
		return false
	}
	
	logger.WithField("component", program).Info(string(out))

	httpStatusCode := ByteArrayToInt(out)

	if httpStatusCode == http.StatusOK || httpStatusCode == http.StatusCreated || httpStatusCode == http.StatusAccepted {
		return true
	}
	return false
}

// ByteArrayToInt byte array to int
func ByteArrayToInt(arr []byte) int64 {
    val := int64(0)
    size := len(arr)
    for i := 0 ; i < size ; i++ {
        *(*uint8)(unsafe.Pointer(uintptr(unsafe.Pointer(&val)) + uintptr(i))) = arr[i]
    }
    return val
}