package multistore

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// Layouts is a LayoutsStore that contains multiple LayoutsStores
// The All method will return the set of all Layouts.
// Each method will be tried against the Stores slice serially.
type Layouts struct {
	Stores []cloudhub.LayoutsStore
}

// All returns the set of all layouts
func (s *Layouts) All(ctx context.Context) ([]cloudhub.Layout, error) {
	all := []cloudhub.Layout{}
	layoutSet := map[string]cloudhub.Layout{}
	ok := false
	var err error
	for _, store := range s.Stores {
		var layouts []cloudhub.Layout
		layouts, err = store.All(ctx)
		if err != nil {
			// Try to load as many layouts as possible
			continue
		}
		ok = true
		for _, l := range layouts {
			// Enforce that the layout has a unique ID
			// If the layout has been seen before then skip
			if _, okay := layoutSet[l.ID]; !okay {
				layoutSet[l.ID] = l
				all = append(all, l)
			}
		}
	}
	if !ok {
		return nil, err
	}
	return all, nil
}

// Add creates a new dashboard in the LayoutsStore.  Tries each store sequentially until success.
func (s *Layouts) Add(ctx context.Context, layout cloudhub.Layout) (cloudhub.Layout, error) {
	var err error
	for _, store := range s.Stores {
		var l cloudhub.Layout
		l, err = store.Add(ctx, layout)
		if err == nil {
			return l, nil
		}
	}
	return cloudhub.Layout{}, err
}

// Delete the dashboard from the store.  Searches through all stores to find Layout and
// then deletes from that store.
func (s *Layouts) Delete(ctx context.Context, layout cloudhub.Layout) error {
	var err error
	for _, store := range s.Stores {
		err = store.Delete(ctx, layout)
		if err == nil {
			return nil
		}
	}
	return err
}

// Get retrieves Layout if `ID` exists.  Searches through each store sequentially until success.
func (s *Layouts) Get(ctx context.Context, ID string) (cloudhub.Layout, error) {
	var err error
	for _, store := range s.Stores {
		var l cloudhub.Layout
		l, err = store.Get(ctx, ID)
		if err == nil {
			return l, nil
		}
	}
	return cloudhub.Layout{}, err
}

// Update the dashboard in the store.  Searches through each store sequentially until success.
func (s *Layouts) Update(ctx context.Context, layout cloudhub.Layout) error {
	var err error
	for _, store := range s.Stores {
		err = store.Update(ctx, layout)
		if err == nil {
			return nil
		}
	}
	return err
}
