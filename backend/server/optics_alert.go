package server

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	client "github.com/influxdata/kapacitor/client/v1"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	kapa "github.com/snetsystems/cloudhub/backend/kapacitor"
)

// opticsThresholdChanged reports whether the alert needs regenerating. Both
// unset counts as unchanged, so an organization that never configured optics
// never reaches Kapacitor.
func opticsThresholdChanged(before, after *cloudhub.OpticsThreshold) bool {
	if before == nil || after == nil {
		return before != after
	}
	return *before != *after
}

// applyOpticsAlertTask keeps the organization's optical-transceiver Kapacitor
// task in step with its thresholds.
//
// The task is generated from the same OpticsThreshold the dashboard cell reads,
// so the alert and the display can never judge a port differently. Turning
// alerting off removes the task rather than leaving a stale one running.
//
// A failure here is reported but never fails the settings save: the thresholds
// are still correct for the dashboard, and Kapacitor may simply be unreachable.
func applyOpticsAlertTask(ctx context.Context, s *Service, orgID string, deviceOrg *cloudhub.NetworkDeviceOrg) error {
	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &orgID})
	if err != nil {
		return fmt.Errorf("organization %s not found: %v", orgID, err)
	}

	c, err := opticsKapacitorClient(ctx, s, orgID, deviceOrg)
	if err != nil {
		return err
	}
	kapaID := cloudhub.OpticsScriptPrefix + org.ID

	threshold := deviceOrg.OpticsThreshold
	if threshold == nil || !threshold.AlertEnabled {
		return removeOpticsAlertTask(ctx, s, c, kapaID, org.Name)
	}

	script, err := renderOpticsTickScript(ctx, s, org.Name, threshold)
	if err != nil {
		return err
	}

	DBRPs := []client.DBRP{{Database: "Default", RetentionPolicy: RetentionPolicy}}
	if org.ID != "default" {
		DBRPs = append(DBRPs, client.DBRP{Database: org.Name, RetentionPolicy: RetentionPolicy})
	}

	// Creating over an existing task fails, and updating one that is running
	// leaves the old pipeline in place, so AutoGenerateUpdate's
	// disable-update-enable cycle is what actually swaps the script out.
	if existing, _ := c.Get(ctx, kapaID); existing != nil {
		_, err := c.AutoGenerateUpdate(ctx, &client.UpdateTaskOptions{
			ID:         kapaID,
			Type:       client.StreamTask,
			DBRPs:      DBRPs,
			TICKscript: script,
			Status:     client.Enabled,
		}, c.Href(kapaID), kapa.NewTaskProcess{})
		if err != nil {
			return fmt.Errorf("error updating optics alert task: %v", err)
		}

		s.logRegistration(ctx, "Kapacitors Task",
			fmt.Sprintf(MsgKapacitorModified.String(), kapaID, org.Name))
		return nil
	}

	task, err := c.AutoGenerateCreate(ctx, &client.CreateTaskOptions{
		ID:         kapaID,
		Type:       client.StreamTask,
		DBRPs:      DBRPs,
		TICKscript: script,
		Status:     client.Enabled,
	})
	if err != nil {
		return fmt.Errorf("error creating optics alert task: %v", err)
	}

	s.logRegistration(ctx, "Kapacitors Task",
		fmt.Sprintf(MsgKapacitorRuleCreated.String(), task.Rule.Name, org.Name))
	return nil
}

