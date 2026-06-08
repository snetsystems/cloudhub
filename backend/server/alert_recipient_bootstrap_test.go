package server

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/log"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

type memRecipientGroupStore struct {
	groups  []cloudhub.RecipientGroup
	members map[string][]cloudhub.RecipientGroupMember
	nextID  int
}

func (s *memRecipientGroupStore) All(ctx context.Context, orgID string) ([]cloudhub.RecipientGroup, error) {
	var out []cloudhub.RecipientGroup
	for _, g := range s.groups {
		if g.OrgID == orgID && !g.DeleteYN {
			g.Members = append([]cloudhub.RecipientGroupMember(nil), s.members[g.ID]...)
			out = append(out, g)
		}
	}
	return out, nil
}

func (s *memRecipientGroupStore) Get(ctx context.Context, id string) (cloudhub.RecipientGroup, error) {
	for _, g := range s.groups {
		if g.ID == id {
			g.Members = append([]cloudhub.RecipientGroupMember(nil), s.members[g.ID]...)
			return g, nil
		}
	}
	return cloudhub.RecipientGroup{}, cloudhub.ErrRecipientGroupNotFound
}

func (s *memRecipientGroupStore) Add(ctx context.Context, g cloudhub.RecipientGroup) (cloudhub.RecipientGroup, error) {
	s.nextID++
	g.ID = "rg-" + strconv.Itoa(s.nextID)
	if g.IsDefault {
		for i := range s.groups {
			if s.groups[i].OrgID == g.OrgID {
				s.groups[i].IsDefault = false
			}
		}
	}
	s.groups = append(s.groups, g)
	s.members[g.ID] = nil
	return g, nil
}

func (s *memRecipientGroupStore) MarkAsDefault(ctx context.Context, orgID, groupID string) error {
	found := false
	for i := range s.groups {
		if s.groups[i].OrgID == orgID {
			s.groups[i].IsDefault = s.groups[i].ID == groupID
		}
		if s.groups[i].ID == groupID {
			found = true
		}
	}
	if !found {
		return cloudhub.ErrRecipientGroupNotFound
	}
	return nil
}

func (s *memRecipientGroupStore) Update(ctx context.Context, g cloudhub.RecipientGroup) error {
	return nil
}

func (s *memRecipientGroupStore) Delete(ctx context.Context, id string) error {
	return nil
}

func (s *memRecipientGroupStore) AddMember(ctx context.Context, m cloudhub.RecipientGroupMember) (cloudhub.RecipientGroupMember, error) {
	s.nextID++
	m.ID = "m-" + strconv.Itoa(s.nextID)
	s.members[m.RecipientGroupID] = append(s.members[m.RecipientGroupID], m)
	return m, nil
}

func (s *memRecipientGroupStore) UpdateMember(ctx context.Context, m cloudhub.RecipientGroupMember) error {
	members := s.members[m.RecipientGroupID]
	for i := range members {
		if members[i].ID == m.ID {
			members[i].UserName = m.UserName
			members[i].Email = m.Email
			members[i].PhoneNumber = m.PhoneNumber
			s.members[m.RecipientGroupID] = members
			return nil
		}
	}
	return nil
}

func (s *memRecipientGroupStore) DeleteMember(ctx context.Context, memberID string) error {
	for gid, members := range s.members {
		for i, m := range members {
			if m.ID == memberID {
				s.members[gid] = append(members[:i], members[i+1:]...)
				return nil
			}
		}
	}
	return nil
}

func (s *memRecipientGroupStore) Members(ctx context.Context, groupID string) ([]cloudhub.RecipientGroupMember, error) {
	return append([]cloudhub.RecipientGroupMember(nil), s.members[groupID]...), nil
}

func (s *memRecipientGroupStore) MembersByUserID(ctx context.Context, orgID, userID string) ([]cloudhub.RecipientGroupMember, error) {
	return nil, nil
}

type memAlertRecipientGroupStore struct {
	ext map[string]cloudhub.AlertRecipientGroup
}

func (s *memAlertRecipientGroupStore) Get(ctx context.Context, id string) (cloudhub.AlertRecipientGroup, error) {
	if ext, ok := s.ext[id]; ok {
		return ext, nil
	}
	return cloudhub.AlertRecipientGroup{}, errors.New("not found")
}

func (s *memAlertRecipientGroupStore) Upsert(ctx context.Context, ext cloudhub.AlertRecipientGroup) error {
	if s.ext == nil {
		s.ext = map[string]cloudhub.AlertRecipientGroup{}
	}
	s.ext[ext.RecipientGroupID] = ext
	return nil
}

func (s *memAlertRecipientGroupStore) Delete(ctx context.Context, id string) error {
	delete(s.ext, id)
	return nil
}

