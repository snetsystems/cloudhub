package server

import (
	"encoding/json"
	"io/ioutil"
	"net/http/httptest"
	"testing"

	"github.com/snetsystems/cmp/backend/log"
)

func TestAllRoutes(t *testing.T) {
	logger := log.New(log.DebugLevel)
	handler := &AllRoutes{
		Logger: logger,
	}
	req := httptest.NewRequest("GET", "http://docbrowns-inventions.com", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	resp := w.Result()
	body, err := ioutil.ReadAll(resp.Body)
	defer resp.Body.Close()

	if err != nil {
		t.Error("TestAllRoutes not able to retrieve body")
	}
	var routes getRoutesResponse
	if err := json.Unmarshal(body, &routes); err != nil {
		t.Error("TestAllRoutes not able to unmarshal JSON response")
	}
	want := `{"protoboards":"/cmp/v1/protoboards", "dashboardsv2":"/cmp/v2/dashboards","orgConfig":{"self":"/cmp/v1/org_config","logViewer":"/cmp/v1/org_config/logviewer"},"cells":"/cmp/v2/cells","layouts":"/cmp/v1/layouts","users":"/cmp/v1/organizations/default/users","allUsers":"/cmp/v1/users","organizations":"/cmp/v1/organizations","mappings":"/cmp/v1/mappings","sources":"/cmp/v1/sources","me":"/cmp/v1/me","environment":"/cmp/v1/env","dashboards":"/cmp/v1/dashboards","config":{"self":"/cmp/v1/config","auth":"/cmp/v1/config/auth"},"auth":[],"external":{"statusFeed":""},"flux":{"ast":"/cmp/v1/flux/ast","self":"/cmp/v1/flux","suggestions":"/cmp/v1/flux/suggestions"}}
`

	eq, err := jsonEqual(want, string(body))
	if err != nil {
		t.Fatalf("error decoding json: %v", err)
	}
	if !eq {
		t.Errorf("TestAllRoutes\nwanted\n*%s*\ngot\n*%s*", want, string(body))
	}

}

func TestAllRoutesWithAuth(t *testing.T) {
	logger := log.New(log.DebugLevel)
	handler := &AllRoutes{
		AuthRoutes: []AuthRoute{
			{
				Name:     "github",
				Label:    "GitHub",
				Login:    "/oauth/github/login",
				Logout:   "/oauth/github/logout",
				Callback: "/oauth/github/callback",
			},
		},
		LogoutLink: "/oauth/logout",
		Logger:     logger,
	}
	req := httptest.NewRequest("GET", "http://docbrowns-inventions.com", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	resp := w.Result()
	body, err := ioutil.ReadAll(resp.Body)
	defer resp.Body.Close()

	if err != nil {
		t.Error("TestAllRoutesWithAuth not able to retrieve body")
	}
	var routes getRoutesResponse
	if err := json.Unmarshal(body, &routes); err != nil {
		t.Error("TestAllRoutesWithAuth not able to unmarshal JSON response")
	}
	want := `{"protoboards":"/cmp/v1/protoboards","dashboardsv2":"/cmp/v2/dashboards","orgConfig":{"self":"/cmp/v1/org_config","logViewer":"/cmp/v1/org_config/logviewer"},"cells":"/cmp/v2/cells","layouts":"/cmp/v1/layouts","users":"/cmp/v1/organizations/default/users","allUsers":"/cmp/v1/users","organizations":"/cmp/v1/organizations","mappings":"/cmp/v1/mappings","sources":"/cmp/v1/sources","me":"/cmp/v1/me","environment":"/cmp/v1/env","dashboards":"/cmp/v1/dashboards","config":{"self":"/cmp/v1/config","auth":"/cmp/v1/config/auth"},"auth":[{"name":"github","label":"GitHub","login":"/oauth/github/login","logout":"/oauth/github/logout","callback":"/oauth/github/callback"}],"logout":"/oauth/logout","external":{"statusFeed":""},"flux":{"ast":"/cmp/v1/flux/ast","self":"/cmp/v1/flux","suggestions":"/cmp/v1/flux/suggestions"}}
`
	eq, err := jsonEqual(want, string(body))
	if err != nil {
		t.Fatalf("error decoding json: %v", err)
	}
	if !eq {
		t.Errorf("TestAllRoutesWithAuth\nwanted\n*%s*\ngot\n*%s*", want, string(body))
	}
}

func TestAllRoutesWithExternalLinks(t *testing.T) {
	statusFeedURL := "http://pineapple.life/feed.json"
	customLinks := map[string]string{
		"cubeapple": "https://cube.apple",
	}
	logger := log.New(log.DebugLevel)
	handler := &AllRoutes{
		StatusFeed:  statusFeedURL,
		CustomLinks: customLinks,
		Logger:      logger,
	}
	req := httptest.NewRequest("GET", "http://docbrowns-inventions.com", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	resp := w.Result()
	body, err := ioutil.ReadAll(resp.Body)
	defer resp.Body.Close()

	if err != nil {
		t.Error("TestAllRoutesWithExternalLinks not able to retrieve body")
	}
	var routes getRoutesResponse
	if err := json.Unmarshal(body, &routes); err != nil {
		t.Error("TestAllRoutesWithExternalLinks not able to unmarshal JSON response")
	}
	want := `{"protoboards":"/cmp/v1/protoboards","dashboardsv2":"/cmp/v2/dashboards","orgConfig":{"self":"/cmp/v1/org_config","logViewer":"/cmp/v1/org_config/logviewer"},"cells":"/cmp/v2/cells","layouts":"/cmp/v1/layouts","users":"/cmp/v1/organizations/default/users","allUsers":"/cmp/v1/users","organizations":"/cmp/v1/organizations","mappings":"/cmp/v1/mappings","sources":"/cmp/v1/sources","me":"/cmp/v1/me","environment":"/cmp/v1/env","dashboards":"/cmp/v1/dashboards","config":{"self":"/cmp/v1/config","auth":"/cmp/v1/config/auth"},"auth":[],"external":{"statusFeed":"http://pineapple.life/feed.json","custom":[{"name":"cubeapple","url":"https://cube.apple"}]},"flux":{"ast":"/cmp/v1/flux/ast","self":"/cmp/v1/flux","suggestions":"/cmp/v1/flux/suggestions"}}
`
	eq, err := jsonEqual(want, string(body))
	if err != nil {
		t.Fatalf("error decoding json: %v", err)
	}
	if !eq {
		t.Errorf("TestAllRoutesWithExternalLinks\nwanted\n*%s*\ngot\n*%s*", want, string(body))
	}
}
