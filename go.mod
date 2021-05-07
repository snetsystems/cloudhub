module github.com/snetsystems/cloudhub

require (
	github.com/NYTimes/gziphandler v1.1.1
	github.com/abbot/go-http-auth v0.4.0
	github.com/ajg/form v1.5.1 // indirect
	github.com/bouk/httprouter v0.0.0-20160817010721-ee8b3818a7f5
	github.com/dgrijalva/jwt-go v3.2.0+incompatible
	github.com/elazarl/go-bindata-assetfs v1.0.0
	github.com/fasthttp-contrib/websocket v0.0.0-20160511215533-1f3b11f56072 // indirect
	github.com/fatih/structs v1.1.0 // indirect
	github.com/gavv/httpexpect v2.0.0+incompatible
	github.com/gogo/protobuf v1.3.1
	github.com/golang/groupcache v0.0.0-20190702054246-869f871628b6 // indirect
	github.com/golang/protobuf v1.4.3
	github.com/google/go-cmp v0.5.4
	github.com/google/go-github v17.0.0+incompatible
	github.com/google/go-querystring v1.0.0 // indirect
	github.com/google/uuid v1.1.1
	github.com/gorilla/websocket v1.4.2
	github.com/grpc-ecosystem/go-grpc-middleware v1.2.0 // indirect
	github.com/grpc-ecosystem/grpc-gateway v1.14.6 // indirect
	github.com/imkira/go-interpol v1.1.0 // indirect
	github.com/influxdata/flux v0.65.0
	github.com/influxdata/influxdb v1.1.5
	github.com/influxdata/kapacitor v1.5.9
	github.com/influxdata/usage-client v0.0.0-20160829180054-6d3895376368
	github.com/jessevdk/go-flags v1.4.0
	github.com/lestrrat-go/jwx v0.9.0
	github.com/mattn/go-colorable v0.1.6 // indirect
	github.com/microcosm-cc/bluemonday v1.0.2
	github.com/moul/http2curl v1.0.0 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/sergi/go-diff v1.1.0
	github.com/sirupsen/logrus v1.6.0
	github.com/stretchr/testify v1.7.0
	github.com/tmc/grpc-websocket-proxy v0.0.0-20200427203606-3cfed13b9966 // indirect
	github.com/valyala/fasthttp v1.15.1 // indirect
	github.com/xeipuuv/gojsonschema v1.2.0 // indirect
	github.com/yalp/jsonpath v0.0.0-20180802001716-5cc68e5049a0 // indirect
	github.com/yudai/gojsondiff v1.0.0 // indirect
	github.com/yudai/golcs v0.0.0-20170316035057-ecda9a501e82 // indirect
	github.com/yudai/pp v2.0.1+incompatible // indirect
	go.etcd.io/bbolt v1.3.5
	go.etcd.io/etcd v0.5.0-alpha.5.0.20201125193152-8a03d2e9614b
	go.uber.org/multierr v1.5.0 // indirect
	golang.org/x/crypto v0.0.0-20200622213623-75b288015ac9
	golang.org/x/net v0.0.0-20201021035429-f5854403a974
	golang.org/x/oauth2 v0.0.0-20200107190931-bf48bf16ab8d
	google.golang.org/api v0.15.0
)

replace github.com/coreos/go-systemd => github.com/coreos/go-systemd/v22 v22.0.0

replace google.golang.org/grpc => google.golang.org/grpc v1.26.0

replace github.com/prometheus/prometheus => github.com/goller/prometheus v1.6.1-0.20170502220046-58298e738211

go 1.16
