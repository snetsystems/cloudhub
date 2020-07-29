package filestore

import (
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// SrcExt is the the file extension searched for in the directory for source files
const SrcExt = ".src"

// Verify sources implements sourcesStore interface.
var _ cloudhub.SourcesStore = (*Sources)(nil)

// Sources are JSON sources stored in the filesystem
type Sources struct {
	Dir     string                                      // Dir is the directory containing the sources.
	ReadDir func(dirname string) ([]os.FileInfo, error) // ReadDir reads the directory named by dirname and returns a list of directory entries sorted by filename.
	Remove  func(name string) error                     // Remove file
	IDs     cloudhub.ID                                      // IDs generate unique ids for new sources
	Logger  cloudhub.Logger
}

// NewSources constructs a source store wrapping a file system directory
func NewSources(dir string, ids cloudhub.ID, logger cloudhub.Logger) cloudhub.SourcesStore {
	return &Sources{
		Dir:     dir,
		ReadDir: ioutil.ReadDir,
		Remove:  os.Remove,
		IDs:     ids,
		Logger:  logger,
	}
}

// All returns all sources from the directory
func (d *Sources) All(ctx context.Context) ([]cloudhub.Source, error) {
	files, err := d.ReadDir(d.Dir)
	if err != nil {
		return nil, err
	}

	sources := []cloudhub.Source{}
	for _, file := range files {
		if path.Ext(file.Name()) != SrcExt {
			continue
		}
		var source cloudhub.Source
		if err := load(path.Join(d.Dir, file.Name()), &source); err != nil {
			var fmtErr = fmt.Errorf("Error loading source configuration from %v:\n%v", path.Join(d.Dir, file.Name()), err)
			d.Logger.Error(fmtErr)
			continue // We want to load all files we can.
		} else {
			sources = append(sources, source)
		}
	}
	return sources, nil
}

// Get returns a source file from the source directory
func (d *Sources) Get(ctx context.Context, id int) (cloudhub.Source, error) {
	board, file, err := d.idToFile(id)
	if err != nil {
		if err == cloudhub.ErrSourceNotFound {
			d.Logger.
				WithField("component", "source").
				WithField("name", file).
				Error("Unable to read file")
		} else if err == cloudhub.ErrSourceInvalid {
			d.Logger.
				WithField("component", "source").
				WithField("name", file).
				Error("File is not a source")
		}
		return cloudhub.Source{}, err
	}
	return board, nil
}

// Update replaces a source from the file system directory
func (d *Sources) Update(ctx context.Context, source cloudhub.Source) error {
	board, _, err := d.idToFile(source.ID)
	if err != nil {
		return err
	}

	if err := d.Delete(ctx, board); err != nil {
		return err
	}
	file := file(d.Dir, source.Name, SrcExt)
	return create(file, source)
}

// Delete removes a source file from the directory
func (d *Sources) Delete(ctx context.Context, source cloudhub.Source) error {
	_, file, err := d.idToFile(source.ID)
	if err != nil {
		return err
	}

	if err := d.Remove(file); err != nil {
		d.Logger.
			WithField("component", "source").
			WithField("name", file).
			Error("Unable to remove source:", err)
		return err
	}
	return nil
}

// idToFile takes an id and finds the associated filename
func (d *Sources) idToFile(id int) (cloudhub.Source, string, error) {
	// Because the entire source information is not known at this point, we need
	// to try to find the name of the file through matching the ID in the source
	// content with the ID passed.
	files, err := d.ReadDir(d.Dir)
	if err != nil {
		return cloudhub.Source{}, "", err
	}

	for _, f := range files {
		if path.Ext(f.Name()) != SrcExt {
			continue
		}
		file := path.Join(d.Dir, f.Name())
		var source cloudhub.Source
		if err := load(file, &source); err != nil {
			return cloudhub.Source{}, "", err
		}
		if source.ID == id {
			return source, file, nil
		}
	}

	return cloudhub.Source{}, "", cloudhub.ErrSourceNotFound
}

// Add creates a new source within the directory
func (d *Sources) Add(ctx context.Context, source cloudhub.Source) (cloudhub.Source, error) {
	return cloudhub.Source{}, errors.New("adding a source to a filestore is not supported")
}
