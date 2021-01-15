package server

import (
	"context"
	"net/http"
	"crypto/sha512"
	"crypto/hmac"
	"encoding/hex"
	"encoding/json"
	"path"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/oauth2"
)

type loginResponse struct {
	PasswordResetFlag   string `json:"passwordResetFlag"`
}

type loginRequest struct {
	Name       string   `json:"id"`
	Password   string   `json:"password"`
}

func (r *loginRequest) ValidCreate() error {
	if r.Name == "" {
		return fmt.Errorf("Name required on CloudHub User request body")
	}
	if r.Password == "" {
		return fmt.Errorf("Password required on CloudHub User request body")
	}

	return nil
}

// Login provider=cloudhub
func (s *Service) Login(auth oauth2.Authenticator, basePath string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := serverContext(r.Context())

		var req loginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			invalidJSON(w, s.Logger)
			return
		}

		if err := req.ValidCreate(); err != nil {
			invalidData(w, err, s.Logger)
			return
		}
		
		// params := r.URL.Query()
		// id := params.Get("id")
		// password := params.Get("password")

		provider := "cloudhub"
		scheme := "basic"

		user, err := s.Store.Users(ctx).Get(ctx, cloudhub.UserQuery{
			Name:     &req.Name,
			Provider: &provider,
			Scheme:   &scheme,
		})

		if user == nil || err != nil {
			Error(w, http.StatusBadRequest, err.Error(), s.Logger)
			return
		}

		if user.Passwd == "" {
			Error(w, http.StatusBadRequest, fmt.Sprintf("empty user table password"), s.Logger)
			return
		}

		strTohex, err := hex.DecodeString(user.Passwd)
		if err != nil {
			Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
			return
		}

		// valid password - sha512
		if !validPassword([]byte(req.Password), strTohex, []byte(provider)) {
			Error(w, http.StatusUnauthorized, fmt.Sprintf("The requested password and the saved password are different."), s.Logger)
			//http.Redirect(w, r, path.Join(basePath, "/login"), http.StatusUnauthorized)
			return
		}

		orgID := "default"
		for _, role := range user.Roles {
			orgID = role.Organization
			break
		}

		principal := oauth2.Principal{
			Subject:      user.Name,
			Issuer:       provider,	// cloudhub
			Organization: orgID,
			Group: "",
		}

		// password reset response 
		// if user.PasswordResetFlag == "Y" {
		// 	res := &loginResponse{
		// 		PasswordResetFlag: user.PasswordResetFlag,
		// 	}
		// 	encodeJSON(w, http.StatusOK, res, s.Logger)
		// 	return
		// }

		if err := auth.Authorize(ctx, w, principal); err != nil {
			s.Logger.Error(fmt.Sprintf("Failed auth.Authorize: %v, %v", err, principal))
			// FailureURL
			//http.Redirect(w, r, path.Join(basePath, "/login"), http.StatusInternalServerError)
			Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
			return
		}
		
		s.Logger.Info("User ", req.Name, " is authenticated")
		ctx = context.WithValue(ctx, oauth2.PrincipalKey, principal)
		r.WithContext(ctx)

		// SuccessURL
		//http.Redirect(w, r.WithContext(ctx), path.Join(basePath, "/"), http.StatusTemporaryRedirect)
		res := &loginResponse{
			PasswordResetFlag: user.PasswordResetFlag,
		}
		encodeJSON(w, http.StatusOK, res, s.Logger)
		return
	}
}

// Logout provider=cloudhub
func (s *Service) Logout(auth oauth2.Authenticator, basePath string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth.Expire(w)
		http.Redirect(w, r, path.Join(basePath, "/"), http.StatusTemporaryRedirect)
	}
}

func validPassword(reqPassword, hashPassword, key []byte) bool {
	mac := hmac.New(sha512.New, key)
	mac.Write(reqPassword)
	expectedPassword := mac.Sum(nil)
	return hmac.Equal(hashPassword, expectedPassword)
}
