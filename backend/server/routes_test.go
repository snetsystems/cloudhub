package server

import (
	"encoding/json"
	"io/ioutil"
	"net/http/httptest"
	"testing"

	"github.com/snetsystems/cloudhub/backend/log"
	"github.com/stretchr/testify/require"
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
	require.Equal(t, "/cloudhub/v1/sources", routes.Sources)
	require.Equal(t, "/cloudhub/v1/organizations/default/users", routes.Users)
	require.Equal(t, "/cloudhub/v1/dashboards", routes.Dashboards)
	require.Empty(t, routes.Auth)
	require.Nil(t, routes.Logout)

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
	require.Equal(t, []AuthRoute{{
		Name:     "github",
		Label:    "GitHub",
		Login:    "/oauth/github/login",
		Logout:   "/oauth/github/logout",
		Callback: "/oauth/github/callback",
	}}, routes.Auth)
	require.NotNil(t, routes.Logout)
	require.Equal(t, "/oauth/logout", *routes.Logout)
}

func TestAllRoutesWithExternalLinks(t *testing.T) {
	statusFeedURL := "http://pineapple.life/feed.json"

	customLinks, err := NewCustomLinks(map[string]string{
		"cubeapple": "https://cube.apple",
	})
	require.NoError(t, err)

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
	require.NotNil(t, routes.ExternalLinks.StatusFeed)
	require.Equal(t, statusFeedURL, *routes.ExternalLinks.StatusFeed)
	require.Equal(t, customLinks, routes.ExternalLinks.CustomLinks)
}