type memAlertRecipientMemberPrefsStore struct {
	prefs map[string]cloudhub.AlertRecipientMemberPrefs
}

func (s *memAlertRecipientMemberPrefsStore) Get(ctx context.Context, memberID string) (cloudhub.AlertRecipientMemberPrefs, error) {
	if p, ok := s.prefs[memberID]; ok {
		return p, nil
	}
	return cloudhub.AlertRecipientMemberPrefs{}, errors.New("not found")
}

func (s *memAlertRecipientMemberPrefsStore) Upsert(ctx context.Context, p cloudhub.AlertRecipientMemberPrefs) error {
	if s.prefs == nil {
		s.prefs = map[string]cloudhub.AlertRecipientMemberPrefs{}
	}
	s.prefs[p.RecipientGroupMemberID] = p
	return nil
}

func (s *memAlertRecipientMemberPrefsStore) UpsertBulk(ctx context.Context, prefs []cloudhub.AlertRecipientMemberPrefs) error {
	for _, p := range prefs {
		if err := s.Upsert(ctx, p); err != nil {
			return err
		}
	}
	return nil
}

func (s *memAlertRecipientMemberPrefsStore) Delete(ctx context.Context, memberID string) error {
	delete(s.prefs, memberID)
	return nil
}

func (s *memAlertRecipientMemberPrefsStore) ByGroup(ctx context.Context, groupID string) ([]cloudhub.AlertRecipientMemberPrefs, error) {
	return nil, nil
}

func TestEnsureDefaultRecipientGroupForOrg(t *testing.T) {
	t.Parallel()

	allUsers := []cloudhub.User{
		{
			ID:    1,
			Name:  "Alice",
			Email: "alice@example.com",
			Roles: []cloudhub.Role{{Organization: "org-1", Name: "admin"}},
		},
		{
			ID:    2,
			Name:  "Bob",
			Email: "",
			Roles: []cloudhub.Role{{Organization: "org-1", Name: "viewer"}},
		},
		{
			ID:    3,
			Name:  "Carol",
			Email: "carol@example.com",
			Roles: []cloudhub.Role{{Organization: "org-1", Name: "editor"}},
		},
	}

	tests := []struct {
		name           string
		initialGroups  []cloudhub.RecipientGroup
		wantGroupCount int
		wantMembers    int
		wantExt        bool
		wantPrefs      int
	}{
		{
			name:           "creates default group and members when org has none",
			initialGroups:  nil,
			wantGroupCount: 1,
			wantMembers:    3,
			wantExt:        true,
			wantPrefs:      3,
		},
		{
			name: "creates default group even when org already has other groups",
			initialGroups: []cloudhub.RecipientGroup{
				{ID: "existing", OrgID: "org-1", Name: "Ops"},
			},
			wantGroupCount: 2,
			wantMembers:    3,
			wantExt:        true,
			wantPrefs:      3,
		},
		{
			name: "syncs new users into existing default group",
			initialGroups: []cloudhub.RecipientGroup{
				{
					ID: "default", OrgID: "org-1", Name: "Acme Ops", IsDefault: true,
				},
			},
			wantGroupCount: 1,
			wantMembers:    3,
			wantExt:        true,
			wantPrefs:      3,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			ctx := serverContext(context.Background())
			rgStore := &memRecipientGroupStore{
				groups:  append([]cloudhub.RecipientGroup(nil), tt.initialGroups...),
				members: map[string][]cloudhub.RecipientGroupMember{},
			}
			for _, g := range tt.initialGroups {
				if g.ID != "" {
					rgStore.members[g.ID] = append([]cloudhub.RecipientGroupMember(nil), g.Members...)
				}
			}
			extStore := &memAlertRecipientGroupStore{ext: map[string]cloudhub.AlertRecipientGroup{}}
			prefsStore := &memAlertRecipientMemberPrefsStore{prefs: map[string]cloudhub.AlertRecipientMemberPrefs{}}

			svc := &Service{
				Store: &Store{
					OrganizationsStore: &mocks.OrganizationsStore{
						GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
							return &cloudhub.Organization{ID: "org-1", Name: "Acme Ops"}, nil
						},
					},
					UsersStore: &mocks.UsersStore{
						AllF: func(ctx context.Context) ([]cloudhub.User, error) {
							return allUsers, nil
						},
					},
				},
				RecipientGroups:           rgStore,
				AlertRecipientGroups:      extStore,
				AlertRecipientMemberPrefs: prefsStore,
				Logger:                    log.New(log.DebugLevel),
			}

			if err := ensureDefaultRecipientGroupForOrg(ctx, svc, "org-1", svc.Logger); err != nil {
				t.Fatalf("ensureDefaultRecipientGroupForOrg: %v", err)
			}

			groups, err := rgStore.All(ctx, "org-1")
			if err != nil {
				t.Fatalf("All: %v", err)
			}
			if len(groups) != tt.wantGroupCount {
				t.Fatalf("group count = %d, want %d", len(groups), tt.wantGroupCount)
			}
			if tt.wantMembers == 0 {
				return
			}

			var defaultGroup cloudhub.RecipientGroup
			for _, g := range groups {
				if g.IsDefault {
					defaultGroup = g
					break
				}
			}
			if defaultGroup.ID == "" {
				t.Fatal("default group not found")
			}
			if tt.wantGroupCount > len(tt.initialGroups) && defaultGroup.Name != "Acme Ops" {
				t.Fatalf("default group name = %q, want %q", defaultGroup.Name, "Acme Ops")
			}
			if len(defaultGroup.Members) != tt.wantMembers {
				t.Fatalf("member count = %d, want %d", len(defaultGroup.Members), tt.wantMembers)
			}
			if tt.wantExt {
				if _, err := extStore.Get(ctx, defaultGroup.ID); err != nil {
					t.Fatalf("alert extension missing: %v", err)
				}
			}
			if len(prefsStore.prefs) != tt.wantPrefs {
				t.Fatalf("prefs count = %d, want %d", len(prefsStore.prefs), tt.wantPrefs)
			}
			for _, m := range defaultGroup.Members {
				p, ok := prefsStore.prefs[m.ID]
				if !ok || p.EmailLevel != "all" {
					t.Fatalf("unexpected prefs for member %s: %+v", m.ID, p)
				}
				wantEnabled := strings.TrimSpace(m.Email) != ""
				if p.EmailEnabled != wantEnabled {
					t.Fatalf("member %s emailEnabled=%v, want %v", m.ID, p.EmailEnabled, wantEnabled)
				}
			}
		})
	}
}

