VERSION = 1.2.0
ifeq ($(OS), Windows_NT)
	GOBINDATA := $(shell go-bindata.exe --version 2>nil)
else
	GOBINDATA := $(shell which go-bindata 2> /dev/null)
endif

COMMIT ?= $(shell git rev-parse --short=8 HEAD)
YARN := $(shell command -v yarn 2> /dev/null)

SOURCES := $(shell find backend -name "*.go" ! -name "*_gen.go" -not -path "./vendor/*" )
UISOURCES := $(shell find frontend -type f -not \( -path frontend/build/\* -o -path frontend/.cache/\* -o -path frontend/node_modules/\* -prune \) )

unexport LDFLAGS
LDFLAGS=-ldflags "-s -X main.version=${VERSION} -X main.commit=${COMMIT}"
BINARY=cloudhub
CTLBINARY=cloudhubctl
GO111MODULE=on

.DEFAULT_GOAL := all

.PHONY: all build gobuild assets dep clean test gotest gotestrace jstest run run-dev ctags

all: dep build

build: assets ${BINARY}

gobuild: .godep ${BINARY}

${BINARY}: $(SOURCES) .bindata .jsdep .godep
	cd backend && GO111MODULE=on go build -o ./cmd/cloudhub/${BINARY} ${LDFLAGS} ./cmd/cloudhub/main.go
	cd backend && GO111MODULE=on go build -o ./cmd/cloudhubctl/${CTLBINARY} ${LDFLAGS} ./cmd/cloudhubctl

assets: .jssrc .bindata

.bindata: backend/canned/bin_gen.go backend/protoboards/bin_gen.go backend/dist/dist_gen.go backend/server/swagger_gen.go backend/kv/internal/internal.pb.go
	@touch .bindata

backend/dist/dist_gen.go: $(UISOURCES)
	go generate -x ./backend/dist

backend/canned/bin_gen.go: backend/canned/*.json
	go generate -x ./backend/canned

backend/protoboards/bin_gen.go: backend/protoboards/*.json
	go generate -x ./backend/protoboards

backend/server/swagger_gen.go: backend/server/swagger.json
	go generate -x ./backend/server

backend/kv/internal/internal.pb.go: backend/kv/internal/internal.proto
	go generate -x ./backend/kv/internal

.jssrc: $(UISOURCES)
	cd frontend && yarn run clean && yarn run build
	@touch .jssrc

dep: .jsdep .godep

.godep:
ifndef GOBINDATA
	@echo "Installing go-bindata"
	go get -u github.com/kevinburke/go-bindata/go-bindata
	@echo "Installing go-protoc"
	go get -u github.com/gogo/protobuf/protoc-gen-gofast
	GO111MODULE=on go get
endif
	@touch .godep

.jsdep: frontend/yarn.lock
ifndef YARN
	$(error Please install yarn 0.19.1+)
else
	cd frontend && yarn --no-progress --no-emoji
	@touch .jsdep
endif

test: jstest gotest gotestrace lint-ci

gotest:
	cd backend && GO111MODULE=on go test -timeout 10s ./...

gotestrace:
	cd backend && GO111MODULE=on go test -race ./...

jstest:
	cd frontend && yarn test --runInBand

lint:
	cd frontend && yarn run lint

lint-ci:
	cd frontend && yarn run eslint && yarn run tsc # fail fast for ci process

run: ${BINARY}
	./backend/cmd/cloudhub/${BINARY}

run-dev: ${BINARY}
	mkdir -p frontend/build
	cd ./backend/cmd/cloudhub/ && ./${BINARY} -d --log-level=debug --auth-duration=0 -t=74c1e9e2450886060b5bf736b935cd0bf960837f --github-client-id=c170bbdba5cb2ea8c3e6 --github-client-secret=55c35715b0e4eebab7edbdeef3081bf890e79d22

clean:
	if [ -f backend/cmd/cloudhub/${BINARY} ] ; then rm backend/cmd/cloudhub/${BINARY} ; fi
	if [ -f backend/cmd/cloudhubctl/${CTLBINARY} ] ; then rm backend/cmd/cloudhubctl/${CTLBINARY} ; fi
	cd frontend && yarn run clean
#	cd frontend && rm -rf node_modules
	rm -f backend/dist/dist_gen.go backend/canned/bin_gen.go backend/protoboards/bin_gen.go backend/server/swagger_gen.go
	@rm -f .godep .jsdep .jssrc .bindata

# For Vim-go Env.
ctags:
	ctags -R --languages="Go" --exclude=.git --exclude=frontend .
