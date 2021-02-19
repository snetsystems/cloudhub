package server

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"math/rand"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/influx"
	"github.com/snetsystems/cloudhub/backend/oauth2"
)

type emailKey string

var (
	// EmailKey is used to kapacitor
	// via context.Context to request-scoped
	// functions.
	EmailKey = emailKey("email")

	// BasicProvider is the name of the basic provider
	BasicProvider = "cloudhub"
	// BasicScheme is the name of the basic scheme
	BasicScheme = "basic"
)

type statusRecorder struct {
	http.ResponseWriter
	Status int
	buf *bytes.Buffer
}

type loginResponse struct {
	PasswordResetFlag   string `json:"passwordResetFlag"`
}

type loginRequest struct {
	Name       string   `json:"name"`
	Password   string   `json:"password"`
}

type resetResponse struct {
	Name       string          `json:"name"`
	Password   string          `json:"password,omitempty"`
	Provider   string          `json:"provider"`
	Scheme     string          `json:"scheme"`
	Pwrtn      string          `json:"pwrtn"`
	Email      string          `json:"email,omitempty"`
	SendKind   string          `json:"send_kind"`
	PasswordResetFlag  string  `json:"passwordResetFlag"`
}

type kapacitorResponse struct {
	Success   bool `json:"success"`
	Message   string `json:"message"`
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

// UserPwdAdminReset User password admin reset
func (s *Service) UserPwdAdminReset(w http.ResponseWriter, r *http.Request) {
	s.UserPwdReset(w, r)
}

// WriteHeader wrapping response status
func (rec *statusRecorder) WriteHeader(code int) {
	rec.Status = code
}

//Write wrapping response body
func (rec *statusRecorder) Write(data []byte) (int, error) {
	return rec.buf.Write(data)
}

// kapacitor response gzip decompress
func gunzipWrite(w io.Writer, data []byte) error {
	// Write gzipped data to the client
	gr, err := gzip.NewReader(bytes.NewBuffer(data))
	defer gr.Close()
	data, err = ioutil.ReadAll(gr)
	if err != nil {
		return err
	}
	w.Write(data)
	return nil
}

// UserPwdReset User password reset
func (s *Service) UserPwdReset(w http.ResponseWriter, r *http.Request) {
	ctx := serverContext(r.Context())

	params := r.URL.Query()
	path := params.Get("path")
	name := params.Get("name")
	pwrtn := params.Get("pwrtn")

	if path == "" {
		invalidData(w, fmt.Errorf("path required on password reset"), s.Logger)
		return 
	}
	if name == "" {
		invalidData(w, fmt.Errorf("name required on password reset"), s.Logger)
		return 
	}
	if pwrtn == "" {
		invalidData(w, fmt.Errorf("pwrtn required on password reset"), s.Logger)
		return 
	}

	pwrtnBool, err := strconv.ParseBool(pwrtn)
	if err != nil {
		Error(w, http.StatusBadRequest, fmt.Sprintf("invalid pwrtn : %s", err.Error()), s.Logger)
		return
	}

	user, err := s.Store.Users(ctx).Get(ctx, cloudhub.UserQuery{
		Name:     &name,
		Provider: &BasicProvider,
		Scheme:   &BasicScheme,
	})

	if user == nil || err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	// The id of kapacitor set as server option is 0
	id := 0
	serverKapacitor, err := s.Store.Servers(ctx).Get(ctx, id)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	// not setting kapacitor server option and not setting external program and pwrtn == true (admin call)
	if (serverKapacitor.URL == "" && s.ExternalExec == "") && pwrtnBool {
		resetPassword := randResetPassword()

		user.PasswordResetFlag = "Y"
		user.Passwd = getPasswordToSHA512(resetPassword, BasicProvider)
		err = s.Store.Users(ctx).Update(ctx, user)
		if err != nil {
			Error(w, http.StatusBadRequest, err.Error(), s.Logger)
			return
		}

		res := &resetResponse{
			Name:     name,
			Provider: BasicProvider,
			Scheme:   BasicScheme,
			Pwrtn:    pwrtn,
			SendKind: "",
			PasswordResetFlag: user.PasswordResetFlag,
			Password: resetPassword,
		}

		encodeJSON(w, http.StatusOK, res, s.Logger)
		return
	}
	
	// setting external program server option (user call)
	if s.ExternalExec != "" {
		resetPassword := randResetPassword()
		sendKind := "external"
		
		// external program, arguments
		var args []string
		if s.ExternalExecArgs != "" {
			args = []string{s.ExternalExecArgs, name, resetPassword}
		} else {
			args = []string{name, resetPassword}
		}
		
		if !programExec(s.ExternalExec, args, s.Logger) {
			sendKind = "error"
			if !pwrtnBool {
				Error(w, http.StatusBadRequest, fmt.Sprintf("fail external program : %s, %s, %s", s.ExternalExec, s.ExternalExecArgs, args), s.Logger)
				return
			}
		}

		user.PasswordResetFlag = "Y"
		user.Passwd = getPasswordToSHA512(resetPassword, BasicProvider)
		err = s.Store.Users(ctx).Update(ctx, user)
		if err != nil {
			Error(w, http.StatusBadRequest, err.Error(), s.Logger)
			return
		}

		res := &resetResponse{
			Name:     name,
			Provider: BasicProvider,
			Scheme:   BasicScheme,
			Pwrtn:    pwrtn,
			SendKind: sendKind,
			PasswordResetFlag: user.PasswordResetFlag,
		}

		if pwrtnBool {			
			res.Password = resetPassword
		}

		encodeJSON(w, http.StatusOK, res, s.Logger)
		return
	} 
	

	// setting kapacitor server option
	if serverKapacitor.URL != "" {
		resetPassword := randResetPassword()
		sendKind := "email"

		if user.Email != "" {
			// Forward kapacitor id and email to proxy
			params.Add("kid", "0")
			params.Add("email", user.Email)
			r.URL.RawQuery = params.Encode()

			mailSubjct := strings.Replace(s.MailSubject, "$user_id", user.Name, -1)
			mailBody := strings.Replace(s.MailBody, "$user_id", user.Name, -1)
			mailBody = strings.Replace(mailBody, "$user_pw", resetPassword, -1)

			jsonBody, _ := json.Marshal(struct{
				To []string     `json:"to"`
				Subject string  `json:"subject"`
				Body string     `json:"body"`
			}{
				To: []string{user.Email},
				Subject: mailSubjct,
				Body: mailBody,
			})

			// Clone GET -> POST
			kapacitorReq := r.Clone(ctx)
			*kapacitorReq = *r
			kapacitorReq.Method = "POST"
			kapacitorReq.Body = ioutil.NopCloser(strings.NewReader(string(jsonBody)))
			kapacitorReq.ContentLength = int64(len(string(jsonBody)))

			recorder := &statusRecorder{
				ResponseWriter: w,
				Status:         400,
				buf:            &bytes.Buffer{},
			}

			s.KapacitorProxyPost(recorder, kapacitorReq)
			

			if recorder.Status != 200 {
				sendKind = "error"
				if !pwrtnBool {
					w.Header().Del("Content-Length")
					w.Header().Del("Content-Encoding")
					// kapacitor return error code relay
					Error(w, http.StatusUnprocessableEntity, fmt.Sprintf("kapacitor response status : %d", recorder.Status), s.Logger)
					return
				}
			} else {
				var resBody bytes.Buffer
				err := gunzipWrite(&resBody, recorder.buf.Bytes())
				if err != nil {
					sendKind = "error"
					if !pwrtnBool {
						Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
						return
					}
				} else {
					var kaResponse kapacitorResponse
					if err := json.Unmarshal(resBody.Bytes(), &kaResponse); err != nil {
						sendKind = "error"
						if !pwrtnBool {
							Error(w, http.StatusUnprocessableEntity, fmt.Sprintf("fail kapacitor response json.Unmarshal : %s", err.Error()), s.Logger)
							return
						}
					} else {
						if !kaResponse.Success {
							sendKind = "error"
							if !pwrtnBool {
								Error(w, http.StatusBadRequest, fmt.Sprintf("fail kapacitor send mail"), s.Logger)
								return
							}
						}
					}
				}
			}
		} else {
			sendKind = "error"
		}

		user.PasswordResetFlag = "Y"
		user.Passwd = getPasswordToSHA512(resetPassword, BasicProvider)
		err = s.Store.Users(ctx).Update(ctx, user)
		if err != nil {
			Error(w, http.StatusBadRequest, err.Error(), s.Logger)
			return
		}

		res := &resetResponse{
			Name:     name,
			Provider: BasicProvider,
			Scheme:   BasicScheme,
			Pwrtn:    pwrtn,
			SendKind: sendKind,
			PasswordResetFlag: user.PasswordResetFlag,
		}
		
		if user.Email != "" {
			res.Email = user.Email 
		}
 
		if pwrtnBool {			
			res.Password = resetPassword
		}

		w.Header().Del("Content-Length")
		w.Header().Del("Content-Encoding")

		encodeJSON(w, http.StatusOK, res, s.Logger)
		return
	}

	Error(w, http.StatusBadRequest, fmt.Sprintf("fail password reset"), s.Logger)
	return
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
		
		user, err := s.Store.Users(ctx).Get(ctx, cloudhub.UserQuery{
			Name:     &req.Name,
			Provider: &BasicProvider,
			Scheme:   &BasicScheme,
		})

		if user == nil || err != nil {
			Error(w, http.StatusBadRequest, err.Error(), s.Logger)
			return
		}

		orgID := "default"
		for _, role := range user.Roles {
			orgID = role.Organization
			break
		}

		if user.Passwd == "" {
			LogRegistration(r, s.Store, s.Logger, orgID, "login", user.Name, "Login Fail - empty user table password", user.SuperAdmin)
			Error(w, http.StatusBadRequest, fmt.Sprintf("empty user table password"), s.Logger)
			return
		}

		strTohex, err := hex.DecodeString(user.Passwd)
		if err != nil {
			Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
			return
		}

		// valid password - sha512
		if !validPassword([]byte(req.Password), strTohex, []byte(BasicProvider)) {
			LogRegistration(r, s.Store, s.Logger, orgID, "login", user.Name, "Login Fail - requested password and the saved password are different.", user.SuperAdmin)
			Error(w, http.StatusUnauthorized, fmt.Sprintf("requested password and the saved password are different."), s.Logger)
			return
		}

		principal := oauth2.Principal{
			Subject:      user.Name,
			Issuer:       BasicProvider,
			Organization: orgID,
			Group: "",
		}
		
		if user.PasswordResetFlag == "N" {
			if err := auth.Authorize(ctx, w, principal); err != nil {
				Error(w, http.StatusInternalServerError, fmt.Sprintf("Failed auth.Authorize: %v, %v", err, principal), s.Logger)
				return
			}
			s.Logger.Info("User ", req.Name, " is authenticated")
			ctx = context.WithValue(ctx, oauth2.PrincipalKey, principal)
			r = r.WithContext(ctx)
		}

		// log registration
		LogRegistration(r, s.Store, s.Logger, orgID, "login", user.Name, "Login Success", user.SuperAdmin)

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
		ctx := serverContext(r.Context())
		principal, err := auth.Validate(ctx, r)
		if err == nil {
			user, err := s.Store.Users(ctx).Get(ctx, cloudhub.UserQuery{
				Name:     &principal.Subject,
				Provider: &BasicProvider,
				Scheme:   &BasicScheme,
			})

			if user == nil || err != nil {
				s.Logger.Error(err.Error())
			} else {
				var orgID string
				for _, role := range user.Roles {
					orgID = role.Organization
					break
				}

				LogRegistration(r, s.Store, s.Logger, orgID, "logout", user.Name, "Logout Success", user.SuperAdmin)
			}
		}

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

func randResetPassword() string {
	chars := []rune("ABCDEFGHJKMNOPQRSTUVWXYZabcdefghjkmnopqrstuvwxyz0123456789")
	length := 8

	rand.Seed(time.Now().UnixNano())
	
	var b strings.Builder
	for i := 0; i < length; i++ {
		b.WriteRune(chars[rand.Intn(len(chars))])
	}

	return b.String()
}

// LogRegistration log db insert
// isSuperAdmin is not used currently inside the function. This is for the future.
func LogRegistration(r *http.Request, store DataStore, logger cloudhub.Logger, orgID, action, name, message string, isSuperAdmin bool) {
	ctx := r.Context()
	
	logs := logger.
		WithField("component", "log_insert").
		WithField("remote_addr", r.RemoteAddr).
		WithField("method", r.Method).
		WithField("url", r.URL)

	serverCtx := serverContext(ctx)

	// // The id of influxdb set as server option is 0
	id := 0
	src, err := store.Sources(serverCtx).Get(serverCtx, id)
	if err != nil {
		return
	}

	u, err := url.Parse(src.URL)
	if err != nil {
		msg := fmt.Sprintf("Error parsing source url: %v", err)
		logs.Error(msg)
		return
	}

	var rp, dbname string
	dbname = "_internal"
	rp = "monitor"

	// UTC time
	nanos := time.Now().UnixNano()
	data := cloudhub.Point{
		Database:        dbname,
		RetentionPolicy: rp,
		Measurement:     "activity_logging",
		Time:            nanos,
		Tags: map[string]string{
			"severity": "info",
			"action": action,
			"user": name,
			"db": "",
		},
		Fields: map[string]interface{}{
			"timestamp": nanos,
			"message": message,
		},
	}

	client := &influx.Client{
		URL:                u,
		Authorizer:         influx.DefaultAuthorization(&src),
		InsecureSkipVerify: src.InsecureSkipVerify,
		Logger:             logger,
	}

	if err := client.Write(ctx, []cloudhub.Point{data}); err != nil {
		logs.Error("Error influxdb log insert. ", err)
		return
	}
}