func TestSyncDefaultRecipientGroupMembers_RemovesDepartedUsers(t *testing.T) {
	t.Parallel()
	ctx := serverContext(context.Background())
	rgStore := &memRecipientGroupStore{
		groups: []cloudhub.RecipientGroup{
			{ID: "default", OrgID: "org-1", Name: "Acme Ops", IsDefault: true},
		},
		members: map[string][]cloudhub.RecipientGroupMember{
			"default": {
				{ID: "m-old", RecipientGroupID: "default", UserID: "99", UserName: "Gone", Email: "gone@example.com"},
			},
		},
	}
	svc := &Service{
		Store: &Store{
			OrganizationsStore: &mocks.OrganizationsStore{
				GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
					return &cloudhub.Organization{ID: "default", Name: "Default Org"}, nil
				},
			},
			UsersStore: &mocks.UsersStore{
				AllF: func(ctx context.Context) ([]cloudhub.User, error) {
					return []cloudhub.User{
						{
							ID:    1,
							Name:  "Alice",
							Email: "alice@example.com",
							Roles: []cloudhub.Role{{Organization: "org-1", Name: "admin"}},
						},
					}, nil
				},
			},
		},
		RecipientGroups:           rgStore,
		AlertRecipientMemberPrefs: &memAlertRecipientMemberPrefsStore{prefs: map[string]cloudhub.AlertRecipientMemberPrefs{}},
		Logger:                    log.New(log.DebugLevel),
	}

	group, _ := rgStore.Get(ctx, "default")
	result, err := syncDefaultRecipientGroupMembers(ctx, svc, "org-1", group)
	if err != nil {
		t.Fatalf("syncDefaultRecipientGroupMembers: %v", err)
	}
	if result.Removed != 1 || result.Added != 1 {
		t.Fatalf("sync result = %+v, want removed=1 added=1", result)
	}
	group, _ = rgStore.Get(ctx, "default")
	if len(group.Members) != 1 || group.Members[0].UserID != "1" {
		t.Fatalf("members after sync: %+v", group.Members)
	}
}

func TestSyncDefaultRecipientGroupMembers_UpdatesContactInfo(t *testing.T) {
	t.Parallel()
	ctx := serverContext(context.Background())
	rgStore := &memRecipientGroupStore{
		groups: []cloudhub.RecipientGroup{
			{ID: "default", OrgID: "org-1", Name: "Acme Ops", IsDefault: true},
		},
		members: map[string][]cloudhub.RecipientGroupMember{
			"default": {
				{ID: "m-1", RecipientGroupID: "default", UserID: "1", UserName: "OldName", Email: "old@example.com"},
			},
		},
	}
	svc := &Service{
		Store: &Store{
			UsersStore: &mocks.UsersStore{
				AllF: func(ctx context.Context) ([]cloudhub.User, error) {
					return []cloudhub.User{
						{
							ID:    1,
							Name:  "Alice",
							Email: "alice@example.com",
							Roles: []cloudhub.Role{{Organization: "org-1", Name: "admin"}},
						},
					}, nil
				},
			},
		},
		RecipientGroups: rgStore,
		Logger:          log.New(log.DebugLevel),
	}

	group, _ := rgStore.Get(ctx, "default")
	result, err := syncDefaultRecipientGroupMembers(ctx, svc, "org-1", group)
	if err != nil {
		t.Fatalf("syncDefaultRecipientGroupMembers: %v", err)
	}
	if result.Updated != 1 || result.Added != 0 {
		t.Fatalf("sync result = %+v, want updated=1", result)
	}
	group, _ = rgStore.Get(ctx, "default")
	if group.Members[0].UserName != "Alice" || group.Members[0].Email != "alice@example.com" {
		t.Fatalf("member not updated: %+v", group.Members[0])
	}
}

