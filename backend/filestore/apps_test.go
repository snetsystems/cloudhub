package filestore_test

import (
	"context"
	"errors"
	"os"
	"path"
	"path/filepath"
	"reflect"
	"sort"
	"strconv"
	"testing"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/filestore"
	clog "github.com/snetsystems/cloudhub/backend/log"
)

func TestAll(t *testing.T) {
	t.Parallel()
	var tests = []struct {
		Existing []cloudhub.Layout
		Err      error
	}{
		{
			Existing: []cloudhub.Layout{
				{ID: "1",
					Application: "howdy",
				},
				{ID: "2",
					Application: "doody",
				},
			},
			Err: nil,
		},
		{
			Existing: []cloudhub.Layout{},
			Err:      nil,
		},
		{
			Existing: nil,
			Err:      errors.New("Error"),
		},
	}
	for i, test := range tests {
		apps, _ := MockApps(test.Existing, test.Err)
		layouts, err := apps.All(context.Background())
		if err != test.Err {
			t.Errorf("Test %d: apps all error expected: %v; actual: %v", i, test.Err, err)
		}
		if !reflect.DeepEqual(layouts, test.Existing) {
			t.Errorf("Test %d: Layouts should be equal; expected %v; actual %v", i, test.Existing, layouts)
		}
	}
}

func TestAdd(t *testing.T) {
	t.Parallel()
	var tests = []struct {
		Existing   []cloudhub.Layout
		Add        cloudhub.Layout
		ExpectedID string
		Err        error
	}{
		{
			Existing: []cloudhub.Layout{
				{ID: "1",
					Application: "howdy",
				},
				{ID: "2",
					Application: "doody",
				},
			},
			Add: cloudhub.Layout{
				Application: "newbie",
			},
			ExpectedID: "3",
			Err:        nil,
		},
		{
			Existing: []cloudhub.Layout{},
			Add: cloudhub.Layout{
				Application: "newbie",
			},
			ExpectedID: "1",
			Err:        nil,
		},
		{
			Existing: nil,
			Add: cloudhub.Layout{
				Application: "newbie",
			},
			ExpectedID: "",
			Err:        errors.New("Error"),
		},
	}
	for i, test := range tests {
		apps, _ := MockApps(test.Existing, test.Err)
		layout, err := apps.Add(context.Background(), test.Add)
		if err != test.Err {
			t.Errorf("Test %d: apps add error expected: %v; actual: %v", i, test.Err, err)
		}

		if layout.ID != test.ExpectedID {
			t.Errorf("Test %d: Layout ID should be equal; expected %s; actual %s", i, test.ExpectedID, layout.ID)
		}
	}
}

func TestDelete(t *testing.T) {
	t.Parallel()
	var tests = []struct {
		Existing []cloudhub.Layout
		DeleteID string
		Expected map[string]cloudhub.Layout
		Err      error
	}{
		{
			Existing: []cloudhub.Layout{
				{ID: "1",
					Application: "howdy",
				},
				{ID: "2",
					Application: "doody",
				},
			},
			DeleteID: "1",
			Expected: map[string]cloudhub.Layout{
				"dir/2.json": {ID: "2",
					Application: "doody",
				},
			},
			Err: nil,
		},
		{
			Existing: []cloudhub.Layout{},
			DeleteID: "1",
			Expected: map[string]cloudhub.Layout{},
			Err:      cloudhub.ErrLayoutNotFound,
		},
		{
			Existing: nil,
			DeleteID: "1",
			Expected: map[string]cloudhub.Layout{},
			Err:      errors.New("Error"),
		},
	}
	for i, test := range tests {
		apps, actual := MockApps(test.Existing, test.Err)
		err := apps.Delete(context.Background(), cloudhub.Layout{ID: test.DeleteID})
		if err != test.Err {
			t.Errorf("Test %d: apps delete error expected: %v; actual: %v", i, test.Err, err)
		}
		if !reflect.DeepEqual(*actual, test.Expected) {
			t.Errorf("Test %d: Layouts should be equal; expected %v; actual %v", i, test.Expected, actual)
		}
	}
}

func TestGet(t *testing.T) {
	t.Parallel()
	var tests = []struct {
		Existing []cloudhub.Layout
		ID       string
		Expected cloudhub.Layout
		Err      error
	}{
		{
			Existing: []cloudhub.Layout{
				{ID: "1",
					Application: "howdy",
				},
				{ID: "2",
					Application: "doody",
				},
			},
			ID: "1",
			Expected: cloudhub.Layout{
				ID:          "1",
				Application: "howdy",
			},
			Err: nil,
		},
		{
			Existing: []cloudhub.Layout{},
			ID:       "1",
			Expected: cloudhub.Layout{},
			Err:      cloudhub.ErrLayoutNotFound,
		},
		{
			Existing: nil,
			ID:       "1",
			Expected: cloudhub.Layout{},
			Err:      cloudhub.ErrLayoutNotFound,
		},
	}
	for i, test := range tests {
		apps, _ := MockApps(test.Existing, test.Err)
		layout, err := apps.Get(context.Background(), test.ID)
		if err != test.Err {
			t.Errorf("Test %d: Layouts get error expected: %v; actual: %v", i, test.Err, err)
		}
		if !reflect.DeepEqual(layout, test.Expected) {
			t.Errorf("Test %d: Layouts should be equal; expected %v; actual %v", i, test.Expected, layout)
		}
	}
}

