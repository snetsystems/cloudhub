package pgsql

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb"
)

var _ cloudhub.UserGroupStore = (*UserGroupStore)(nil)

// UserGroupStore manages UserGroup persistence in PostgreSQL.
type UserGroupStore struct{ client *Client }

// NewUserGroupStore creates a new UserGroupStore.
func NewUserGroupStore(client *Client) *UserGroupStore {
	return &UserGroupStore{client: client}
}

func (s *UserGroupStore) All(ctx context.Context, orgID string) ([]cloudhub.UserGroup, error) {
	const q = `SELECT id, org_id, name, alert_nodes, escalation_schedule, notify_days, notify_start_hm, notify_end_hm, receive_level, created_at, updated_at FROM user_groups WHERE org_id = $1 ORDER BY created_at`
	rows, err := s.client.QueryContext(ctx, q, orgID)
	if err != nil {
		return nil, fmt.Errorf("user_group.All: %w", err)
	}
	defer rows.Close()
	var out []cloudhub.UserGroup
	for rows.Next() {
		g, err := scanUserGroup(rows)
		if err != nil {
			return nil, err
		}
		g.Members, err = s.members(ctx, g.ID)
		if err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func (s *UserGroupStore) Get(ctx context.Context, id string) (cloudhub.UserGroup, error) {
	const q = `SELECT id, org_id, name, alert_nodes, escalation_schedule, notify_days, notify_start_hm, notify_end_hm, receive_level, created_at, updated_at FROM user_groups WHERE id = $1`
	rows, err := s.client.QueryContext(ctx, q, id)
	if err != nil {
		return cloudhub.UserGroup{}, fmt.Errorf("user_group.Get: %w", err)
	}
	defer rows.Close()
	if !rows.Next() {
		return cloudhub.UserGroup{}, fmt.Errorf("user_group.Get: not found")
	}
	g, err := scanUserGroup(rows)
	if err != nil {
		return cloudhub.UserGroup{}, err
	}
	g.Members, err = s.members(ctx, id)
	if err != nil {
		return cloudhub.UserGroup{}, err
	}
	return g, nil
}

// alertNodesPlain is a plain struct mirroring AlertNodes fields without the
// custom MarshalJSON wrapper (which adds typeOf:"alert"). Used for JSONB storage.
type alertNodesPlain struct {
	Posts      []*cloudhub.Post       `json:"post,omitempty"`
	TCPs       []*cloudhub.TCP        `json:"tcp,omitempty"`
	Email      []*cloudhub.Email      `json:"email,omitempty"`
	Exec       []*cloudhub.Exec       `json:"exec,omitempty"`
	Log        []*cloudhub.Log        `json:"log,omitempty"`
	VictorOps  []*cloudhub.VictorOps  `json:"victorOps,omitempty"`
	PagerDuty  []*cloudhub.PagerDuty  `json:"pagerDuty,omitempty"`
	PagerDuty2 []*cloudhub.PagerDuty  `json:"pagerDuty2,omitempty"`
	Pushover   []*cloudhub.Pushover   `json:"pushover,omitempty"`
	Sensu      []*cloudhub.Sensu      `json:"sensu,omitempty"`
	Slack      []*cloudhub.Slack      `json:"slack,omitempty"`
	Telegram   []*cloudhub.Telegram   `json:"telegram,omitempty"`
	Alerta     []*cloudhub.Alerta     `json:"alerta,omitempty"`
	OpsGenie   []*cloudhub.OpsGenie   `json:"opsGenie,omitempty"`
	OpsGenie2  []*cloudhub.OpsGenie   `json:"opsGenie2,omitempty"`
	Talk       []*cloudhub.Talk       `json:"talk,omitempty"`
	Kafka      []*cloudhub.Kafka      `json:"kafka,omitempty"`
	ServiceNow []*cloudhub.ServiceNow `json:"serviceNow,omitempty"`
}

func marshalAlertNodes(nodes cloudhub.AlertNodes) ([]byte, error) {
	plain := alertNodesPlain{
		Posts:      nodes.Posts,
		TCPs:       nodes.TCPs,
		Email:      nodes.Email,
		Exec:       nodes.Exec,
		Log:        nodes.Log,
		VictorOps:  nodes.VictorOps,
		PagerDuty:  nodes.PagerDuty,
		PagerDuty2: nodes.PagerDuty2,
		Pushover:   nodes.Pushover,
		Sensu:      nodes.Sensu,
		Slack:      nodes.Slack,
		Telegram:   nodes.Telegram,
		Alerta:     nodes.Alerta,
		OpsGenie:   nodes.OpsGenie,
		OpsGenie2:  nodes.OpsGenie2,
		Talk:       nodes.Talk,
		Kafka:      nodes.Kafka,
		ServiceNow: nodes.ServiceNow,
	}
	return json.Marshal(plain)
}

func unmarshalAlertNodes(data []byte) (cloudhub.AlertNodes, error) {
	var plain alertNodesPlain
	if err := json.Unmarshal(data, &plain); err != nil {
		return cloudhub.AlertNodes{}, fmt.Errorf("user_group AlertNodes unmarshal: %w", err)
	}
	return cloudhub.AlertNodes{
		Posts:      plain.Posts,
		TCPs:       plain.TCPs,
		Email:      plain.Email,
		Exec:       plain.Exec,
		Log:        plain.Log,
		VictorOps:  plain.VictorOps,
		PagerDuty:  plain.PagerDuty,
		PagerDuty2: plain.PagerDuty2,
		Pushover:   plain.Pushover,
		Sensu:      plain.Sensu,
		Slack:      plain.Slack,
		Telegram:   plain.Telegram,
		Alerta:     plain.Alerta,
		OpsGenie:   plain.OpsGenie,
		OpsGenie2:  plain.OpsGenie2,
		Talk:       plain.Talk,
		Kafka:      plain.Kafka,
		ServiceNow: plain.ServiceNow,
	}, nil
}

func scanUserGroup(rows interface {
	Scan(...any) error
}) (cloudhub.UserGroup, error) {
	var g cloudhub.UserGroup
	var nodesJSON []byte
	var ca, ua time.Time
	if err := rows.Scan(&g.ID, &g.OrgID, &g.Name, &nodesJSON,
		&g.EscalationSchedule, &g.NotifyDays, &g.NotifyStartHM, &g.NotifyEndHM,
		&g.ReceiveLevel, &ca, &ua); err != nil {
		return g, fmt.Errorf("user_group scan: %w", err)
	}
	g.CreatedAt, g.UpdatedAt = ca, ua
	var err error
	g.AlertNodes, err = unmarshalAlertNodes(nodesJSON)
	return g, err
}

func (s *UserGroupStore) members(ctx context.Context, groupID string) ([]cloudhub.UserGroupMember, error) {
	const q = `SELECT user_id, user_name, email, email_enabled, email_level, sms, sms_enabled, sms_level FROM user_group_members WHERE user_group_id = $1`
	rows, err := s.client.QueryContext(ctx, q, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []cloudhub.UserGroupMember
	for rows.Next() {
		var m cloudhub.UserGroupMember
		if err := rows.Scan(&m.UserID, &m.UserName, &m.Email, &m.EmailEnabled, &m.EmailLevel, &m.SMS, &m.SMSEnabled, &m.SMSLevel); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	if out == nil {
		out = []cloudhub.UserGroupMember{}
	}
	return out, rows.Err()
}

func (s *UserGroupStore) Add(ctx context.Context, g cloudhub.UserGroup) (cloudhub.UserGroup, error) {
	nodesJSON, err := marshalAlertNodes(g.AlertNodes)
	if err != nil {
		return cloudhub.UserGroup{}, fmt.Errorf("user_group.Add nodes marshal: %w", err)
	}
	
	err = s.client.WithTx(ctx, func(ctx context.Context, tx rdb.Store) error {
		const q = `INSERT INTO user_groups (org_id, name, alert_nodes, escalation_schedule, notify_days, notify_start_hm, notify_end_hm, receive_level, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW()) RETURNING id, created_at, updated_at`
		if err := tx.QueryRowContext(ctx, q,
			g.OrgID, g.Name, nodesJSON, g.EscalationSchedule,
			g.NotifyDays, g.NotifyStartHM, g.NotifyEndHM, g.ReceiveLevel,
		).Scan(&g.ID, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return err
		}
		for _, m := range g.Members {
			const mq = `INSERT INTO user_group_members (user_group_id, user_id, user_name, email, email_enabled, email_level, sms, sms_enabled, sms_level) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`
			if _, err := tx.ExecContext(ctx, mq, g.ID, m.UserID, m.UserName, m.Email, m.EmailEnabled, m.EmailLevel, m.SMS, m.SMSEnabled, m.SMSLevel); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return cloudhub.UserGroup{}, fmt.Errorf("user_group.Add: %w", err)
	}
	return g, nil
}

func (s *UserGroupStore) Update(ctx context.Context, g cloudhub.UserGroup) error {
	nodesJSON, err := marshalAlertNodes(g.AlertNodes)
	if err != nil {
		return fmt.Errorf("user_group.Update nodes marshal: %w", err)
	}
	
	err = s.client.WithTx(ctx, func(ctx context.Context, tx rdb.Store) error {
		const q = `UPDATE user_groups SET name=$1, alert_nodes=$2, escalation_schedule=$3, notify_days=$4, notify_start_hm=$5, notify_end_hm=$6, receive_level=$7, updated_at=NOW() WHERE id=$8`
		if _, err := tx.ExecContext(ctx, q,
			g.Name, nodesJSON, g.EscalationSchedule,
			g.NotifyDays, g.NotifyStartHM, g.NotifyEndHM, g.ReceiveLevel, g.ID,
		); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM user_group_members WHERE user_group_id = $1`, g.ID); err != nil {
			return err
		}
		for _, m := range g.Members {
			const mq = `INSERT INTO user_group_members (user_group_id, user_id, user_name, email, email_enabled, email_level, sms, sms_enabled, sms_level) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`
			if _, err := tx.ExecContext(ctx, mq, g.ID, m.UserID, m.UserName, m.Email, m.EmailEnabled, m.EmailLevel, m.SMS, m.SMSEnabled, m.SMSLevel); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("user_group.Update: %w", err)
	}
	return nil
}

func (s *UserGroupStore) Delete(ctx context.Context, id string) error {
	if _, err := s.client.ExecContext(ctx, `DELETE FROM user_groups WHERE id = $1`, id); err != nil {
		return fmt.Errorf("user_group.Delete: %w", err)
	}
	return nil
}