func TestSyncDefaultRecipientGroupsForUser_AddsOnCreate(t *testing.T) {
	t.Parallel()
	ctx := serverContext(context.Background())
	rgStore := &memRecipientGroupStore{members: map[string][]cloudhub.RecipientGroupMember{}}
	svc := &Service{
		Store: &Store{
			UsersStore: &mocks.UsersStore{
				AllF: func(ctx context.Context) ([]cloudhub.User, error) {
					return []cloudhub.User{
						{
							ID:    5,
							Name:  "Newbie",
							Email: "new@example.com",
							Roles: []cloudhub.Role{{Organization: "default", Name: "admin"}},
						},
					}, nil
				},
			},
		},
		RecipientGroups:           rgStore,
		AlertRecipientGroups:      &memAlertRecipientGroupStore{ext: map[string]cloudhub.AlertRecipientGroup{}},
		AlertRecipientMemberPrefs: &memAlertRecipientMemberPrefsStore{prefs: map[string]cloudhub.AlertRecipientMemberPrefs{}},
		Logger:                    log.New(log.DebugLevel),
	}

	user := &cloudhub.User{
		ID:    5,
		Name:  "Newbie",
		Email: "new@example.com",
		Roles: []cloudhub.Role{{Organization: "default", Name: "admin"}},
	}
	if err := svc.syncDefaultRecipientGroupsForUser(ctx, user); err != nil {
		t.Fatalf("syncDefaultRecipientGroupsForUser: %v", err)
	}
	groups, _ := rgStore.All(ctx, "default")
	if len(groups) != 1 || len(groups[0].Members) != 1 {
		t.Fatalf("expected default group with 1 member, got %+v", groups)
	}
}

func TestEnsureDefaultRecipientGroupForOrg_UsesOrgScopedUsers(t *testing.T) {
	t.Parallel()
	ctx := serverContext(context.Background())
	rgStore := &memRecipientGroupStore{members: map[string][]cloudhub.RecipientGroupMember{}}
	prefsStore := &memAlertRecipientMemberPrefsStore{prefs: map[string]cloudhub.AlertRecipientMemberPrefs{}}

	svc := &Service{
		Store: &Store{
			OrganizationsStore: &mocks.OrganizationsStore{
				GetF: func(ctx context.Context, q cloudhub.OrganizationQuery) (*cloudhub.Organization, error) {
					return &cloudhub.Organization{ID: "org-1", Name: "Acme Ops"}, nil
				},
			},
			UsersStore: organizations.NewUsersStore(&mocks.UsersStore{
				AllF: func(ctx context.Context) ([]cloudhub.User, error) {
					return []cloudhub.User{
						{
							ID:    10,
							Name:  "OtherOrg",
							Email: "other@example.com",
							Roles: []cloudhub.Role{{Organization: "other", Name: "admin"}},
						},
						{
							ID:    11,
							Name:  "InOrg",
							Email: "in@example.com",
							Roles: []cloudhub.Role{{Organization: "org-1", Name: "admin"}},
						},
					}, nil
				},
			}, "org-1"),
		},
		RecipientGroups:           rgStore,
		AlertRecipientGroups:      &memAlertRecipientGroupStore{ext: map[string]cloudhub.AlertRecipientGroup{}},
		AlertRecipientMemberPrefs: prefsStore,
		Logger:                    log.New(log.DebugLevel),
	}

	if err := ensureDefaultRecipientGroupForOrg(ctx, svc, "org-1", svc.Logger); err != nil {
		t.Fatalf("ensureDefaultRecipientGroupForOrg: %v", err)
	}
	groups, _ := rgStore.All(ctx, "org-1")
	if len(groups) != 1 || len(groups[0].Members) != 1 {
		t.Fatalf("expected 1 group with 1 member, got %+v", groups)
	}
	if groups[0].Members[0].Email != "in@example.com" {
		t.Fatalf("unexpected member email: %s", groups[0].Members[0].Email)
	}
}