func TestUpdate(t *testing.T) {
	t.Parallel()
	var tests = []struct {
		Existing []cloudhub.Layout
		Update   cloudhub.Layout
		Expected map[string]cloudhub.Layout
		Err      error
	}{
		{
			Existing: []cloudhub.Layout{
				{ID: "1",
					Application: "howdy",
				},
				{ID: "2",
					Application: "doody",
				},
			},
			Update: cloudhub.Layout{
				ID:          "1",
				Application: "hello",
				Measurement: "measurement",
			},
			Expected: map[string]cloudhub.Layout{
				"dir/1.json": {ID: "1",
					Application: "hello",
					Measurement: "measurement",
				},
				"dir/2.json": {ID: "2",
					Application: "doody",
				},
			},
			Err: nil,
		},
		{
			Existing: []cloudhub.Layout{},
			Update: cloudhub.Layout{
				ID: "1",
			},
			Expected: map[string]cloudhub.Layout{},
			Err:      cloudhub.ErrLayoutNotFound,
		},
		{
			Existing: nil,
			Update: cloudhub.Layout{
				ID: "1",
			},
			Expected: map[string]cloudhub.Layout{},
			Err:      cloudhub.ErrLayoutNotFound,
		},
	}
	for i, test := range tests {
		apps, actual := MockApps(test.Existing, test.Err)
		err := apps.Update(context.Background(), test.Update)
		if err != test.Err {
			t.Errorf("Test %d: Layouts get error expected: %v; actual: %v", i, test.Err, err)
		}
		if !reflect.DeepEqual(*actual, test.Expected) {
			t.Errorf("Test %d: Layouts should be equal; expected %v; actual %v", i, test.Expected, actual)
		}
	}
}

type MockFileInfo struct {
	name string
}

func (m *MockFileInfo) Name() string {
	return m.name
}

func (m *MockFileInfo) Size() int64 {
	return 0
}

func (m *MockFileInfo) Mode() os.FileMode {
	return 0666
}

func (m *MockFileInfo) ModTime() time.Time {
	return time.Now()
}

func (m *MockFileInfo) IsDir() bool {
	return false
}

func (m *MockFileInfo) Sys() interface{} {
	return nil
}

type MockFileInfos []os.FileInfo

func (m MockFileInfos) Len() int           { return len(m) }
func (m MockFileInfos) Swap(i, j int)      { m[i], m[j] = m[j], m[i] }
func (m MockFileInfos) Less(i, j int) bool { return m[i].Name() < m[j].Name() }

type MockID struct {
	id int
}

func (m *MockID) Generate() (string, error) {
	m.id++
	return strconv.Itoa(m.id), nil
}

func MockApps(existing []cloudhub.Layout, expected error) (filestore.Apps, *map[string]cloudhub.Layout) {
	layouts := map[string]cloudhub.Layout{}
	fileName := func(dir string, layout cloudhub.Layout) string {
		return path.Join(dir, layout.ID+".json")
	}
	dir := "dir"
	for _, l := range existing {
		layouts[fileName(dir, l)] = l
	}
	load := func(file string) (cloudhub.Layout, error) {
		if expected != nil {
			return cloudhub.Layout{}, expected
		}

		l, ok := layouts[file]
		if !ok {
			return cloudhub.Layout{}, cloudhub.ErrLayoutNotFound
		}
		return l, nil
	}

	create := func(file string, layout cloudhub.Layout) error {
		if expected != nil {
			return expected
		}
		layouts[file] = layout
		return nil
	}

	readDir := func(dirname string) ([]os.FileInfo, error) {
		if expected != nil {
			return nil, expected
		}
		info := []os.FileInfo{}
		for k := range layouts {
			info = append(info, &MockFileInfo{filepath.Base(k)})
		}
		sort.Sort(MockFileInfos(info))
		return info, nil
	}

	remove := func(name string) error {
		if expected != nil {
			return expected
		}
		if _, ok := layouts[name]; !ok {
			return cloudhub.ErrLayoutNotFound
		}
		delete(layouts, name)
		return nil
	}

	return filestore.Apps{
		Dir:      dir,
		Load:     load,
		Filename: fileName,
		Create:   create,
		ReadDir:  readDir,
		Remove:   remove,
		IDs: &MockID{
			id: len(existing),
		},
		Logger: clog.New(clog.ParseLevel("debug")),
	}, &layouts
}
