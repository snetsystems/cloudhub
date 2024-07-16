package server

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"
)

func (s *Service) saltProxyServe(body []byte, u *url.URL, w http.ResponseWriter, r *http.Request) {
	var mapBody map[string]interface{}
	err := json.Unmarshal(body, &mapBody)
	if err != nil {
		msg := fmt.Sprintf("Unmarshal Error from the salt body: %v", err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}

	mapBody["token"] = s.AddonTokens["salt"]
	authBody, err := json.Marshal(mapBody)
	if err != nil {
		msg := fmt.Sprintf("Marshal Error to the salt body: %v", err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}

	director := func(req *http.Request) {
		req.Host = u.Host
		req.URL = u
		req.Body = ioutil.NopCloser(bytes.NewReader(authBody))
		req.ContentLength = int64(len(authBody))
	}

	// Without a FlushInterval the HTTP Chunked response for salt logs is
	// buffered and flushed every 30 seconds.
	proxy := &httputil.ReverseProxy{
		Director: director,
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
				DualStack: true,
			}).DialContext,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
			TLSClientConfig:       &tls.Config{InsecureSkipVerify: true},
		},
		FlushInterval: time.Second,
	}

	proxy.ServeHTTP(w, r)
}

func (s *Service) saltArrayProxyServe(body []byte, u *url.URL, w http.ResponseWriter, r *http.Request) {
	var bodies []map[string]interface{}
	err := json.Unmarshal(body, &bodies)
	if err != nil {
		msg := fmt.Sprintf("Unmarshal Error from the salt body: %v", err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}

	for _, body := range bodies {
		body["token"] = s.AddonTokens["salt"]
	}

	authBody, err := json.Marshal(bodies)
	if err != nil {
		msg := fmt.Sprintf("Marshal Error to the salt body: %v", err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}

	director := func(req *http.Request) {
		req.Host = u.Host
		req.URL = u
		req.Body = ioutil.NopCloser(bytes.NewReader(authBody))
		req.ContentLength = int64(len(authBody))
	}

	// Without a FlushInterval the HTTP Chunked response for salt logs is
	// buffered and flushed every 30 seconds.
	proxy := &httputil.ReverseProxy{
		Director: director,
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
				DualStack: true,
			}).DialContext,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
			TLSClientConfig:       &tls.Config{InsecureSkipVerify: true},
		},
		FlushInterval: time.Second,
	}

	proxy.ServeHTTP(w, r)
}

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

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	t := r.URL.Query().Get("type")
	if t == "array" {
		s.saltArrayProxyServe(body, u, w, r)
	} else {
		s.saltProxyServe(body, u, w, r)
	}
}

// SaltProxyPost proxies POST to service
func (s *Service) SaltProxyPost(w http.ResponseWriter, r *http.Request) {
	s.SaltProxy(w, r)
}

// SaltHTTPPost posts a http request to salt api server
func (s *Service) SaltHTTPPost(payload []byte) (int, []byte, error) {
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
			DualStack: true,
		}).DialContext,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		TLSClientConfig:       &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Transport: transport}

	resp, err := client.Post(s.AddonURLs["salt"], "application/json", bytes.NewBuffer(payload))
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

