package main

import (
	"context"
	"log"
	"os"

	"github.com/jessevdk/go-flags"
	cmp "github.com/snetsystems/cmp/backend"
	"github.com/snetsystems/cmp/backend/server"
)

// Build flags
var (
	version = ""
	commit  = ""
)

func main() {
	srv := server.Server{
		BuildInfo: cmp.BuildInfo{
			Version: version,
			Commit:  commit,
		},
	}

	parser := flags.NewParser(&srv, flags.Default)
	parser.ShortDescription = `CSH (Cloud Smart Hub)`
	parser.LongDescription = `Options for CSH (Cloud Smart Hub)`

	if _, err := parser.Parse(); err != nil {
		code := 1
		if fe, ok := err.(*flags.Error); ok {
			if fe.Type == flags.ErrHelp {
				code = 0
			}
		}
		os.Exit(code)
	}

	if srv.ShowVersion {
		log.Printf("CSH %s (git commit: %s)\n", version, commit)
		os.Exit(0)
	}

	ctx := context.Background()
	if err := srv.Serve(ctx); err != nil {
		log.Fatalln(err)
	}
}
