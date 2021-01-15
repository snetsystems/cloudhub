package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"time"
	"crypto/sha512"
	"crypto/hmac"
	"encoding/hex"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/roles"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

type userRequest struct {
	ID                    uint64          `json:"id,string"`
	Name                  string          `json:"name"`
	Provider              string          `json:"provider"`
	Scheme                string          `json:"scheme"`
	SuperAdmin            bool            `json:"superAdmin"`
	Roles                 []cloudhub.Role `json:"roles"`
	Password              string          `json:"password,omitempty"`
	Email                 string          `json:"email,omitempty"`
}

type userPwdResetRequest struct {
	Name                  string          `json:"name"`
	Password              string          `json:"password"`
}

func (r *userRequest) ValidCreate() error {
	if r.Name == "" {
		return fmt.Errorf("Name required on CloudHub User request body")
	}
	if r.Provider == "" {
		return fmt.Errorf("Provider required on CloudHub User request body")
	}
	if r.Scheme == "" {
		return fmt.Errorf("Scheme required on CloudHub User request body")
	}

	if r.Scheme != "basic" {
		r.Scheme = "oauth2"
	}
	return r.ValidRoles()
}

func (r *userPwdResetRequest) ValidCreate() error {
	if r.Name == "" {
		return fmt.Errorf("Name required on CloudHub User request body")
	}
	if r.Password == "" {
		return fmt.Errorf("Password required on CloudHub User request body")
	}

	return nil
}

func (r *userRequest) ValidUpdate() error {
	// if r.Roles == nil {
	// 	return fmt.Errorf("No Roles to update")
	// }
	// return r.ValidRoles()

	if r.Roles != nil {
		return r.ValidRoles()
	}
	return nil
	
}

func (r *userRequest) ValidRoles() error {
	if len(r.Roles) > 0 {
		orgs := map[string]bool{}
		for _, r := range r.Roles {
			if r.Organization == "" {
				return fmt.Errorf("no organization was provided")
			}
			if _, ok := orgs[r.Organization]; ok {
				return fmt.Errorf("duplicate organization %q in roles", r.Organization)
			}
			orgs[r.Organization] = true
			switch r.Name {
			case roles.MemberRoleName, roles.ViewerRoleName, roles.EditorRoleName, roles.AdminRoleName, roles.WildcardRoleName:
				continue
			default:
				return fmt.Errorf("Unknown role %s. Valid roles are 'member', 'viewer', 'editor', 'admin', and '*'", r.Name)
			}
		}
	}
	return nil
}

type userResponse struct {
	Links      selfLinks       `json:"links"`
	ID         uint64          `json:"id,string"`
	Name       string          `json:"name"`
	Provider   string          `json:"provider"`
	Scheme     string          `json:"scheme"`
	SuperAdmin bool            `json:"superAdmin"`
	Roles      []cloudhub.Role `json:"roles"`
	PasswordUpdateDate string `json:"passwordUpdateDate,omitempty"`
	PasswordResetFlag  string `json:"passwordResetFlag,omitempty"`
	Email              string `json:"email,omitempty"`
}

func newUserResponse(u *cloudhub.User, org string) *userResponse {
	// This ensures that any user response with no roles returns an empty array instead of
	// null when marshaled into JSON. That way, JavaScript doesn't need any guard on the
	// key existing and it can simply be iterated over.
	if u.Roles == nil {
		u.Roles = []cloudhub.Role{}
	}
	var selfLink string
	if org != "" {
		selfLink = fmt.Sprintf("/cloudhub/v1/organizations/%s/users/%d", org, u.ID)
	} else {
		selfLink = fmt.Sprintf("/cloudhub/v1/users/%d", u.ID)
	}
	return &userResponse{
		ID:         u.ID,
		Name:       u.Name,
		Provider:   u.Provider,
		Scheme:     u.Scheme,
		Roles:      u.Roles,
		SuperAdmin: u.SuperAdmin,
		Links: selfLinks{
			Self: selfLink,
		},
		PasswordUpdateDate: u.PasswordUpdateDate,
		PasswordResetFlag: u.PasswordResetFlag,
		Email: u.Email,
	}
}

type usersResponse struct {
	Links selfLinks       `json:"links"`
	Users []*userResponse `json:"users"`
}

func newUsersResponse(users []cloudhub.User, org string) *usersResponse {
	usersResp := make([]*userResponse, len(users))
	for i, user := range users {
		usersResp[i] = newUserResponse(&user, org)
	}
	sort.Slice(usersResp, func(i, j int) bool {
		return usersResp[i].ID < usersResp[j].ID
	})

	var selfLink string
	if org != "" {
		selfLink = fmt.Sprintf("/cloudhub/v1/organizations/%s/users", org)
	} else {
		selfLink = "/cloudhub/v1/users"
	}
	return &usersResponse{
		Users: usersResp,
		Links: selfLinks{
			Self: selfLink,
		},
	}
}