// opticsKapacitorClient resolves the Kapacitor the operator picked for optics.
//
// It is not derived from the data source: a source can have several Kapacitors
// registered and that association says nothing about which should own alerts.
// Nor is it AIKapacitor — that one runs the anomaly-prediction script, which
// needs a GPU-backed @predict() UDF, so borrowing it would make optics alerting
// unavailable exactly where prediction is not deployed.
func opticsKapacitorClient(
	ctx context.Context,
	s *Service,
	orgID string,
	deviceOrg *cloudhub.NetworkDeviceOrg,
) (*kapa.Client, error) {
	if deviceOrg.OpticsKapacitorID == 0 {
		return nil, fmt.Errorf("organization %s has no optics kapacitor selected", orgID)
	}

	srv, err := s.Store.Servers(ctx).Get(ctx, deviceOrg.OpticsKapacitorID)
	if err != nil {
		return nil, fmt.Errorf("optics kapacitor %d not found: %v", deviceOrg.OpticsKapacitorID, err)
	}

	return kapa.NewClient(srv.URL, srv.Username, srv.Password, srv.InsecureSkipVerify), nil
}

// renderOpticsTickScript fills the optics template with the org's thresholds.
func renderOpticsTickScript(ctx context.Context, s *Service, orgName string, threshold *cloudhub.OpticsThreshold) (string, error) {
	t, err := s.InternalENV.TemplatesManager.Get(ctx, string(OpticsTaskField))
	if err != nil {
		return "", fmt.Errorf("optics task template not found: %v", err)
	}

	tmplParams := []cloudhub.TemplateBlock{
		{
			Name: "main",
			Params: cloudhub.TemplateParamsMap{
				"OrgName":         orgName,
				"RetentionPolicy": RetentionPolicy,
				// As float literals: a whole number renders as `-15`, which
				// TICKscript reads as an integer, and default() would then stand
				// a missing float field up as an int — a type the measurement
				// rejects on write.
				"RxLowDbm":  tickFloat(threshold.RxLowDbm),
				"TxLowDbm":  tickFloat(threshold.TxLowDbm),
				"TempHighC": tickFloat(threshold.TempHighC),
				"Message": "Optical transceiver {{index .Tags \"sys_name\"}} " +
					"{{index .Tags \"ifName\"}} is {{.Level}}",
				"Details": "",
				// Kapacitor's SMTP config is not global here, so the alert has to
				// ask for mail explicitly. No argument means the recipients
				// configured on that Kapacitor, which is where they are managed.
				"AlertServices": ".email()",
				"Group":         "{{.Group}}",
			},
		},
	}

	templateService := &TemplateService{}
	return templateService.LoadTemplate(cloudhub.LoadTemplateConfig{
		Field:          OpticsTaskField,
		TemplateString: t.Template,
	}, tmplParams)
}

// tickFloat renders a threshold as a TICKscript float literal, keeping the
// decimal point a whole number would otherwise lose.
func tickFloat(v float64) string {
	formatted := strconv.FormatFloat(v, 'f', -1, 64)
	if !strings.ContainsRune(formatted, '.') {
		formatted += ".0"
	}
	return formatted
}

// removeOpticsAlertTaskFrom clears the task off a Kapacitor the operator has
// moved away from. Left behind it keeps evaluating and alerting, so the same
// fault would be reported twice from two different Kapacitors.
func removeOpticsAlertTaskFrom(ctx context.Context, s *Service, serverID int, orgID string) error {
	srv, err := s.Store.Servers(ctx).Get(ctx, serverID)
	if err != nil {
		return fmt.Errorf("previous optics kapacitor %d not found: %v", serverID, err)
	}

	c := kapa.NewClient(srv.URL, srv.Username, srv.Password, srv.InsecureSkipVerify)
	return removeOpticsAlertTask(ctx, s, c, cloudhub.OpticsScriptPrefix+orgID, orgID)
}

// removeOpticsAlertTask deletes the task, treating "already absent" as success.
func removeOpticsAlertTask(ctx context.Context, s *Service, c *kapa.Client, kapaID, orgName string) error {
	if task, err := c.Get(ctx, kapaID); err != nil || task == nil {
		return nil
	}
	if err := c.Delete(ctx, c.Href(kapaID)); err != nil {
		return fmt.Errorf("error deleting optics alert task: %v", err)
	}

	s.logRegistration(ctx, "Kapacitors Task",
		fmt.Sprintf("Kapacitor task %s for organization %s deleted", kapaID, orgName))
	return nil
}
