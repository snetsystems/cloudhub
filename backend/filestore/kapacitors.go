package filestore

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"strconv"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// KapExt is the the file extension searched for in the directory for kapacitor files
const KapExt = ".kap"

var _ cloudhub.ServersStore = &Kapacitors{}

// Kapacitors are JSON kapacitors stored in the filesystem
type Kapacitors struct {
	Dir     string                                      // Dir is the directory containing the kapacitors.
	Load    func(string, interface{}) error             // Load loads string name and dashbaord passed in as interface
	Create  func(string, interface{}) error             // Create will write kapacitor to file.
	ReadDir func(dirname string) ([]os.FileInfo, error) // ReadDir reads the directory named by dirname and returns a list of directory entries sorted by filename.
	Remove  func(name string) error                     // Remove file
	IDs     cloudhub.ID                                      // IDs generate unique ids for new kapacitors
	Logger  cloudhub.Logger
}

// NewKapacitors constructs a kapacitor store wrapping a file system directory
func NewKapacitors(dir string, ids cloudhub.ID, logger cloudhub.Logger) cloudhub.ServersStore {
	return &Kapacitors{
		Dir:     dir,
		Load:    load,
		Create:  create,
		ReadDir: ioutil.ReadDir,
		Remove:  os.Remove,
		IDs:     ids,
		Logger:  logger,
	}
}

func kapacitorFile(dir string, kapacitor cloudhub.Server) string {
	base := fmt.Sprintf("%s%s", kapacitor.Name, KapExt)
	return path.Join(dir, base)
}

// All returns all kapacitors from the directory
func (d *Kapacitors) All(ctx context.Context) ([]cloudhub.Server, error) {
	files, err := d.ReadDir(d.Dir)
	if err != nil {
		return nil, err
	}

	kapacitors := []cloudhub.Server{}
	for _, file := range files {
		if path.Ext(file.Name()) != KapExt {
			continue
		}
		var kapacitor cloudhub.Server
		if err := d.Load(path.Join(d.Dir, file.Name()), &kapacitor); err != nil {
			var fmtErr = fmt.Errorf("Error loading kapacitor configuration from %v:\n%v", path.Join(d.Dir, file.Name()), err)
			d.Logger.Error(fmtErr)
			continue // We want to load all files we can.
		} else {
			kapacitors = append(kapacitors, kapacitor)
		}
	}
	return kapacitors, nil
}

// Add creates a new kapacitor within the directory
func (d *Kapacitors) Add(ctx context.Context, kapacitor cloudhub.Server) (cloudhub.Server, error) {
	genID, err := d.IDs.Generate()
	if err != nil {
		d.Logger.
			WithField("component", "kapacitor").
			Error("Unable to generate ID")
		return cloudhub.Server{}, err
	}

	id, err := strconv.Atoi(genID)
	if err != nil {
		d.Logger.
			WithField("component", "kapacitor").
			Error("Unable to convert ID")
		return cloudhub.Server{}, err
	}

	kapacitor.ID = id

	file := kapacitorFile(d.Dir, kapacitor)
	if err = d.Create(file, kapacitor); err != nil {
		if err == cloudhub.ErrServerInvalid {
			d.Logger.
				WithField("component", "kapacitor").
				WithField("name", file).
				Error("Invalid Server: ", err)
		} else {
			d.Logger.
				WithField("component", "kapacitor").
				WithField("name", file).
				Error("Unable to write kapacitor:", err)
		}
		return cloudhub.Server{}, err
	}
	return kapacitor, nil
}

// Delete removes a kapacitor file from the directory
func (d *Kapacitors) Delete(ctx context.Context, kapacitor cloudhub.Server) error {
	_, file, err := d.idToFile(kapacitor.ID)
	if err != nil {
		return err
	}

	if err := d.Remove(file); err != nil {
		d.Logger.
			WithField("component", "kapacitor").
			WithField("name", file).
			Error("Unable to remove kapacitor:", err)
		return err
	}
	return nil
}

// Get returns a kapacitor file from the kapacitor directory
func (d *Kapacitors) Get(ctx context.Context, id int) (cloudhub.Server, error) {
	board, file, err := d.idToFile(id)
	if err != nil {
		if err == cloudhub.ErrServerNotFound {
			d.Logger.
				WithField("component", "kapacitor").
				WithField("name", file).
				Error("Unable to read file")
		} else if err == cloudhub.ErrServerInvalid {
			d.Logger.
				WithField("component", "kapacitor").
				WithField("name", file).
				Error("File is not a kapacitor")
		}
		return cloudhub.Server{}, err
	}
	return board, nil
}

// Update replaces a kapacitor from the file system directory
func (d *Kapacitors) Update(ctx context.Context, kapacitor cloudhub.Server) error {
	board, _, err := d.idToFile(kapacitor.ID)
	if err != nil {
		return err
	}

	if err := d.Delete(ctx, board); err != nil {
		return err
	}
	file := kapacitorFile(d.Dir, kapacitor)
	return d.Create(file, kapacitor)
}

// idToFile takes an id and finds the associated filename
func (d *Kapacitors) idToFile(id int) (cloudhub.Server, string, error) {
	// Because the entire kapacitor information is not known at this point, we need
	// to try to find the name of the file through matching the ID in the kapacitor
	// content with the ID passed.
	files, err := d.ReadDir(d.Dir)
	if err != nil {
		return cloudhub.Server{}, "", err
	}

	for _, f := range files {
		if path.Ext(f.Name()) != KapExt {
			continue
		}
		file := path.Join(d.Dir, f.Name())
		var kapacitor cloudhub.Server
		if err := d.Load(file, &kapacitor); err != nil {
			return cloudhub.Server{}, "", err
		}
		if kapacitor.ID == id {
			return kapacitor, file, nil
		}
	}

	return cloudhub.Server{}, "", cloudhub.ErrServerNotFound
}
