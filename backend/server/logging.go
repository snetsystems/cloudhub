package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/influx"
)

// General Acitivity Logging
const (
	// Basic Login
	MsgBasicLogin = logMessage("Login Success")
	MsgBasicLogout = logMessage("Logout Success")
	MsgDifferentPassword = logMessage("Passwords do not match.")
	MsgEmptyPassword = logMessage("Empty user table password")

	// Organizations
	MsgOrganizationCreated = logMessage("%s has been created.")
	MsgOrganizationModified = logMessage("%s has been modified.")
	MsgOrganizationDeleted = logMessage("%s has been deleted.")

	// Mappings
	MsgMappingCreated = logMessage("%s Mapping has been created.")
	MsgMappingModified = logMessage("%s Mapping has been modified.")
	MsgMappingDeleted = logMessage("%s Mapping has been deleted.")

	// Sources
	MsgSourcesCreated = logMessage("%s has been created.")
	MsgSourcesModified = logMessage("%s has been modified.")
	MsgSourcesDeleted = logMessage("%s has been deleted.")

	// Sources Roles
	MsgSourceRoleCreated = logMessage("%s has been added into %s.")
	MsgSourceRoleModified = logMessage("%s has been modified in %s.")
	MsgSourceRoleDeleted = logMessage("%s has been subtracted from %s.")

	// Sources Users
	MsgSourceUserCreated = logMessage("%s has been created in %s.")
	MsgSourceUserModified = logMessage("%s has been modified in %s.")
	MsgSourceUserDeleted = logMessage("%s has been deleted from %s.")

	// Kapacitors
	MsgKapacitorCreated = logMessage("%s has been created.")
	MsgKapacitorModified = logMessage("%s has been modified.")
	MsgKapacitorDeleted = logMessage("%s has been deleted.")

	// Kapacitors Rules
	MsgKapacitorRuleCreated = logMessage("%s has been created in %s.")
	MsgKapacitorRuleModified = logMessage("%s has been modified in %s.")
	MsgKapacitorRuleStatus = logMessage("%s has been %s in %s.")
	MsgKapacitorRuleDeleted = logMessage("%s has been deleted from %s.")

	// Organizations Users
	MsgOrganizationUserCreated = logMessage("%s has been created in %s.")
	MsgOrganizationUserModified = logMessage("%s has been modified in %s.")
	MsgOrganizationUserDeleted = logMessage("%s has been deleted from %s.")

	// Users
	MsgUserCreated = logMessage("%s has been created.")
	MsgUserModified = logMessage("%s has been modified.")
	MsgUserDeleted = logMessage("%s has been deleted.")

	// Dashboards
	MsgDashboardCreated = logMessage("%s has been created.")
	MsgDashboardModified = logMessage("%s has been modified.")
	MsgDashboardDeleted = logMessage("%s has been deleted.")

	// Dashboards Cells
	MsgDashboardCellCreated = logMessage("%s has been created in %s.")
	MsgDashboardCellModified = logMessage("%s has been modified in %s.")
	MsgDashboardCellDeleted = logMessage("%s has been deleted from %s.")

	// Dashboards Templates
	MsgDashboardTemplateCreated = logMessage("%s has been created in %s.")
	MsgDashboardTemplateModified = logMessage("%s has been modified in %s.")
	MsgDashboardTemplateDeleted = logMessage("%s has been deleted from %s.")

	// Databases
	MsgDatabaseCreated = logMessage("%s has been created.")
	MsgDatabaseDeleted = logMessage("%s has been deleted.")

	// Retention Policies
	MsgRetentionPoliciesCreated = logMessage("%s has been created in %s.")
	MsgRetentionPoliciesModified = logMessage("%s has been modified in %s.")
	MsgRetentionPoliciesDeleted = logMessage("%s has been deleted from %s.")

	// SuperAdminNewUsers
	MsgSuperAdminNewUserModified = logMessage("The option of enduing the super admin privilege for the new users has been modified")

	// vSpheres
	MsgvSpheresCreated = logMessage("%s has been created.")
	MsgvSpheresModified = logMessage("%s has been modified.")
	MsgvSpheresDeleted = logMessage("%s has been deleted.")

	// Topologies
	MsgTopologyCreated = logMessage("%s Topology has been created.")
	MsgTopologyModified = logMessage("%s Topology has been modified.")
	MsgTopologyDeleted = logMessage("%s Topology has been deleted.")

	// Retry
	MsgRetryCountOver = logMessage("%s was locked due to exceeding retry count.")
	MsgRetryLoginLocked = logMessage("%s login request has been locked.")
	MsgRetryDelayTimeAfter = logMessage("Login unlocking time has not passed.")

	// Locked
	MsgLocked = logMessage("administrator has locked %s.")
	MsgUnlocked = logMessage("%s has been unlocked by an administrator.")
	MsgSuperLocked = logMessage("Locked by administrator. Please contact the administrator.")
)

type proxyLogRequest struct {
	Action   string    `json:"action"`
	Message  string    `json:"message"`
}

type logMessage string

func (m logMessage) String() string {
	return string(m)
}

func (r *proxyLogRequest) ValidCreate() error {
	if r.Action == ""  {
		return fmt.Errorf("Action required request body")
	}

	if r.Message == "" {
		return fmt.Errorf("Message required request body")
	}

	return nil
}

// HTTPLogging log insert
func (s *Service) HTTPLogging(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req proxyLogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.ValidCreate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	// log registrationte
	s.logRegistration(ctx, req.Action, req.Message)

	w.WriteHeader(http.StatusOK)
}

// logRegistration log db insert
// parameters = action, message, userName
func (s *Service) logRegistration(ctx context.Context, parameters ...string) {
	logs := s.Logger.
		WithField("component", "activity_logging").
		WithField("parameters", fmt.Sprintf("%q", parameters))

	serverCtx := serverContext(ctx)	
	user, ok := hasUserContext(ctx)
	if !ok {
		user = &cloudhub.User{
			Name:               parameters[2],
		}
	}

	// // The id of influxdb set as server option is 0
	id := 0
	src, err := s.Store.Sources(serverCtx).Get(serverCtx, id)
	if err != nil {
		msg := fmt.Sprintf("Not setting influxdb server option")
		logs.Error(msg)
		return
	}

	u, err := url.Parse(src.URL)
	if err != nil {
		msg := fmt.Sprintf("Error parsing source url : %v", err)
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
			"action": parameters[0],
			"user": user.Name,
			"db": "",
		},
		Fields: map[string]interface{}{
			"timestamp": nanos,
			"message": parameters[1],
		},
	}

	client := &influx.Client{
		URL:                u,
		Authorizer:         influx.DefaultAuthorization(&src),
		InsecureSkipVerify: src.InsecureSkipVerify,
		Logger:             s.Logger,
	}

	if err := client.Write(ctx, []cloudhub.Point{data}); err != nil {
		msg := fmt.Sprintf("Error influxdb log write : %v", err)
		logs.Error(msg)
		return
	}
}