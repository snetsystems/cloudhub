package pgsql

import (
	"context"
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

var _ cloudhub.AlertRecipientMemberPrefsStore = (*AlertRecipientMemberPrefsStore)(nil)

type AlertRecipientMemberPrefsStore struct{ client *Client }

func NewAlertRecipientMemberPrefsStore(client *Client) *AlertRecipientMemberPrefsStore {
	return &AlertRecipientMemberPrefsStore{client: client}
}

const alertMemberPrefsCols = `recipient_group_member_id, email_enabled, email_level, sms_enabled, sms_level, notify_weekdays, notify_start_hm, notify_end_hm, escalation_seconds`

func scanMemberPrefs(row interface{ Scan(...any) error }) (cloudhub.AlertRecipientMemberPrefs, error) {
	var p cloudhub.AlertRecipientMemberPrefs
	if err := row.Scan(
		&p.RecipientGroupMemberID,
		&p.EmailEnabled, &p.EmailLevel,
		&p.SMSEnabled, &p.SMSLevel,
		&p.NotifyWeekdays, &p.NotifyStartHM, &p.NotifyEndHM,
		&p.EscalationSeconds,
	); err != nil {
		return p, fmt.Errorf("alert_recipient_member_prefs scan: %w", err)
	}
	return p, nil
}

func (s *AlertRecipientMemberPrefsStore) Get(ctx context.Context, memberID string) (cloudhub.AlertRecipientMemberPrefs, error) {
	q := `SELECT ` + alertMemberPrefsCols + ` FROM alert_recipient_member_prefs WHERE recipient_group_member_id = $1`
	return scanMemberPrefs(s.client.QueryRowContext(ctx, q, memberID))
}

func (s *AlertRecipientMemberPrefsStore) Upsert(ctx context.Context, p cloudhub.AlertRecipientMemberPrefs) error {
	const q = `INSERT INTO alert_recipient_member_prefs
		(recipient_group_member_id, email_enabled, email_level, sms_enabled, sms_level, notify_weekdays, notify_start_hm, notify_end_hm, escalation_seconds)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		ON CONFLICT (recipient_group_member_id) DO UPDATE SET
			email_enabled = EXCLUDED.email_enabled,
			email_level = EXCLUDED.email_level,
			sms_enabled = EXCLUDED.sms_enabled,
			sms_level = EXCLUDED.sms_level,
			notify_weekdays = EXCLUDED.notify_weekdays,
			notify_start_hm = EXCLUDED.notify_start_hm,
			notify_end_hm = EXCLUDED.notify_end_hm,
			escalation_seconds = EXCLUDED.escalation_seconds`
	_, err := s.client.ExecContext(ctx, q,
		p.RecipientGroupMemberID,
		p.EmailEnabled, p.EmailLevel,
		p.SMSEnabled, p.SMSLevel,
		p.NotifyWeekdays, p.NotifyStartHM, p.NotifyEndHM,
		p.EscalationSeconds,
	)
	if err != nil {
		return fmt.Errorf("alert_recipient_member_prefs.Upsert: %w", err)
	}
	return nil
}

func (s *AlertRecipientMemberPrefsStore) Delete(ctx context.Context, memberID string) error {
	if _, err := s.client.ExecContext(ctx, `DELETE FROM alert_recipient_member_prefs WHERE recipient_group_member_id = $1`, memberID); err != nil {
		return fmt.Errorf("alert_recipient_member_prefs.Delete: %w", err)
	}
	return nil
}

func (s *AlertRecipientMemberPrefsStore) ByGroup(ctx context.Context, groupID string) ([]cloudhub.AlertRecipientMemberPrefs, error) {
	q := `SELECT ` + alertMemberPrefsCols + ` FROM alert_recipient_member_prefs p
		JOIN recipient_group_members m ON m.id = p.recipient_group_member_id
		WHERE m.recipient_group_id = $1 AND m.delete_yn = false`
	rows, err := s.client.QueryContext(ctx, q, groupID)
	if err != nil {
		return nil, fmt.Errorf("alert_recipient_member_prefs.ByGroup: %w", err)
	}
	defer rows.Close()
	var out []cloudhub.AlertRecipientMemberPrefs
	for rows.Next() {
		p, err := scanMemberPrefs(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