// CreateFileWithLocalClient creates a file with the specified contents on the target minion.
func (s *Service) CreateFileWithLocalClient(path string, contents []string, targetMinion string) (int, []byte, error) {

	type kwarg struct {
		Path string   `json:"path"`
		Args []string `json:"args"`
	}
	type param struct {
		Token  string `json:"token"`
		Eauth  string `json:"eauth"`
		Client string `json:"client"`
		Fun    string `json:"fun"`
		Target string `json:"tgt"`
		Kwarg  kwarg  `json:"kwarg"`
	}

	body := &param{
		Token:  s.AddonTokens["salt"],
		Eauth:  "pam",
		Fun:    "file.write",
		Client: "local",
		Target: targetMinion,
		Kwarg: kwarg{
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

// RemoveFileWithLocalClient removes a file at the specified path on the target minion.
func (s *Service) RemoveFileWithLocalClient(path string, targetMinion string) (int, []byte, error) {
	type param struct {
		Token  string `json:"token"`
		Eauth  string `json:"eauth"`
		Client string `json:"client"`
		Fun    string `json:"fun"`
		Target string `json:"tgt"`
		Arg    string `json:"arg"`
	}

	body := &param{
		Token:  s.AddonTokens["salt"],
		Eauth:  "pam",
		Client: "local",
		Fun:    "file.remove",
		Target: targetMinion,
		Arg:    path,
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

// DirectoryExistsWithLocalClient checks if a directory exists at the specified path on the target minion.
func (s *Service) DirectoryExistsWithLocalClient(path string, targetMinion string) (int, []byte, error) {

	type param struct {
		Token  string `json:"token"`
		Eauth  string `json:"eauth"`
		Client string `json:"client"`
		Fun    string `json:"fun"`
		Target string `json:"tgt"`
		Arg    string `json:"arg"`
	}

	body := &param{
		Token:  s.AddonTokens["salt"],
		Eauth:  "pam",
		Client: "local",
		Fun:    "file.directory_exists",
		Target: targetMinion,
		Arg:    path,
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

// MkdirWithLocalClient creates a directory at the specified path on the target minion.
func (s *Service) MkdirWithLocalClient(path string, targetMinion string) (int, []byte, error) {

	type param struct {
		Token  string `json:"token"`
		Eauth  string `json:"eauth"`
		Client string `json:"client"`
		Fun    string `json:"fun"`
		Target string `json:"tgt"`
		Arg    string `json:"arg"`
	}

	body := &param{
		Token:  s.AddonTokens["salt"],
		Eauth:  "pam",
		Client: "local",
		Fun:    "file.mkdir",
		Target: targetMinion,
		Arg:    path,
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

// IsActiveMinionPingTest checks if the specified minion is active by sending a ping request.
func (s *Service) IsActiveMinionPingTest(targetMinion string) (int, []byte, error) {

	type param struct {
		Token  string `json:"token"`
		Eauth  string `json:"eauth"`
		Client string `json:"client"`
		Fun    string `json:"fun"`
		Target string `json:"tgt"`
	}

	body := &param{
		Token:  s.AddonTokens["salt"],
		Eauth:  "pam",
		Client: "local",
		Fun:    "test.ping",
		Target: targetMinion,
	}

	payload, _ := json.Marshal(body)
	return s.SaltHTTPPost(payload)
}

// GetWheelKeyListAll retrieves a list of all keys using the wheel client.
func (s *Service) GetWheelKeyListAll() (int, []byte, error) {

	type param struct {
		Token  string `json:"token"`
		Eauth  string `json:"eauth"`
		Client string `json:"client"`
		Fun    string `json:"fun"`
	}

	body := &param{
		Token:  s.AddonTokens["salt"],
		Eauth:  "pam",
		Client: "wheel",
		Fun:    "key.list_all",
	}

	payload, _ := json.Marshal(body)
	return s.SaltHTTPPost(payload)
}

// GetWheelKeyAcceptedListAll retrieves a list of all accepted keys using the wheel client.
func (s *Service) GetWheelKeyAcceptedListAll() (int, []byte, error) {

	type param struct {
		Token  string `json:"token"`
		Eauth  string `json:"eauth"`
		Client string `json:"client"`
		Fun    string `json:"fun"`
		Match  string `json:"match"`
	}

	body := &param{
		Token:  s.AddonTokens["salt"],
		Eauth:  "pam",
		Client: "wheel",
		Fun:    "key.list",
		Match:  "accepted",
	}

	payload, _ := json.Marshal(body)
	return s.SaltHTTPPost(payload)
}

// DockerRestart is tests to see if path is a valid directory
func (s *Service) DockerRestart(path string, targetMinion string, dockerCommand string) (int, []byte, error) {
	type kwarg struct {
		Cmd string `json:"cmd"`
		Cwd string `json:"cwd"`
	}

	type param struct {
		Token  string `json:"token"`
		Eauth  string `json:"eauth"`
		Client string `json:"client"`
		Fun    string `json:"fun"`
		Target string `json:"tgt"`
		Kwarg  kwarg  `json:"kwarg"`
	}

	body := &param{
		Token:  s.AddonTokens["salt"],
		Eauth:  "pam",
		Client: "local",
		Target: targetMinion,
		Fun:    "cmd.run",
		Kwarg: kwarg{
			Cmd: dockerCommand,
			Cwd: path,
		},
	}

	payload, _ := json.Marshal(body)
	return s.SaltHTTPPost(payload)
}
