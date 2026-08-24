package server

import (
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"

	"github.com/gorilla/websocket"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/stretchr/testify/require"
)

func TestWebTerminalHandlerClosesWebSocketWhenSSHConnectionFails(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	port := listener.Addr().(*net.TCPAddr).Port
	require.NoError(t, listener.Close())

	service := &Service{Logger: &mocks.TestLogger{}}
	server := httptest.NewServer(http.HandlerFunc(service.WebTerminalHandler))
	defer server.Close()

	query := url.Values{
		"user": {"root"},
		"pwd":  {"root"},
		"addr": {"127.0.0.1"},
		"port": {strconv.Itoa(port)},
	}
	websocketURL := "ws" + strings.TrimPrefix(server.URL, "http") + "?" + query.Encode()

	connection, response, err := websocket.DefaultDialer.Dial(websocketURL, nil)
	require.NoError(t, err)
	require.Equal(t, http.StatusSwitchingProtocols, response.StatusCode)
	defer connection.Close()

	_, _, err = connection.ReadMessage()
	var closeErr *websocket.CloseError
	require.ErrorAs(t, err, &closeErr)
}
