package server
import (
    "net/http"
    "net/http/httptest"
    "strings"
    "strconv"
    "testing"
    
    "github.com/gavv/httpexpect"
)

func Test_WebTerminalHandler(t *testing.T) {
    type args struct {
		user    string
        pwd     string
        addr    string
        port    int
        route   string
    }
    tests := []struct {
		name string
		args args
		want bool
	}{
		{
			name: "Verifying WebSockets and ssh connections",
			args: args{
				user: "root",
                pwd: "root",
                addr: "192.168.56.103",
                port: 22,
                route: "/cloudhub/v1/WebTerminalHandler",
			},
			want: true,
		},
    }
    for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
                t.Logf("Hello, client")
            }))
            defer s.Close()
        
            u := "ws" + strings.TrimPrefix(s.URL, "http")
            querystring := "?user="+tt.args.user+"&pwd="+tt.args.pwd+"&addr="+tt.args.addr+"&port="+strconv.Itoa(tt.args.port)
            u = u + tt.args.route + querystring
            
            sv := &Service{}
            e := httpexpect.WithConfig(httpexpect.Config{
                BaseURL:         u,
                WebsocketDialer: httpexpect.NewWebsocketDialer(http.HandlerFunc(sv.WebTerminalHandler)),
                Reporter:        httpexpect.NewAssertReporter(t),
                Printers: []httpexpect.Printer{
                    httpexpect.NewDebugPrinter(t, true),
                },
            })
        
            e.GET(tt.args.route).WithWebsocketUpgrade().
                Expect().
                Status(http.StatusSwitchingProtocols).
                Websocket()
        
            sh := &ssh{
                user: tt.args.user,
                pwd:  tt.args.pwd,
                addr: tt.args.addr,
                port: tt.args.port,
            }
            _, err := sh.Connect()
            if nil != err {
                t.Errorf("Test_WebTerminalHandler() error = %v", err)
            }
		})
	}
}