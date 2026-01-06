package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
)

func TestEnsureCollectorAuth(t *testing.T) {
	const validToken = "8a5a0c7fb2fc69e924973b1ce55f86d0adb44a7ab93fe0ab5763e654c7ccf690"
	
	setupService := func(token string) (*Service, *httprouter.Router) {
		s := &Service{
			InternalENV: cloudhub.InternalEnvironment{
				KubernetesConfig: cloudhub.KubernetesConfig{
					CollectorAuthToken: token,
				},
				Platform: &mocks.MockPlatform{
					GenerateShardConfigFunc: func(ctx context.Context, shardID int) (string, error) {
						return "mock-config", nil
					},
					PushConfigUpdatesFunc: func(ctx context.Context, shardIDs []int) {},
				},
			},
		}

		router := httprouter.New()
		
		// Setup the middleware wrapper like in NewMux
		EnsureCollectorAuth := func(next http.HandlerFunc) http.HandlerFunc {
			return func(w http.ResponseWriter, r *http.Request) {
				authToken := s.InternalENV.KubernetesConfig.CollectorAuthToken
				if authToken == "" {
					next(w, r)
					return
				}

				token := r.Header.Get("X-CloudHub-Token")
				if token != authToken {
					http.Error(w, "Unauthorized: Invalid Collector Token", http.StatusUnauthorized)
					return
				}
				next(w, r)
			}
		}

		router.GET("/api/v1/collectors/config/:shardID", EnsureCollectorAuth(s.GetCollectorConfig))
		return s, router
	}

	t.Run("Valid Token Access", func(t *testing.T) {
		_, router := setupService(validToken)
		
		req := httptest.NewRequest("GET", "/api/v1/collectors/config/0", nil)
		req.Header.Set("X-CloudHub-Token", validToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected 200 OK, got %d", w.Code)
		}
	})

	t.Run("Invalid Token Access", func(t *testing.T) {
		_, router := setupService(validToken)
		
		req := httptest.NewRequest("GET", "/api/v1/collectors/config/0", nil)
		req.Header.Set("X-CloudHub-Token", "wrong-token")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized, got %d", w.Code)
		}
	})

	t.Run("Missing Token Access", func(t *testing.T) {
		_, router := setupService(validToken)
		
		req := httptest.NewRequest("GET", "/api/v1/collectors/config/0", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized, got %d", w.Code)
		}
	})

	t.Run("Auth Disabled (Empty Config Token)", func(t *testing.T) {
		_, router := setupService("") // Empty token in config
		
		req := httptest.NewRequest("GET", "/api/v1/collectors/config/0", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Should succeed because auth is "optional/disabled" when config is empty
		if w.Code != http.StatusOK {
			t.Errorf("expected 200 OK when auth is disabled, got %d", w.Code)
		}
	})
}
