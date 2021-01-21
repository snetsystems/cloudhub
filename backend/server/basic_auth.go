package server

import (
	"bytes"
	"strconv"
	"context"
	"net/http"
	"crypto/sha512"
	"crypto/hmac"
	"encoding/hex"
	"encoding/json"
	"path"
	"fmt"
	"math/rand"
	"strings"
	"time"
	"io/ioutil"

	cloudhub "github.com/snetsystems/cloudhub/backend"
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
	Name       string   `json:"id"`
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
	Success   string `json:"success"`
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

// WriteHeader response status
func (rec *statusRecorder) WriteHeader(code int) {
	rec.Status = code
}

//Write response body
func (rec *statusRecorder) Write(data []byte) (int, error) {
	return rec.buf.Write(data)
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
	// not set kapacitor server option or user.email empty
	if err != nil || user.Email == "" {
		if err != cloudhub.ErrServerNotFound {
			Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
			return
		}
		
		resetPassword := randResetPassword()
		
		params.Set("path", "") // salt에 path는 무엇이 들어가야 하나...
		params.Add("password", resetPassword)  // salt에 pass를 어떻게 전달해야........
		r.URL.RawQuery = params.Encode()

		// salt exec
		s.SaltProxyPost(w, r)

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
			Email:    user.Email,
			SendKind: "salt",
			PasswordResetFlag: user.PasswordResetFlag,
		}
		encodeJSON(w, http.StatusOK, res, s.Logger)
		return
	} 

	// set kapacitor server option 
	if serverKapacitor.URL != "" && user.Email != "" {
		// Forward kapacitor id and email to proxy
		params.Add("kid", "0")
		params.Add("email", user.Email)
		r.URL.RawQuery = params.Encode()

		//s.Logger.Debug(r.URL.RawQuery)

		resetPassword := randResetPassword()

		mailSubjct := strings.Replace(s.MailSubject, "$user_id", user.Name, -1)
		mailBody := strings.Replace(s.MailBody, "$user_id", user.Name, -1)
		mailBody = strings.Replace(mailBody, "$user_pw", resetPassword, -1)

		//var jsonBody = []byte(`{"to":}`)
		//var jsonBody = []byte("{\"to\":[\"" + user.Email + "\"],\"password\":\"" + password + "\"}")
		
		//var jsonBody = `{"to":["`+ user.Email +`"],"subject":"`+ mailSubjct +`","body":"`+ mailBody +`"}`
		//s.Logger.Debug("before="+jsonBody)

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

		//s.Logger.Debug("before="+string(jsonBody))

		kapacitorReq.Body = ioutil.NopCloser(strings.NewReader(string(jsonBody)))
		kapacitorReq.ContentLength = int64(len(string(jsonBody)))

		// len := r.ContentLength
		// body := make([]byte, len)
		// r.Body.Read(body)
		// s.Logger.Debug("after="+string(body))
		
		// json.NewEncoder(r).Encode(httprouter.Params{
		// 	{
		// 		Key:   "to",
		// 		Value: user.Email,
		// 	},
		// 	{
		// 		Key:   "subject",
		// 		Value: mailSubjct,
		// 	},
		// 	{
		// 		Key:   "body",
		// 		Value: mailBody,
		// 	},
		// })

		// r = r.WithContext(httprouter.WithParams(
		// 	ctx,
		// 	httprouter.Params{
		// 		{
		// 			Key:   "to",
		// 			Value: user.Email,
		// 		},
		// 		{
		// 			Key:   "subject",
		// 			Value: mailSubjct,
		// 		},
		// 		{
		// 			Key:   "body",
		// 			Value: mailBody,
		// 		},
		// 	}))

		//rec := statusRecorder{w, 200, nil}

		//var kaResponseWriter http.ResponseWriter
		//kaResponseWriter = w

		recorder := &statusRecorder{
			ResponseWriter: w,
			Status:         400,
			buf:            &bytes.Buffer{},
		}

		s.KapacitorProxyPost(recorder, kapacitorReq)

		if recorder.Status != 200 {
			w.Header().Del("Content-Length")
			w.Header().Del("Content-Encoding")
			// kapacitor rturn error code relay
			Error(w, http.StatusUnprocessableEntity, fmt.Sprintf("kapacitor response status : %d", recorder.Status), s.Logger)
			return
		}



		//var kaResponse kapacitorResponse
		//json.NewDecoder(bufrw.Reader).Decode(&kaResponse)


		// if err := json.NewDecoder(bufrw.Reader).Decode(&kaResponse); err != nil {
		// 	Error(w, http.StatusUnprocessableEntity, fmt.Sprintf("fail kapacitor response json.Unmarshal : %s", err.Error()), s.Logger)
		// 	return
		// }



		



		// s.Logger.Debug(recorder.Buffer.String())
	
		// var kaResponse kapacitorResponse
		// json.Unmarshal(recorder.Buffer.Bytes(), &kaResponse)

		// s.Logger.Debug(kaResponse)

		// newRes := bytes.NewReader(recorder.Buffer.Bytes())
		// json.NewDecoder(newRes).Decode(&kaResponse)

		// s.Logger.Debug(kaResponse)
		
		
		
		

		//kaResponse := kapacitorResponse{}
	/*	var kaResponse kapacitorResponse
		newRes := bytes.NewReader(rec.body)
		if err := json.NewDecoder(newRes).Decode(&kaResponse); err != nil {
			Error(w, http.StatusUnprocessableEntity, fmt.Sprintf("fail kapacitor response json.Unmarshal : %s", err.Error()), s.Logger)
			return
		}


		// if err := json.Unmarshal(rec.body, &kaResponse); err != nil {
		// 	Error(w, http.StatusUnprocessableEntity, fmt.Sprintf("fail kapacitor response json.Unmarshal : %s", err.Error()), s.Logger)
		// 	return
		// }
		
		kaSuccess, err := strconv.ParseBool(kaResponse.Success);
		if err != nil {
			Error(w, http.StatusBadRequest, fmt.Sprintf("fail kaResponse.Success : %t, %s", kaSuccess, err.Error()), s.Logger)
			return
		}

		if !kaSuccess {
			Error(w, http.StatusBadRequest, fmt.Sprintf("fail kapacitor send mail"), s.Logger)
			return
		}
*/


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
			Email:    user.Email,
			SendKind: "email",
			PasswordResetFlag: user.PasswordResetFlag,
		}

		if pwrtnBool {			
			res.Password = resetPassword
		}

		/*
		data, _ := json.Marshal(res)
		recorder.buf.Write(data)

		//w.Header().Del("Content-Length")
		w.Header().Set("Content-Length", strconv.Itoa(len(string(data))))

		if _, err := io.Copy(w, recorder.buf); err != nil {
			Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
			return
		}
		

		*/

		//data, _ := json.Marshal(res)
		//newRes := bytes.NewReader(data)
		//recorder.buf.Write(data)

		//rsp := io.MultiWriter(w, recorder.buf)

		//w.Header().Set("Content-Length", strconv.Itoa(len(string(data))))
		//w.Header().Set("Content-Type", "application/json")
		w.Header().Del("Content-Length")
		//w.Header().Del("Date")
		w.Header().Del("Content-Encoding")
		//w.Header().Del("Request-Id")
		//w.Header().Del("X-Kapacitor-Version")

		//w.WriteHeader(http.StatusOK)
		//w.Write(data)

		



		// if _, err := io.Copy(w, newRes); err != nil {
		// 	Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		// 	return
		// }

		//w.Header().Del("Content-Length")
		
		

		// if err := json.NewEncoder(w).Encode(res); err != nil {
		// 	unknownErrorWithMessage(w, err, s.Logger)
		// }

		encodeJSON(w, http.StatusOK, res, s.Logger)
		return
	}
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

		// provider := "cloudhub"
		// scheme := "basic"

		user, err := s.Store.Users(ctx).Get(ctx, cloudhub.UserQuery{
			Name:     &req.Name,
			Provider: &BasicProvider,
			Scheme:   &BasicScheme,
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
		if !validPassword([]byte(req.Password), strTohex, []byte(BasicProvider)) {
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
			Issuer:       BasicProvider,	// cloudhub
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
		r = r.WithContext(ctx)

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

func randResetPassword() string {
	chars := []rune("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789")
	length := 8

	rand.Seed(time.Now().UnixNano())
	
	var b strings.Builder
	for i := 0; i < length; i++ {
		b.WriteRune(chars[rand.Intn(len(chars))])
	}

	return b.String()
}