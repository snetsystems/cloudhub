package internal

import (
	"encoding/json"
	"fmt"

	"github.com/gogo/protobuf/proto"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

//go:generate protoc --gofast_out=. internal.proto

// MarshalBuild encodes a build to binary protobuf format.
func MarshalBuild(b cloudhub.BuildInfo) ([]byte, error) {
	return proto.Marshal(&BuildInfo{
		Version: b.Version,
		Commit:  b.Commit,
	})
}

// UnmarshalBuild decodes a build from binary protobuf data.
func UnmarshalBuild(data []byte, b *cloudhub.BuildInfo) error {
	var pb BuildInfo
	if err := proto.Unmarshal(data, &pb); err != nil {
		return err
	}

	b.Version = pb.Version
	b.Commit = pb.Commit
	return nil
}

// MarshalSource encodes a source to binary protobuf format.
func MarshalSource(s cloudhub.Source) ([]byte, error) {
	return proto.Marshal(&Source{
		ID:                 int64(s.ID),
		Name:               s.Name,
		Type:               s.Type,
		Username:           s.Username,
		Password:           s.Password,
		SharedSecret:       s.SharedSecret,
		URL:                s.URL,
		MetaURL:            s.MetaURL,
		InsecureSkipVerify: s.InsecureSkipVerify,
		Default:            s.Default,
		Telegraf:           s.Telegraf,
		Organization:       s.Organization,
		Role:               s.Role,
		DefaultRP:          s.DefaultRP,
		Version:            s.Version,
	})
}

// UnmarshalSource decodes a source from binary protobuf data.
func UnmarshalSource(data []byte, s *cloudhub.Source) error {
	var pb Source
	if err := proto.Unmarshal(data, &pb); err != nil {
		return err
	}

	s.ID = int(pb.ID)
	s.Name = pb.Name
	s.Type = pb.Type
	s.Username = pb.Username
	s.Password = pb.Password
	s.SharedSecret = pb.SharedSecret
	s.URL = pb.URL
	s.MetaURL = pb.MetaURL
	s.InsecureSkipVerify = pb.InsecureSkipVerify
	s.Default = pb.Default
	s.Telegraf = pb.Telegraf
	s.Organization = pb.Organization
	s.Role = pb.Role
	s.DefaultRP = pb.DefaultRP
	s.Version = pb.Version
	return nil
}

// MarshalServer encodes a server to binary protobuf format.
func MarshalServer(s cloudhub.Server) ([]byte, error) {
	var (
		metadata []byte
		err      error
	)
	metadata, err = json.Marshal(s.Metadata)
	if err != nil {
		return nil, err
	}
	return proto.Marshal(&Server{
		ID:                 int64(s.ID),
		SrcID:              int64(s.SrcID),
		Name:               s.Name,
		Username:           s.Username,
		Password:           s.Password,
		URL:                s.URL,
		Active:             s.Active,
		Organization:       s.Organization,
		InsecureSkipVerify: s.InsecureSkipVerify,
		Type:               s.Type,
		MetadataJSON:       string(metadata),
	})
}

// UnmarshalServer decodes a server from binary protobuf data.
func UnmarshalServer(data []byte, s *cloudhub.Server) error {
	var pb Server
	if err := proto.Unmarshal(data, &pb); err != nil {
		return err
	}

	s.Metadata = make(map[string]interface{})
	if len(pb.MetadataJSON) > 0 {
		if err := json.Unmarshal([]byte(pb.MetadataJSON), &s.Metadata); err != nil {
			return err
		}
	}

	s.ID = int(pb.ID)
	s.SrcID = int(pb.SrcID)
	s.Name = pb.Name
	s.Username = pb.Username
	s.Password = pb.Password
	s.URL = pb.URL
	s.Active = pb.Active
	s.Organization = pb.Organization
	s.InsecureSkipVerify = pb.InsecureSkipVerify
	s.Type = pb.Type
	return nil
}

// MarshalLayout encodes a layout to binary protobuf format.
func MarshalLayout(l cloudhub.Layout) ([]byte, error) {
	cells := make([]*Cell, len(l.Cells))
	for i, c := range l.Cells {
		queries := make([]*Query, len(c.Queries))
		for j, q := range c.Queries {
			r := new(Range)
			if q.Range != nil {
				r.Upper, r.Lower = q.Range.Upper, q.Range.Lower
			}
			queries[j] = &Query{
				Command:  q.Command,
				DB:       q.DB,
				RP:       q.RP,
				GroupBys: q.GroupBys,
				Wheres:   q.Wheres,
				Label:    q.Label,
				Range:    r,
			}
		}

		axes := make(map[string]*Axis, len(c.Axes))
		for a, r := range c.Axes {
			axes[a] = &Axis{
				Bounds: r.Bounds,
				Label:  r.Label,
			}
		}

		cells[i] = &Cell{
			X:       c.X,
			Y:       c.Y,
			W:       c.W,
			H:       c.H,
			I:       c.I,
			Name:    c.Name,
			Queries: queries,
			Type:    c.Type,
			Axes:    axes,
		}
	}
	return proto.Marshal(&Layout{
		ID:          l.ID,
		Measurement: l.Measurement,
		Application: l.Application,
		Autoflow:    l.Autoflow,
		Cells:       cells,
	})
}

// UnmarshalLayout decodes a layout from binary protobuf data.
func UnmarshalLayout(data []byte, l *cloudhub.Layout) error {
	var pb Layout
	if err := proto.Unmarshal(data, &pb); err != nil {
		return err
	}

	l.ID = pb.ID
	l.Measurement = pb.Measurement
	l.Application = pb.Application
	l.Autoflow = pb.Autoflow
	cells := make([]cloudhub.Cell, len(pb.Cells))
	for i, c := range pb.Cells {
		queries := make([]cloudhub.Query, len(c.Queries))
		for j, q := range c.Queries {
			queries[j] = cloudhub.Query{
				Command:  q.Command,
				DB:       q.DB,
				RP:       q.RP,
				GroupBys: q.GroupBys,
				Wheres:   q.Wheres,
				Label:    q.Label,
			}
			if q.Range.Upper != q.Range.Lower {
				queries[j].Range = &cloudhub.Range{
					Upper: q.Range.Upper,
					Lower: q.Range.Lower,
				}
			}
		}
		axes := make(map[string]cloudhub.Axis, len(c.Axes))
		for a, r := range c.Axes {
			axes[a] = cloudhub.Axis{
				Bounds: r.Bounds,
				Label:  r.Label,
			}
		}

		cells[i] = cloudhub.Cell{
			X:       c.X,
			Y:       c.Y,
			W:       c.W,
			H:       c.H,
			I:       c.I,
			Name:    c.Name,
			Queries: queries,
			Type:    c.Type,
			Axes:    axes,
		}
	}
	l.Cells = cells
	return nil
}

// MarshalDashboard encodes a dashboard to binary protobuf format.
func MarshalDashboard(d cloudhub.Dashboard) ([]byte, error) {
	cells := make([]*DashboardCell, len(d.Cells))
	for i, c := range d.Cells {
		queries := make([]*Query, len(c.Queries))
		for j, q := range c.Queries {
			r := new(Range)
			if q.Range != nil {
				r.Upper, r.Lower = q.Range.Upper, q.Range.Lower
			}
			q.Shifts = q.QueryConfig.Shifts
			queries[j] = &Query{
				Command: q.Command,
				Label:   q.Label,
				Range:   r,
				Source:  q.Source,
				Type:    q.Type,
			}

			shifts := make([]*TimeShift, len(q.Shifts))
			for k := range q.Shifts {
				shift := &TimeShift{
					Label:    q.Shifts[k].Label,
					Unit:     q.Shifts[k].Unit,
					Quantity: q.Shifts[k].Quantity,
				}

				shifts[k] = shift
			}

			queries[j].Shifts = shifts
		}

		colors := make([]*Color, len(c.CellColors))
		for j, color := range c.CellColors {
			colors[j] = &Color{
				ID:    color.ID,
				Type:  color.Type,
				Hex:   color.Hex,
				Name:  color.Name,
				Value: color.Value,
			}
		}

		axes := make(map[string]*Axis, len(c.Axes))
		for a, r := range c.Axes {
			axes[a] = &Axis{
				Bounds: r.Bounds,
				Label:  r.Label,
				Prefix: r.Prefix,
				Suffix: r.Suffix,
				Base:   r.Base,
				Scale:  r.Scale,
			}
		}

		sortBy := &RenamableField{
			InternalName: c.TableOptions.SortBy.InternalName,
			DisplayName:  c.TableOptions.SortBy.DisplayName,
			Visible:      c.TableOptions.SortBy.Visible,
			Direction:    c.TableOptions.SortBy.Direction,
			TempVar:      c.TableOptions.SortBy.TempVar,
		}

		tableOptions := &TableOptions{
			VerticalTimeAxis: c.TableOptions.VerticalTimeAxis,
			SortBy:           sortBy,
			Wrapping:         c.TableOptions.Wrapping,
			FixFirstColumn:   c.TableOptions.FixFirstColumn,
		}

		decimalPlaces := &DecimalPlaces{
			IsEnforced: c.DecimalPlaces.IsEnforced,
			Digits:     c.DecimalPlaces.Digits,
		}

		fieldOptions := make([]*RenamableField, len(c.FieldOptions))
		for i, field := range c.FieldOptions {
			fieldOptions[i] = &RenamableField{
				InternalName: field.InternalName,
				DisplayName:  field.DisplayName,
				Visible:      field.Visible,
				Direction:    field.Direction,
				TempVar:      field.TempVar,
			}
		}

		graphOptions := &GraphOptions{
			FillArea:         c.GraphOptions.FillArea,
			ShowLine:         c.GraphOptions.ShowLine,
			ShowPoint:        c.GraphOptions.ShowPoint,
			ShowTempVarCount: c.GraphOptions.ShowTempVarCount,
		}

		note := c.Note
		noteVisibility := c.NoteVisibility

		cells[i] = &DashboardCell{
			ID:      c.ID,
			X:       c.X,
			Y:       c.Y,
			W:       c.W,
			H:       c.H,
			MinW:    c.MinW,
			MinH:    c.MinH,
			Name:    c.Name,
			Queries: queries,
			Type:    c.Type,
			Axes:    axes,
			Colors:  colors,
			Legend: &Legend{
				Type:        c.Legend.Type,
				Orientation: c.Legend.Orientation,
			},
			TableOptions:   tableOptions,
			FieldOptions:   fieldOptions,
			TimeFormat:     c.TimeFormat,
			DecimalPlaces:  decimalPlaces,
			Note:           note,
			NoteVisibility: noteVisibility,
			GraphOptions:   graphOptions,
		}
	}
	templates := make([]*Template, len(d.Templates))
	for i, t := range d.Templates {
		vals := make([]*TemplateValue, len(t.Values))
		for j, v := range t.Values {
			vals[j] = &TemplateValue{
				Selected: v.Selected,
				Type:     v.Type,
				Value:    v.Value,
				Key:      v.Key,
			}
		}

		template := &Template{
			ID:      string(t.ID),
			TempVar: t.Var,
			Values:  vals,
			Type:    t.Type,
			Label:   t.Label,
		}
		if t.Query != nil {
			template.Query = &TemplateQuery{
				Command:     t.Query.Command,
				Flux:        t.Query.Flux,
				Db:          t.Query.DB,
				Rp:          t.Query.RP,
				Measurement: t.Query.Measurement,
				TagKey:      t.Query.TagKey,
				FieldKey:    t.Query.FieldKey,
			}
		}
		templates[i] = template
	}
	return proto.Marshal(&Dashboard{
		ID:           int64(d.ID),
		Cells:        cells,
		Templates:    templates,
		Name:         d.Name,
		Organization: d.Organization,
	})
}

// UnmarshalDashboard decodes a layout from binary protobuf data.
func UnmarshalDashboard(data []byte, d *cloudhub.Dashboard) error {
	var pb Dashboard
	if err := proto.Unmarshal(data, &pb); err != nil {
		return err
	}

	cells := make([]cloudhub.DashboardCell, len(pb.Cells))
	for i, c := range pb.Cells {
		queries := make([]cloudhub.DashboardQuery, len(c.Queries))
		for j, q := range c.Queries {
			queryType := "influxql"
			if q.Type != "" {
				queryType = q.Type
			}
			queries[j] = cloudhub.DashboardQuery{
				Command: q.Command,
				Label:   q.Label,
				Source:  q.Source,
				Type:    queryType,
			}

			if q.Range.Upper != q.Range.Lower {
				queries[j].Range = &cloudhub.Range{
					Upper: q.Range.Upper,
					Lower: q.Range.Lower,
				}
			}

			shifts := make([]cloudhub.TimeShift, len(q.Shifts))
			for k := range q.Shifts {
				shift := cloudhub.TimeShift{
					Label:    q.Shifts[k].Label,
					Unit:     q.Shifts[k].Unit,
					Quantity: q.Shifts[k].Quantity,
				}

				shifts[k] = shift
			}

			queries[j].Shifts = shifts
		}

		colors := make([]cloudhub.CellColor, len(c.Colors))
		for j, color := range c.Colors {
			colors[j] = cloudhub.CellColor{
				ID:    color.ID,
				Type:  color.Type,
				Hex:   color.Hex,
				Name:  color.Name,
				Value: color.Value,
			}
		}

		axes := make(map[string]cloudhub.Axis, len(c.Axes))
		for a, r := range c.Axes {
			// axis base defaults to 10
			if r.Base == "" {
				r.Base = "10"
			}

			if r.Scale == "" {
				r.Scale = "linear"
			}

			axis := cloudhub.Axis{
				Bounds: r.Bounds,
				Label:  r.Label,
				Prefix: r.Prefix,
				Suffix: r.Suffix,
				Base:   r.Base,
				Scale:  r.Scale,
			}

			axes[a] = axis
		}

		legend := cloudhub.Legend{}
		if c.Legend != nil {
			legend.Type = c.Legend.Type
			legend.Orientation = c.Legend.Orientation
		}

		tableOptions := cloudhub.TableOptions{}
		if c.TableOptions != nil {
			sortBy := cloudhub.RenamableField{}
			if c.TableOptions.SortBy != nil {
				sortBy.InternalName = c.TableOptions.SortBy.InternalName
				sortBy.DisplayName = c.TableOptions.SortBy.DisplayName
				sortBy.Visible = c.TableOptions.SortBy.Visible
				sortBy.Direction = c.TableOptions.SortBy.Direction
				sortBy.TempVar = c.TableOptions.SortBy.TempVar
			}
			tableOptions.SortBy = sortBy
			tableOptions.VerticalTimeAxis = c.TableOptions.VerticalTimeAxis
			tableOptions.Wrapping = c.TableOptions.Wrapping
			tableOptions.FixFirstColumn = c.TableOptions.FixFirstColumn
		}

		fieldOptions := make([]cloudhub.RenamableField, len(c.FieldOptions))
		for i, field := range c.FieldOptions {
			fieldOptions[i] = cloudhub.RenamableField{}
			fieldOptions[i].InternalName = field.InternalName
			fieldOptions[i].DisplayName = field.DisplayName
			fieldOptions[i].Visible = field.Visible
			fieldOptions[i].Direction = field.Direction
			fieldOptions[i].TempVar = field.TempVar
		}

		decimalPlaces := cloudhub.DecimalPlaces{}
		if c.DecimalPlaces != nil {
			decimalPlaces.IsEnforced = c.DecimalPlaces.IsEnforced
			decimalPlaces.Digits = c.DecimalPlaces.Digits
		} else {
			decimalPlaces.IsEnforced = true
			decimalPlaces.Digits = 2
		}

		graphOptions := cloudhub.GraphOptions{}
		if c.GraphOptions != nil {
			graphOptions.FillArea = c.GraphOptions.FillArea
			graphOptions.ShowLine = c.GraphOptions.ShowLine
			graphOptions.ShowPoint = c.GraphOptions.ShowPoint
			graphOptions.ShowTempVarCount = c.GraphOptions.ShowTempVarCount
		} else {
			graphOptions.FillArea = true
			graphOptions.ShowLine = true
			graphOptions.ShowPoint = false
			graphOptions.ShowTempVarCount = ""
		}

		note := c.Note
		noteVisibility := c.NoteVisibility

		// FIXME: this is merely for legacy cells and
		//        should be removed as soon as possible
		cellType := c.Type
		if cellType == "" {
			cellType = "line"
		}

		cells[i] = cloudhub.DashboardCell{
			ID:             c.ID,
			X:              c.X,
			Y:              c.Y,
			W:              c.W,
			H:              c.H,
			MinW:           c.MinW,
			MinH:           c.MinH,
			Name:           c.Name,
			Queries:        queries,
			Type:           cellType,
			Axes:           axes,
			CellColors:     colors,
			Legend:         legend,
			TableOptions:   tableOptions,
			FieldOptions:   fieldOptions,
			TimeFormat:     c.TimeFormat,
			DecimalPlaces:  decimalPlaces,
			Note:           note,
			NoteVisibility: noteVisibility,
			GraphOptions:   graphOptions,
		}
	}

	templates := make([]cloudhub.Template, len(pb.Templates))
	for i, t := range pb.Templates {
		vals := make([]cloudhub.TemplateValue, len(t.Values))
		for j, v := range t.Values {
			vals[j] = cloudhub.TemplateValue{
				Selected: v.Selected,
				Type:     v.Type,
				Value:    v.Value,
				Key:      v.Key,
			}
		}

		template := cloudhub.Template{
			ID: cloudhub.TemplateID(t.ID),
			TemplateVar: cloudhub.TemplateVar{
				Var:    t.TempVar,
				Values: vals,
			},
			Type:  t.Type,
			Label: t.Label,
		}

		if t.Query != nil {
			template.Query = &cloudhub.TemplateQuery{
				Command:     t.Query.Command,
				Flux:        t.Query.Flux,
				DB:          t.Query.Db,
				RP:          t.Query.Rp,
				Measurement: t.Query.Measurement,
				TagKey:      t.Query.TagKey,
				FieldKey:    t.Query.FieldKey,
			}
		}
		templates[i] = template
	}

	d.ID = cloudhub.DashboardID(pb.ID)
	d.Cells = cells
	d.Templates = templates
	d.Name = pb.Name
	d.Organization = pb.Organization
	return nil
}

// ScopedAlert contains the source and the kapacitor id
type ScopedAlert struct {
	cloudhub.AlertRule
	SrcID  int
	KapaID int
}

// MarshalAlertRule encodes an alert rule to binary protobuf format.
func MarshalAlertRule(r *ScopedAlert) ([]byte, error) {
	j, err := json.Marshal(r.AlertRule)
	if err != nil {
		return nil, err
	}
	return proto.Marshal(&AlertRule{
		ID:     r.ID,
		SrcID:  int64(r.SrcID),
		KapaID: int64(r.KapaID),
		JSON:   string(j),
	})
}

// UnmarshalAlertRule decodes an alert rule from binary protobuf data.
func UnmarshalAlertRule(data []byte, r *ScopedAlert) error {
	var pb AlertRule
	if err := proto.Unmarshal(data, &pb); err != nil {
		return err
	}

	err := json.Unmarshal([]byte(pb.JSON), &r.AlertRule)
	if err != nil {
		return err
	}
	r.SrcID = int(pb.SrcID)
	r.KapaID = int(pb.KapaID)
	return nil
}

// MarshalUser encodes a user to binary protobuf format.
// We are ignoring the password for now.
func MarshalUser(u *cloudhub.User) ([]byte, error) {
	roles := make([]*Role, len(u.Roles))
	for i, role := range u.Roles {
		roles[i] = &Role{
			Organization: role.Organization,
			Name:         role.Name,
		}
	}
	return MarshalUserPB(&User{
		ID:                 u.ID,
		Name:               u.Name,
		Provider:           u.Provider,
		Scheme:             u.Scheme,
		Roles:              roles,
		SuperAdmin:         u.SuperAdmin,
		Password:           u.Passwd,
		PasswordResetFlag:  u.PasswordResetFlag,
		PasswordUpdateDate: u.PasswordUpdateDate,
		Email:              u.Email,
		RetryCount:         u.RetryCount,
		LockedTime:         u.LockedTime,
		Locked:             u.Locked,
	})
}

// MarshalUserPB encodes a user to binary protobuf format.
// We are ignoring the password for now.
func MarshalUserPB(u *User) ([]byte, error) {
	return proto.Marshal(u)
}

// UnmarshalUser decodes a user from binary protobuf data.
// We are ignoring the password for now.
func UnmarshalUser(data []byte, u *cloudhub.User) error {
	var pb User
	if err := UnmarshalUserPB(data, &pb); err != nil {
		return err
	}
	roles := make([]cloudhub.Role, len(pb.Roles))
	for i, role := range pb.Roles {
		roles[i] = cloudhub.Role{
			Organization: role.Organization,
			Name:         role.Name,
		}
	}
	u.ID = pb.ID
	u.Name = pb.Name
	u.Provider = pb.Provider
	u.Scheme = pb.Scheme
	u.SuperAdmin = pb.SuperAdmin
	u.Roles = roles
	u.Passwd = pb.Password
	u.PasswordResetFlag = pb.PasswordResetFlag
	u.PasswordUpdateDate = pb.PasswordUpdateDate
	u.Email = pb.Email
	u.RetryCount = pb.RetryCount
	u.LockedTime = pb.LockedTime
	u.Locked = pb.Locked

	return nil
}

// UnmarshalUserPB decodes a user from binary protobuf data.
// We are ignoring the password for now.
func UnmarshalUserPB(data []byte, u *User) error {
	return proto.Unmarshal(data, u)
}

// MarshalRole encodes a role to binary protobuf format.
func MarshalRole(r *cloudhub.Role) ([]byte, error) {
	return MarshalRolePB(&Role{
		Organization: r.Organization,
		Name:         r.Name,
	})
}

// MarshalRolePB encodes a role to binary protobuf format.
func MarshalRolePB(r *Role) ([]byte, error) {
	return proto.Marshal(r)
}

// UnmarshalRole decodes a role from binary protobuf data.
func UnmarshalRole(data []byte, r *cloudhub.Role) error {
	var pb Role
	if err := UnmarshalRolePB(data, &pb); err != nil {
		return err
	}
	r.Organization = pb.Organization
	r.Name = pb.Name

	return nil
}

// UnmarshalRolePB decodes a role from binary protobuf data.
func UnmarshalRolePB(data []byte, r *Role) error {
	return proto.Unmarshal(data, r)
}

// MarshalOrganization encodes a organization to binary protobuf format.
func MarshalOrganization(o *cloudhub.Organization) ([]byte, error) {

	return MarshalOrganizationPB(&Organization{
		ID:          o.ID,
		Name:        o.Name,
		DefaultRole: o.DefaultRole,
	})
}

// MarshalOrganizationPB encodes a organization to binary protobuf format.
func MarshalOrganizationPB(o *Organization) ([]byte, error) {
	return proto.Marshal(o)
}

// UnmarshalOrganization decodes a organization from binary protobuf data.
func UnmarshalOrganization(data []byte, o *cloudhub.Organization) error {
	var pb Organization
	if err := UnmarshalOrganizationPB(data, &pb); err != nil {
		return err
	}
	o.ID = pb.ID
	o.Name = pb.Name
	o.DefaultRole = pb.DefaultRole

	return nil
}

// UnmarshalOrganizationPB decodes a organization from binary protobuf data.
func UnmarshalOrganizationPB(data []byte, o *Organization) error {
	return proto.Unmarshal(data, o)
}

// MarshalConfig encodes a config to binary protobuf format.
func MarshalConfig(c *cloudhub.Config) ([]byte, error) {
	return MarshalConfigPB(&Config{
		Auth: &AuthConfig{
			SuperAdminNewUsers: c.Auth.SuperAdminNewUsers,
		},
	})
}

// MarshalConfigPB encodes a config to binary protobuf format.
func MarshalConfigPB(c *Config) ([]byte, error) {
	return proto.Marshal(c)
}

// UnmarshalConfig decodes a config from binary protobuf data.
func UnmarshalConfig(data []byte, c *cloudhub.Config) error {
	var pb Config
	if err := UnmarshalConfigPB(data, &pb); err != nil {
		return err
	}
	if pb.Auth == nil {
		return fmt.Errorf("Auth config is nil")
	}
	c.Auth.SuperAdminNewUsers = pb.Auth.SuperAdminNewUsers

	return nil
}

// UnmarshalConfigPB decodes a config from binary protobuf data.
func UnmarshalConfigPB(data []byte, c *Config) error {
	return proto.Unmarshal(data, c)
}

// MarshalOrganizationConfig encodes a config to binary protobuf format.
func MarshalOrganizationConfig(c *cloudhub.OrganizationConfig) ([]byte, error) {
	columns := make([]*LogViewerColumn, len(c.LogViewer.Columns))

	for i, column := range c.LogViewer.Columns {
		encodings := make([]*ColumnEncoding, len(column.Encodings))

		for j, e := range column.Encodings {
			encodings[j] = &ColumnEncoding{
				Type:  e.Type,
				Value: e.Value,
				Name:  e.Name,
			}
		}

		columns[i] = &LogViewerColumn{
			Name:      column.Name,
			Position:  column.Position,
			Encodings: encodings,
		}
	}

	return MarshalOrganizationConfigPB(&OrganizationConfig{
		OrganizationID: c.OrganizationID,
		LogViewer: &LogViewerConfig{
			Columns: columns,
		},
	})
}

// MarshalOrganizationConfigPB encodes a config to binary protobuf format.
func MarshalOrganizationConfigPB(c *OrganizationConfig) ([]byte, error) {
	return proto.Marshal(c)
}

// UnmarshalOrganizationConfig decodes a config from binary protobuf data.
func UnmarshalOrganizationConfig(data []byte, c *cloudhub.OrganizationConfig) error {
	var pb OrganizationConfig

	if err := UnmarshalOrganizationConfigPB(data, &pb); err != nil {
		return err
	}

	if pb.LogViewer == nil {
		return fmt.Errorf("Log Viewer config is nil")
	}

	c.OrganizationID = pb.OrganizationID

	columns := make([]cloudhub.LogViewerColumn, len(pb.LogViewer.Columns))

	for i, c := range pb.LogViewer.Columns {
		columns[i].Name = c.Name
		columns[i].Position = c.Position

		encodings := make([]cloudhub.ColumnEncoding, len(c.Encodings))
		for j, e := range c.Encodings {
			encodings[j].Type = e.Type
			encodings[j].Value = e.Value
			encodings[j].Name = e.Name
		}

		columns[i].Encodings = encodings
	}

	c.LogViewer.Columns = columns

	ensureHostnameColumn(c)

	return nil
}

// Ensures the hostname is added since it was missing in 1.6.2
func ensureHostnameColumn(c *cloudhub.OrganizationConfig) {
	var maxPosition int32

	for _, v := range c.LogViewer.Columns {
		if v.Name == "hostname" {
			return
		}

		if v.Position > maxPosition {
			maxPosition = v.Position
		}
	}

	c.LogViewer.Columns = append(c.LogViewer.Columns, newHostnameColumn(maxPosition+1))
}

func newHostnameColumn(p int32) cloudhub.LogViewerColumn {
	return cloudhub.LogViewerColumn{
		Name:     "hostname",
		Position: p,
		Encodings: []cloudhub.ColumnEncoding{
			{
				Type:  "visibility",
				Value: "visible",
			},
		},
	}
}

// UnmarshalOrganizationConfigPB decodes a config from binary protobuf data.
func UnmarshalOrganizationConfigPB(data []byte, c *OrganizationConfig) error {
	return proto.Unmarshal(data, c)
}

// MarshalMapping encodes a mapping to binary protobuf format.
func MarshalMapping(m *cloudhub.Mapping) ([]byte, error) {

	return MarshalMappingPB(&Mapping{
		Provider:             m.Provider,
		Scheme:               m.Scheme,
		ProviderOrganization: m.ProviderOrganization,
		ID:                   m.ID,
		Organization:         m.Organization,
	})
}

// MarshalMappingPB encodes a mapping to binary protobuf format.
func MarshalMappingPB(m *Mapping) ([]byte, error) {
	return proto.Marshal(m)
}

// UnmarshalMapping decodes a mapping from binary protobuf data.
func UnmarshalMapping(data []byte, m *cloudhub.Mapping) error {
	var pb Mapping
	if err := UnmarshalMappingPB(data, &pb); err != nil {
		return err
	}

	m.Provider = pb.Provider
	m.Scheme = pb.Scheme
	m.ProviderOrganization = pb.ProviderOrganization
	m.Organization = pb.Organization
	m.ID = pb.ID

	return nil
}

// UnmarshalMappingPB decodes a mapping from binary protobuf data.
func UnmarshalMappingPB(data []byte, m *Mapping) error {
	return proto.Unmarshal(data, m)
}

// MarshalVsphere encodes a vsphere to binary protobuf format.
// We are ignoring the password for now.
func MarshalVsphere(v cloudhub.Vsphere) ([]byte, error) {
	return proto.Marshal(&Vsphere{
		ID:           v.ID,
		Host:         v.Host,
		UserName:     v.UserName,
		Password:     v.Password,
		Protocol:     v.Protocol,
		Port:         int64(v.Port),
		Interval:     int64(v.Interval),
		Minion:       v.Minion,
		Organization: v.Organization,
		DataSource:   v.DataSource,
	})
}

// UnmarshalVsphere decodes a vsphere from binary protobuf data.
func UnmarshalVsphere(data []byte, v *cloudhub.Vsphere) error {
	var pb Vsphere
	if err := proto.Unmarshal(data, &pb); err != nil {
		return err
	}

	v.ID = pb.ID
	v.Host = pb.Host
	v.UserName = pb.UserName
	v.Password = pb.Password
	v.Protocol = pb.Protocol
	v.Port = int(pb.Port)
	v.Interval = int(pb.Interval)
	v.Minion = pb.Minion
	v.Organization = pb.Organization
	v.DataSource = pb.DataSource

	return nil
}

// MarshalTopology encodes a mapping to binary protobuf format.
func MarshalTopology(t *cloudhub.Topology) ([]byte, error) {
	return proto.Marshal(&Topology{
		ID:           t.ID,
		Organization: t.Organization,
		Diagram:      t.Diagram,
		Preferences:  t.Preferences,
	})
}

// UnmarshalTopology decodes a mapping from binary protobuf data.
func UnmarshalTopology(data []byte, t *cloudhub.Topology) error {
	var pb Topology
	if err := proto.Unmarshal(data, &pb); err != nil {
		return err
	}

	t.ID = pb.ID
	t.Organization = pb.Organization
	t.Diagram = pb.Diagram
	t.Preferences = pb.Preferences

	return nil
}

// MarshalCSP encodes a mapping to binary protobuf format.
func MarshalCSP(t *cloudhub.CSP) ([]byte, error) {
	return proto.Marshal(&CSP{
		ID:           t.ID,
		Provider:     t.Provider,
		NameSpace:    t.NameSpace,
		AccessKey:    t.AccessKey,
		SecretKey:    t.SecretKey,
		Organization: t.Organization,
		Minion:       t.Minion,
	})
}

// UnmarshalCSP decodes a mapping from binary protobuf data.
func UnmarshalCSP(data []byte, t *cloudhub.CSP) error {
	var pb CSP
	if err := proto.Unmarshal(data, &pb); err != nil {
		return err
	}

	t.ID = pb.ID
	t.Provider = pb.Provider
	t.NameSpace = pb.NameSpace
	t.AccessKey = pb.AccessKey
	t.SecretKey = pb.SecretKey
	t.Organization = pb.Organization
	t.Minion = pb.Minion

	return nil
}

// MarshalNetworkDevice encodes a Device struct to binary protobuf format.
func MarshalNetworkDevice(t *cloudhub.NetworkDevice) ([]byte, error) {
	return proto.Marshal(&NetworkDevice{
		ID:              t.ID,
		Organization:    t.Organization,
		DeviceIP:        t.DeviceIP,
		Hostname:        t.Hostname,
		DeviceType:      t.DeviceType,
		DeviceCategory:  t.DeviceCategory,
		DeviceOS:        t.DeviceOS,
		IsConfigWritten: t.IsConfigWritten,
		SSHConfig: &SSHConfig{
			SSHUserID:     t.SSHConfig.SSHUserID,
			SSHPassword:   t.SSHConfig.SSHPassword,
			SSHEnPassword: t.SSHConfig.SSHEnPassword,
			SSHPort:       int32(t.SSHConfig.SSHPort),
		},
		SNMPConfig: &SNMPConfig{
			SNMPCommunity: t.SNMPConfig.SNMPCommunity,
			SNMPVersion:   t.SNMPConfig.SNMPVersion,
			SNMPPort:      int32(t.SNMPConfig.SNMPPort),
			SNMPProtocol:  t.SNMPConfig.SNMPProtocol,
		},
		Sensitivity:        float32(t.Sensitivity),
		DeviceVendor:       t.DeviceVendor,
		LearningState:      t.LearningState,
		LearningUpdateDate: t.LearningUpdateDate,
	})
}

// UnmarshalNetworkDevice decodes a Device from binary protobuf data.
func UnmarshalNetworkDevice(data []byte, t *cloudhub.NetworkDevice) error {
	var pb NetworkDevice
	if err := proto.Unmarshal(data, &pb); err != nil {
		return err
	}
	t.ID = pb.ID
	t.Organization = pb.Organization
	t.DeviceIP = pb.DeviceIP
	t.Hostname = pb.Hostname
	t.DeviceType = pb.DeviceType
	t.DeviceCategory = pb.DeviceCategory
	t.DeviceOS = pb.DeviceOS
	t.IsConfigWritten = pb.IsConfigWritten
	t.SSHConfig = cloudhub.SSHConfig{
		SSHUserID:     pb.SSHConfig.SSHUserID,
		SSHPassword:   pb.SSHConfig.SSHPassword,
		SSHEnPassword: pb.SSHConfig.SSHEnPassword,
		SSHPort:       int(pb.SSHConfig.SSHPort),
	}
	t.SNMPConfig = cloudhub.SNMPConfig{
		SNMPCommunity: pb.SNMPConfig.SNMPCommunity,
		SNMPVersion:   pb.SNMPConfig.SNMPVersion,
		SNMPPort:      int(pb.SNMPConfig.SNMPPort),
		SNMPProtocol:  pb.SNMPConfig.SNMPProtocol,
	}
	t.Sensitivity = pb.Sensitivity
	t.DeviceVendor = pb.DeviceVendor
	t.LearningState = pb.LearningState
	t.LearningUpdateDate = pb.LearningUpdateDate

	return nil
}

// MarshalNetworkDeviceOrg encodes a networkDeviceOrg struct to binary protobuf format.
func MarshalNetworkDeviceOrg(t *cloudhub.NetworkDeviceOrg) ([]byte, error) {
	return proto.Marshal(&NetworkDeviceOrg{
		ID:              t.ID,
		LoadModule:      t.LoadModule,
		MLFunction:      t.MLFunction,
		DataDuration:    int32(t.DataDuration),
		LearnCycle:      int32(t.LearnCycle),
		DevicesIDs:      t.DevicesIDs,
		CollectorServer: t.CollectorServer,
	})
}

// UnmarshalNetworkDeviceOrg decodes a networkDeviceOrg from binary protobuf data.
func UnmarshalNetworkDeviceOrg(data []byte, t *cloudhub.NetworkDeviceOrg) error {
	var pb NetworkDeviceOrg
	if err := proto.Unmarshal(data, &pb); err != nil {
		return err
	}
	t.ID = pb.ID
	t.LoadModule = pb.LoadModule
	t.MLFunction = pb.MLFunction
	t.DataDuration = int(pb.DataDuration)
	t.LearnCycle = int(pb.LearnCycle)
	t.DevicesIDs = pb.DevicesIDs
	t.CollectorServer = pb.CollectorServer

	return nil
}
