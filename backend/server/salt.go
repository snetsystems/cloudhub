package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"
)

// SaltProxy proxies requests to services using the path query parameter.
func (s *Service) SaltProxy(w http.ResponseWriter, r *http.Request) {
	var uri string

	path := r.URL.Query().Get("path")
	uri = singleJoiningSlash(s.AddonURLs["salt"], path)
	u, err := url.Parse(uri)
	if err != nil {
		msg := fmt.Sprintf("Error parsing salt url: %v", err)
		Error(w, http.StatusUnprocessableEntity, msg, s.Logger)
		return
	}

	director := func(req *http.Request) {
		req.Host = u.Host
		req.URL = u
	}

	// Without a FlushInterval the HTTP Chunked response for salt logs is
	// buffered and flushed every 30 seconds.
	proxy := &httputil.ReverseProxy{
		Director:      director,
		FlushInterval: time.Second,
	}

	proxy.ServeHTTP(w, r)
}

// SaltProxyPost proxies POST to service
func (s *Service) SaltProxyPost(w http.ResponseWriter, r *http.Request) {
	s.SaltProxy(w, r)
}

// SaltHTTPPost posts a http request to salt api server
func (s *Service) SaltHTTPPost(payload []byte) (int, []byte, error) {
	resp, err := http.Post(s.AddonURLs["salt"], "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()

	respBody, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, nil, err
	}
	return resp.StatusCode, respBody, nil
}

// CreateFile creates the file using salt
func (s *Service) CreateFile(path string, contents []string) (int, []byte, error) {
	type kwarg struct {
		Fun  string   `json:"fun"`
		Path string   `json:"path"`
		Args []string `json:"args"`
	}
	type param struct {
		Token  string `json:"token"`
		Eauth  string `json:"eauth"`
		Client string `json:"client"`
		Fun    string `json:"fun"`
		Kwarg  kwarg  `json:"kwarg"`
	}

	body := &param{
		Token:  s.AddonTokens["salt"],
		Eauth:  "pam",
		Client: "runner",
		Fun:    "salt.cmd",
		Kwarg: kwarg{
			Fun:  "file.write",
			Path: path,
			Args: contents,
		},
	}

	payload, _ := json.Marshal(body)
	return s.SaltHTTPPost(payload)
}

// RemoveFile removes the file using salt
func (s *Service) RemoveFile(path string) (int, []byte, error) {
	type kwarg struct {
		Fun  string `json:"fun"`
		Path string `json:"path"`
	}
	type param struct {
		Token  string `json:"token"`
		Eauth  string `json:"eauth"`
		Client string `json:"client"`
		Fun    string `json:"fun"`
		Kwarg  kwarg  `json:"kwarg"`
	}

	body := &param{
		Token:  s.AddonTokens["salt"],
		Eauth:  "pam",
		Client: "runner",
		Fun:    "salt.cmd",
		Kwarg: kwarg{
			Fun:  "file.remove",
			Path: path,
		},
	}

	payload, _ := json.Marshal(body)
	return s.SaltHTTPPost(payload)
}

// DirectoryExists is tests to see if path is a valid directory
func (s *Service) DirectoryExists(path string) (int, []byte, error) {
	type kwarg struct {
		Fun  string `json:"fun"`
		Path string `json:"path"`
	}
	type param struct {
		Token  string `json:"token"`
		Eauth  string `json:"eauth"`
		Client string `json:"client"`
		Fun    string `json:"fun"`
		Kwarg  kwarg  `json:"kwarg"`
	}

	body := &param{
		Token:  s.AddonTokens["salt"],
		Eauth:  "pam",
		Client: "runner",
		Fun:    "salt.cmd",
		Kwarg: kwarg{
			Fun:  "file.directory_exists",
			Path: path,
		},
	}

	payload, _ := json.Marshal(body)
	return s.SaltHTTPPost(payload)
}

// Mkdir make the path to ensure that a directory is available
func (s *Service) Mkdir(path string) (int, []byte, error) {
	type kwarg struct {
		Fun  string `json:"fun"`
		Path string `json:"dir_path"`
	}
	type param struct {
		Token  string `json:"token"`
		Eauth  string `json:"eauth"`
		Client string `json:"client"`
		Fun    string `json:"fun"`
		Kwarg  kwarg  `json:"kwarg"`
	}

	body := &param{
		Token:  s.AddonTokens["salt"],
		Eauth:  "pam",
		Client: "runner",
		Fun:    "salt.cmd",
		Kwarg: kwarg{
			Fun:  "file.mkdir",
			Path: path,
		},
	}

	payload, _ := json.Marshal(body)
	return s.SaltHTTPPost(payload)
}

// DaemonReload reloads the config of the specified service with systemd
func (s *Service) DaemonReload(name string) (int, []byte, error) {
	type kwarg struct {
		Fun  string `json:"fun"`
		Name string `json:"name"`
	}
	type param struct {
		Token  string `json:"token"`
		Eauth  string `json:"eauth"`
		Client string `json:"client"`
		Fun    string `json:"fun"`
		Kwarg  kwarg  `json:"kwarg"`
	}

	body := &param{
		Token:  s.AddonTokens["salt"],
		Eauth:  "pam",
		Client: "runner",
		Fun:    "salt.cmd",
		Kwarg: kwarg{
			Fun:  "service.reload",
			Name: name,
		},
	}

	payload, _ := json.Marshal(body)
	return s.SaltHTTPPost(payload)
}