// UserID retrieves a CloudHub user with ID from store
func (s *Service) UserID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	idStr := httprouter.GetParamFromContext(ctx, "id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, fmt.Sprintf("invalid user id: %s", err.Error()), s.Logger)
		return
	}
	user, err := s.Store.Users(ctx).Get(ctx, cloudhub.UserQuery{ID: &id})
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	orgID := httprouter.GetParamFromContext(ctx, "oid")
	res := newUserResponse(user, orgID)
	location(w, res.Links.Self)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// NewUser adds a new CloudHub user to store
func (s *Service) NewUser(w http.ResponseWriter, r *http.Request) {
	var req userRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.ValidCreate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()

	serverCtx := serverContext(ctx)
	cfg, err := s.Store.Config(serverCtx).Get(serverCtx)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	if err := s.validRoles(serverCtx, req.Roles); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	user := &cloudhub.User{
		Name:     req.Name,
		Provider: req.Provider,
		Scheme:   req.Scheme,
		Roles:    req.Roles,
	}
	if cfg.Auth.SuperAdminNewUsers {
		req.SuperAdmin = true
	}

	if err := setSuperAdmin(ctx, req, user); err != nil {
		Error(w, http.StatusUnauthorized, err.Error(), s.Logger)
		return
	}

	res, err := s.Store.Users(ctx).Add(ctx, user)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	orgID := httprouter.GetParamFromContext(ctx, "oid")
	cu := newUserResponse(res, orgID)
	location(w, cu.Links.Self)
	encodeJSON(w, http.StatusCreated, cu, s.Logger)
}

// NewBasicUser adds a new CloudHub user to store
func (s *Service) NewBasicUser(w http.ResponseWriter, r *http.Request) {
	var req userRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.ValidCreate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()
	serverCtx := serverContext(ctx)

	if req.Roles == nil {
		invalidData(w, fmt.Errorf("No Roles"), s.Logger)
		return
	}

	if err := s.validRoles(serverCtx, req.Roles); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	usr, err := s.Store.Users(serverCtx).Get(serverCtx, cloudhub.UserQuery{
		Name:     &req.Name,
		Provider: &req.Provider,
		Scheme:   &req.Scheme,
	})
	if err != nil && err != cloudhub.ErrUserNotFound {
		unknownErrorWithMessage(w, err, s.Logger)
		return
	}

	// user exists
	if usr != nil {
		invalidData(w, fmt.Errorf("user existed"), s.Logger)
		return
	}

	secretKey := "cloudhub"
	hashPassword := ""
	pwdResetFlag := ""
	pwdUpdateDate := ""

	if req.Password != "" {
		hashPassword = getPasswordToSHA512(req.Password, secretKey)
		pwdResetFlag = "N"
		pwdUpdateDate = getNowDate()
	}

	user := &cloudhub.User{
		Name:     req.Name,
		Provider: req.Provider,
		Scheme:   req.Scheme,
		Roles:    req.Roles,
		Passwd:   hashPassword,
		PasswordResetFlag: pwdResetFlag,
		PasswordUpdateDate: pwdUpdateDate,
		Email:    req.Email,
		SuperAdmin: s.newUsersAreSuperAdmin(),
	}
	
	ctx = context.WithValue(ctx, organizations.ContextKey, req.Roles[0].Organization)

	res, err := s.Store.Users(serverCtx).Add(serverCtx, user)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	orgID := httprouter.GetParamFromContext(ctx, "oid")
	cu := newUserResponse(res, orgID)
	location(w, cu.Links.Self)
	encodeJSON(w, http.StatusCreated, cu, s.Logger)
}

