package filestore

import (
	"context"
	"encoding/json"
	"io/ioutil"
	"os"
	"path"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// ProtoboardExt is the the file extension searched for in the directory for protoboard files
const ProtoboardExt = ".json"

// Protoboards are instantiable JSON representation of dashbards.  Implements ProtoboardsStore.
type Protoboards struct {
	Dir     string                                      // Dir is the directory containing protoboard json definitions
	Load    func(string) (cloudhub.Protoboard, error)        // Load receives filename, returns a Protoboard from json file
	ReadDir func(dirname string) ([]os.FileInfo, error) // ReadDir reads the directory named by dirname and returns a list of directory entries sorted by filename.
	IDs     cloudhub.ID                                      // ID generates unique ids for new protoboards
	Logger  cloudhub.Logger
}

// NewProtoboards constructs a protoboard store wrapping a file system directory
func NewProtoboards(dir string, ids cloudhub.ID, logger cloudhub.Logger) cloudhub.ProtoboardsStore {
	return &Protoboards{
		Dir:     dir,
		Load:    protoboardLoadFile,
		ReadDir: ioutil.ReadDir,
		IDs:     ids,
		Logger:  logger,
	}
}

func protoboardLoadFile(name string) (cloudhub.Protoboard, error) {
	octets, err := ioutil.ReadFile(name)
	if err != nil {
		return cloudhub.Protoboard{}, cloudhub.ErrProtoboardNotFound
	}
	var protoboard cloudhub.Protoboard
	if err = json.Unmarshal(octets, &protoboard); err != nil {
		return cloudhub.Protoboard{}, cloudhub.ErrProtoboardInvalid
	}
	return protoboard, nil
}

// All returns all protoboards from the directory
func (a *Protoboards) All(ctx context.Context) ([]cloudhub.Protoboard, error) {
	files, err := a.ReadDir(a.Dir)
	if err != nil {
		return nil, err
	}

	protoboards := []cloudhub.Protoboard{}
	for _, file := range files {
		if path.Ext(file.Name()) != ProtoboardExt {
			continue
		}
		if protoboard, err := a.Load(path.Join(a.Dir, file.Name())); err != nil {
			continue // We want to load all files we can.
		} else {
			protoboards = append(protoboards, protoboard)
		}
	}

	return protoboards, nil
}

// Get returns a protoboard file from the protoboard directory
func (a *Protoboards) Get(ctx context.Context, ID string) (cloudhub.Protoboard, error) {
	l, file, err := a.idToFile(ID)
	if err != nil {
		return cloudhub.Protoboard{}, err
	}

	if err != nil {
		if err == cloudhub.ErrProtoboardNotFound {
			a.Logger.
				WithField("component", "protoboards").
				WithField("name", file).
				Error("Unable to read file")
		} else if err == cloudhub.ErrProtoboardInvalid {
			a.Logger.
				WithField("component", "protoboards").
				WithField("name", file).
				Error("File is not a protoboard")
		}
		return cloudhub.Protoboard{}, err
	}
	return l, nil
}

// idToFile takes an id and finds the associated filename
func (a *Protoboards) idToFile(ID string) (cloudhub.Protoboard, string, error) {
	// Find the name of the file through matching the ID in the protoboard
	// content with the ID passed.
	files, err := a.ReadDir(a.Dir)
	if err != nil {
		return cloudhub.Protoboard{}, "", err
	}

	for _, f := range files {
		if path.Ext(f.Name()) != ProtoboardExt {
			continue
		}
		file := path.Join(a.Dir, f.Name())
		protoboard, err := a.Load(file)
		if err != nil {
			return cloudhub.Protoboard{}, "", err
		}
		if protoboard.ID == ID {
			return protoboard, file, nil
		}
	}

	return cloudhub.Protoboard{}, "", cloudhub.ErrProtoboardNotFound
}
