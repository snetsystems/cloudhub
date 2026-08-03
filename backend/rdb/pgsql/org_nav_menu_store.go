package pgsql

import (
	"context"
	"fmt"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb"
)

// Ensure OrgNavMenuStore implements cloudhub.OrgNavMenuStore at compile time.
var _ cloudhub.OrgNavMenuStore = (*OrgNavMenuStore)(nil)

// OrgNavMenuStore implements cloudhub.OrgNavMenuStore on top of PostgreSQL Client using normalized tables.
type OrgNavMenuStore struct {
	client *Client
}

// NewOrgNavMenuStore returns a OrgNavMenuStore backed by the given Client.
func NewOrgNavMenuStore(client *Client) *OrgNavMenuStore {
	return &OrgNavMenuStore{client: client}
}

type menuItemRow struct {
	ID        string
	ParentID  *string
	Label     string
	Icon      *string
	SortOrder int
	Enabled   bool
}

type masterItemRow struct {
	ID        string
	ParentID  *string
	Label     string
	Icon      *string
	SortOrder int
	DeleteYN  bool
}

// GetMasterMenu fetches ALL master menu items (including soft-deleted ones, delete_yn = true).
// Used by SuperAdmin to view the full master menu state and restore deleted items.
func (s *OrgNavMenuStore) GetMasterMenu(ctx context.Context) ([]cloudhub.MasterNavMenuItem, error) {
	const query = `
SELECT id, parent_id, label, icon, sort_order, delete_yn
FROM nav_menu_items
ORDER BY sort_order ASC`

	rows, err := s.client.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("get master menu query: %w", err)
	}
	defer rows.Close()

	var allRows []masterItemRow
	for rows.Next() {
		var row masterItemRow
		if err := rows.Scan(&row.ID, &row.ParentID, &row.Label, &row.Icon, &row.SortOrder, &row.DeleteYN); err != nil {
			return nil, fmt.Errorf("get master menu scan: %w", err)
		}
		allRows = append(allRows, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Build 2-tier tree (parents first, then attach children)
	parentMap := map[string]*cloudhub.MasterNavMenuItem{}
	var result []cloudhub.MasterNavMenuItem

	// First pass: collect parents (parent_id IS NULL)
	for _, row := range allRows {
		if row.ParentID == nil {
			icon := ""
			if row.Icon != nil {
				icon = *row.Icon
			}
			item := cloudhub.MasterNavMenuItem{
				ID:        row.ID,
				Label:     row.Label,
				Icon:      icon,
				SortOrder: row.SortOrder,
				DeleteYN:  row.DeleteYN,
				Children:  []cloudhub.MasterNavSubMenuItem{},
			}
			result = append(result, item)
			parentMap[row.ID] = &result[len(result)-1]
		}
	}

	// Second pass: attach children
	for _, row := range allRows {
		if row.ParentID != nil {
			if parent, ok := parentMap[*row.ParentID]; ok {
				parent.Children = append(parent.Children, cloudhub.MasterNavSubMenuItem{
					ID:        row.ID,
					Label:     row.Label,
					SortOrder: row.SortOrder,
					DeleteYN:  row.DeleteYN,
				})
			}
		}
	}

	return result, nil
}

// GetByOrgID fetches the menu items using a LEFT JOIN between nav_menu_items master and org_nav_permissions.
// If an org_id has no custom permission row for a menu item, enabled defaults to true.
// If a parent item is disabled, all its children are also treated as disabled (inherited).
func (s *OrgNavMenuStore) GetByOrgID(ctx context.Context, orgID string) (*cloudhub.OrgNavMenu, error) {
	if orgID == "" {
		return nil, fmt.Errorf("org_id is required")
	}

	const query = `
SELECT 
    m.id, 
    m.parent_id, 
    m.label, 
    m.icon, 
    m.sort_order,
    CASE
        WHEN m.parent_id IS NOT NULL AND COALESCE(pp.enabled, true) = false THEN false
        ELSE COALESCE(p.enabled, true)
    END AS enabled
FROM nav_menu_items m
LEFT JOIN org_nav_permissions p 
       ON m.id = p.menu_item_id AND p.org_id = $1 AND p.delete_yn = false
LEFT JOIN org_nav_permissions pp
       ON m.parent_id = pp.menu_item_id AND pp.org_id = $1 AND pp.delete_yn = false
WHERE m.delete_yn = false
ORDER BY m.sort_order ASC`

	rows, err := s.client.QueryContext(ctx, query, orgID)
	if err != nil {
		return nil, fmt.Errorf("org_nav_menu store query: %w", err)
	}
	defer rows.Close()

	var parentItems []cloudhub.OrgNavMenuItem
	childrenMap := make(map[string][]cloudhub.OrgNavSubMenuItem)
	parentMap := make(map[string]*cloudhub.OrgNavMenuItem)

	for rows.Next() {
		var r menuItemRow
		if err := rows.Scan(&r.ID, &r.ParentID, &r.Label, &r.Icon, &r.SortOrder, &r.Enabled); err != nil {
			return nil, fmt.Errorf("org_nav_menu store scan: %w", err)
		}

		if r.ParentID == nil {
			iconStr := ""
			if r.Icon != nil {
				iconStr = *r.Icon
			}
			item := cloudhub.OrgNavMenuItem{
				ID:        r.ID,
				Label:     r.Label,
				Icon:      iconStr,
				Enabled:   r.Enabled,
				SortOrder: r.SortOrder,
				Children:  []cloudhub.OrgNavSubMenuItem{},
			}
			parentItems = append(parentItems, item)
		} else {
			subItem := cloudhub.OrgNavSubMenuItem{
				ID:        r.ID,
				Label:     r.Label,
				Enabled:   r.Enabled,
				SortOrder: r.SortOrder,
			}
			childrenMap[*r.ParentID] = append(childrenMap[*r.ParentID], subItem)
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("org_nav_menu store rows error: %w", err)
	}

	// Assemble 2-tier tree structure
	for i := range parentItems {
		pID := parentItems[i].ID
		if kids, ok := childrenMap[pID]; ok {
			parentItems[i].Children = kids
		}
		parentMap[pID] = &parentItems[i]
	}

	now := time.Now()
	return &cloudhub.OrgNavMenu{
		OrgID:     orgID,
		NavItems:  parentItems,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

// Upsert saves org_nav_permissions for all items in the menu for a given org_id using a transaction.
func (s *OrgNavMenuStore) Upsert(ctx context.Context, menu *cloudhub.OrgNavMenu) (*cloudhub.OrgNavMenu, error) {
	if menu.OrgID == "" {
		return nil, fmt.Errorf("org_id is required")
	}

	err := s.client.WithTx(ctx, func(txCtx context.Context, txStore rdb.Store) error {
		const upsertStmt = `
INSERT INTO org_nav_permissions (org_id, menu_item_id, enabled, delete_yn, updated_at)
VALUES ($1, $2, $3, false, NOW())
ON CONFLICT (org_id, menu_item_id) 
DO UPDATE SET enabled = EXCLUDED.enabled, delete_yn = false, updated_at = NOW()`

		for _, item := range menu.NavItems {
			if _, err := s.client.ExecContext(txCtx, upsertStmt, menu.OrgID, item.ID, item.Enabled); err != nil {
				return fmt.Errorf("upsert parent permission (%s): %w", item.ID, err)
			}
			for _, child := range item.Children {
				if _, err := s.client.ExecContext(txCtx, upsertStmt, menu.OrgID, child.ID, child.Enabled); err != nil {
					return fmt.Errorf("upsert child permission (%s): %w", child.ID, err)
				}
			}
		}
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("org_nav_menu store upsert transaction: %w", err)
	}

	return s.GetByOrgID(ctx, menu.OrgID)
}



// Patch updates specific menu item permissions in org_nav_permissions for an org_id.
// All updates are wrapped in a transaction to prevent partial updates on failure.
func (s *OrgNavMenuStore) Patch(ctx context.Context, orgID string, patchItems []cloudhub.OrgNavMenuItem) (*cloudhub.OrgNavMenu, error) {
	if orgID == "" {
		return nil, fmt.Errorf("org_id is required")
	}

	const upsertStmt = `
INSERT INTO org_nav_permissions (org_id, menu_item_id, enabled, delete_yn, updated_at)
VALUES ($1, $2, $3, false, NOW())
ON CONFLICT (org_id, menu_item_id) 
DO UPDATE SET enabled = EXCLUDED.enabled, delete_yn = false, updated_at = NOW()`

	err := s.client.WithTx(ctx, func(txCtx context.Context, txStore rdb.Store) error {
		for _, item := range patchItems {
			if _, err := s.client.ExecContext(txCtx, upsertStmt, orgID, item.ID, item.Enabled); err != nil {
				return fmt.Errorf("patch parent permission (%s): %w", item.ID, err)
			}
			for _, child := range item.Children {
				if _, err := s.client.ExecContext(txCtx, upsertStmt, orgID, child.ID, child.Enabled); err != nil {
					return fmt.Errorf("patch child permission (%s): %w", child.ID, err)
				}
			}
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("org_nav_menu store patch transaction: %w", err)
	}

	return s.GetByOrgID(ctx, orgID)
}

// Delete soft-deletes (resets) all org_nav_permissions records for an org_id by setting delete_yn = true.
func (s *OrgNavMenuStore) Delete(ctx context.Context, orgID string) error {
	const q = `UPDATE org_nav_permissions SET delete_yn = true, updated_at = NOW() WHERE org_id = $1 AND delete_yn = false`

	res, err := s.client.ExecContext(ctx, q, orgID)
	if err != nil {
		return fmt.Errorf("org_nav_menu store delete: %w", err)
	}
	if res.RowsAffected() == 0 {
		return cloudhub.ErrOrgNavMenuNotFound
	}
	return nil
}

// UpdateMasterMenu allows SuperAdmin to update nav_menu_items master menu entries.
// sortOrder is used from item.SortOrder if > 0, otherwise falls back to index-based (idx+1)*10.
func (s *OrgNavMenuStore) UpdateMasterMenu(ctx context.Context, items []cloudhub.OrgNavMenuItem) error {
	const upsertMasterStmt = `
INSERT INTO nav_menu_items (id, parent_id, label, icon, sort_order, delete_yn)
VALUES ($1, $2, $3, $4, $5, false)
ON CONFLICT (id) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    label = EXCLUDED.label,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    delete_yn = false`

	for idx, item := range items {
		sortOrder := item.SortOrder
		if sortOrder == 0 {
			sortOrder = (idx + 1) * 10
		}
		if _, err := s.client.ExecContext(ctx, upsertMasterStmt, item.ID, nil, item.Label, item.Icon, sortOrder); err != nil {
			return fmt.Errorf("upsert master parent (%s): %w", item.ID, err)
		}

		for cIdx, child := range item.Children {
			cSortOrder := child.SortOrder
			if cSortOrder == 0 {
				cSortOrder = (cIdx + 1) * 10
			}
			if _, err := s.client.ExecContext(ctx, upsertMasterStmt, child.ID, item.ID, child.Label, nil, cSortOrder); err != nil {
				return fmt.Errorf("upsert master child (%s): %w", child.ID, err)
			}
		}
	}

	return nil
}

// DeleteMasterMenuItem allows SuperAdmin to soft-delete a master menu item from nav_menu_items.
func (s *OrgNavMenuStore) DeleteMasterMenuItem(ctx context.Context, itemID string) error {
	const q = `UPDATE nav_menu_items SET delete_yn = true WHERE id = $1 OR parent_id = $1`

	res, err := s.client.ExecContext(ctx, q, itemID)
	if err != nil {
		return fmt.Errorf("delete master menu item: %w", err)
	}
	if res.RowsAffected() == 0 {
		return cloudhub.ErrOrgNavMenuNotFound
	}
	return nil
}