// UserPwdReset User password reset
func (s *Service) UserPwdReset(w http.ResponseWriter, r *http.Request) {
	var req userPwdResetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.ValidCreate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := serverContext(r.Context())

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

	secretKey := "cloudhub"

	user.Passwd = getPasswordToSHA512(req.Password, secretKey)
	user.PasswordUpdateDate = getNowDate()
	user.PasswordResetFlag = "N"
	
	err = s.Store.Users(ctx).Update(ctx, user)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// RemoveUser deletes a CloudHub user from store
func (s *Service) RemoveUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	idStr := httprouter.GetParamFromContext(ctx, "id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, fmt.Sprintf("invalid user id: %s", err.Error()), s.Logger)
		return
	}

	u, err := s.Store.Users(ctx).Get(ctx, cloudhub.UserQuery{ID: &id})
	if err != nil {
		Error(w, http.StatusNotFound, err.Error(), s.Logger)
		return
	}
	if err := s.Store.Users(ctx).Delete(ctx, u); err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// UpdateUser updates a CloudHub user in store
func (s *Service) UpdateUser(w http.ResponseWriter, r *http.Request) {
	var req userRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	ctx := r.Context()
	idStr := httprouter.GetParamFromContext(ctx, "id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, fmt.Sprintf("invalid user id: %s", err.Error()), s.Logger)
		return
	}

	if err := req.ValidUpdate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	u, err := s.Store.Users(ctx).Get(ctx, cloudhub.UserQuery{ID: &id})
	if err != nil {
		Error(w, http.StatusNotFound, err.Error(), s.Logger)
		return
	}

	serverCtx := serverContext(ctx)
	if err := s.validRoles(serverCtx, req.Roles); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	// ValidUpdate should ensure that req.Roles is not nil
	if req.Roles != nil {
		u.Roles = req.Roles
	}

	// If the request contains a name, it must be the same as the
	// one on the user. This is particularly useful to the front-end
	// because they would like to provide the whole user object,
	// including the name, provider, and scheme in update requests.
	// But currently, it is not possible to change name, provider, or
	// scheme via the API.
	if req.Name != "" && req.Name != u.Name {
		err := fmt.Errorf("Cannot update Name")
		invalidData(w, err, s.Logger)
		return
	}
	if req.Provider != "" && req.Provider != u.Provider {
		err := fmt.Errorf("Cannot update Provider")
		invalidData(w, err, s.Logger)
		return
	}
	if req.Scheme != "" && req.Scheme != u.Scheme {
		err := fmt.Errorf("Cannot update Scheme")
		invalidData(w, err, s.Logger)
		return
	}

	// provider = cloudhub
	if req.Email != "" {
		u.Email = req.Email
	}
	if req.Password != "" {
		secretKey := "cloudhub"
		u.Passwd = getPasswordToSHA512(req.Password, secretKey)
	}

	// Don't allow SuperAdmins to modify their own SuperAdmin status.
	// Allowing them to do so could result in an application where there
	// are no super admins.
	ctxUser, ok := hasUserContext(ctx)
	if !ok {
		Error(w, http.StatusInternalServerError, "failed to retrieve user from context", s.Logger)
		return
	}
	// If the user being updated is the user making the request and they are
	// changing their SuperAdmin status, return an unauthorized error
	if ctxUser.ID == u.ID && u.SuperAdmin == true && req.SuperAdmin == false {
		Error(w, http.StatusUnauthorized, "user cannot modify their own SuperAdmin status", s.Logger)
		return
	}

	err = s.Store.Users(ctx).Update(ctx, u)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	orgID := httprouter.GetParamFromContext(ctx, "oid")
	cu := newUserResponse(u, orgID)
	location(w, cu.Links.Self)
	encodeJSON(w, http.StatusOK, cu, s.Logger)
}

// Users retrieves all CloudHub users from store
func (s *Service) Users(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	users, err := s.Store.Users(ctx).All(ctx)
	if err != nil {
		Error(w, http.StatusBadRequest, err.Error(), s.Logger)
		return
	}

	orgID := httprouter.GetParamFromContext(ctx, "oid")
	res := newUsersResponse(users, orgID)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

func setSuperAdmin(ctx context.Context, req userRequest, user *cloudhub.User) error {
	// At a high level, this function checks the following
	//   1. Is the user making the request a SuperAdmin.
	//      If they are, allow them to make whatever changes they please.
	//
	//   2. Is the user making the request trying to change the SuperAdmin
	//      status. If so, return an error.
	//
	//   3. If none of the above are the case, let the user make whichever
	//      changes were requested.

	// Only allow users to set SuperAdmin if they have the superadmin context
	if isSuperAdmin := hasSuperAdminContext(ctx); isSuperAdmin {
		user.SuperAdmin = req.SuperAdmin
	} else if !isSuperAdmin && (user.SuperAdmin != req.SuperAdmin) {
		// If req.SuperAdmin has been set, and the request was not made with the SuperAdmin
		// context, return error
		return fmt.Errorf("User does not have authorization required to set SuperAdmin status'.'")
	}

	return nil
}

func (s *Service) validRoles(ctx context.Context, rs []cloudhub.Role) error {
	for i, role := range rs {
		// verify that the organization exists
		org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &role.Organization})
		if err != nil {
			return err
		}
		if role.Name == roles.WildcardRoleName {
			role.Name = org.DefaultRole
			rs[i] = role
		}
	}

	return nil
}

func getNowDate() string {
	sDate := time.Now().Format("2006-01-02 15:04:05")
	return sDate
}

func getPasswordToSHA512(reqPassword, secret string) string {
	key := []byte(secret)
	mac := hmac.New(sha512.New, key)
	mac.Write([]byte(reqPassword))
	return hex.EncodeToString(mac.Sum(nil))
}