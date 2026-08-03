package mocks

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Ensure OrgNavMenuStore implements cloudhub.OrgNavMenuStore at compile time.
var _ cloudhub.OrgNavMenuStore = (*OrgNavMenuStore)(nil)

// OrgNavMenuStore is a mock implementation of cloudhub.OrgNavMenuStore.
type OrgNavMenuStore struct {
	GetByOrgIDF           func(ctx context.Context, orgID string) (*cloudhub.OrgNavMenu, error)
	UpsertF               func(ctx context.Context, menu *cloudhub.OrgNavMenu) (*cloudhub.OrgNavMenu, error)
	PatchF                func(ctx context.Context, orgID string, items []cloudhub.OrgNavMenuItem) (*cloudhub.OrgNavMenu, error)
	DeleteF               func(ctx context.Context, orgID string) error
	GetMasterMenuF        func(ctx context.Context) ([]cloudhub.MasterNavMenuItem, error)
	UpdateMasterMenuF     func(ctx context.Context, items []cloudhub.OrgNavMenuItem) error
	DeleteMasterMenuItemF func(ctx context.Context, itemID string) error
}

func (m *OrgNavMenuStore) GetByOrgID(ctx context.Context, orgID string) (*cloudhub.OrgNavMenu, error) {
	if m.GetByOrgIDF != nil {
		return m.GetByOrgIDF(ctx, orgID)
	}
	return nil, cloudhub.ErrOrgNavMenuNotFound
}

func (m *OrgNavMenuStore) Upsert(ctx context.Context, menu *cloudhub.OrgNavMenu) (*cloudhub.OrgNavMenu, error) {
	if m.UpsertF != nil {
		return m.UpsertF(ctx, menu)
	}
	return nil, cloudhub.ErrOrgNavMenuNotFound
}

func (m *OrgNavMenuStore) Patch(ctx context.Context, orgID string, items []cloudhub.OrgNavMenuItem) (*cloudhub.OrgNavMenu, error) {
	if m.PatchF != nil {
		return m.PatchF(ctx, orgID, items)
	}
	return nil, cloudhub.ErrOrgNavMenuNotFound
}

func (m *OrgNavMenuStore) Delete(ctx context.Context, orgID string) error {
	if m.DeleteF != nil {
		return m.DeleteF(ctx, orgID)
	}
	return cloudhub.ErrOrgNavMenuNotFound
}

func (m *OrgNavMenuStore) GetMasterMenu(ctx context.Context) ([]cloudhub.MasterNavMenuItem, error) {
	if m.GetMasterMenuF != nil {
		return m.GetMasterMenuF(ctx)
	}
	return nil, cloudhub.ErrOrgNavMenuNotFound
}

func (m *OrgNavMenuStore) UpdateMasterMenu(ctx context.Context, items []cloudhub.OrgNavMenuItem) error {
	if m.UpdateMasterMenuF != nil {
		return m.UpdateMasterMenuF(ctx, items)
	}
	return nil
}

func (m *OrgNavMenuStore) DeleteMasterMenuItem(ctx context.Context, itemID string) error {
	if m.DeleteMasterMenuItemF != nil {
		return m.DeleteMasterMenuItemF(ctx, itemID)
	}
	return nil
}
