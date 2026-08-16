package main

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/snetsystems/cloudhub-k8s-network-mcp/internal/cloudhubproxy"
	"github.com/snetsystems/cloudhub-k8s-network-mcp/internal/config"
	"github.com/snetsystems/cloudhub-k8s-network-mcp/internal/mcpserver"
	"github.com/snetsystems/cloudhub-k8s-network-mcp/internal/repair"
)

func main() {
	if len(os.Args) == 2 && os.Args[1] == "healthcheck" {
		if err := runHealthcheck(); err != nil {
			log.Fatal(err)
		}
		return
	}
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	proxy, err := cloudhubproxy.New(cfg.ProxyURL, cfg.ServiceToken, newProxyHTTPClient(cfg.ProxyInsecureSkipVerify))
	if err != nil {
		return err
	}
	store := repair.NewPlanStore(cfg.PlanTTL, time.Now)
	repairService := repair.NewService(proxy, cfg.AllowedNamespace, store)

	server := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           mcpserver.NewHandler(repairService, cfg.ServiceToken),
		ReadHeaderTimeout: 5 * time.Second,
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	serverError := make(chan error, 1)
	go func() {
		serverError <- server.ListenAndServe()
	}()

	select {
	case err := <-serverError:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdownCtx)
	}
}

func newProxyHTTPClient(insecureSkipVerify bool) *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	if insecureSkipVerify {
		transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true} // #nosec G402 -- explicit local CloudHub opt-in
	}
	return &http.Client{Transport: transport, Timeout: 30 * time.Second}
}

func runHealthcheck() error {
	listenAddr := os.Getenv("MCP_LISTEN_ADDR")
	if listenAddr == "" {
		listenAddr = ":8080"
	}
	endpoint, err := healthcheckURL(listenAddr)
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 2 * time.Second}
	response, err := client.Get(endpoint)
	if err != nil {
		return fmt.Errorf("healthcheck request: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("healthcheck returned HTTP %d", response.StatusCode)
	}
	return nil
}

func healthcheckURL(listenAddr string) (string, error) {
	_, port, err := net.SplitHostPort(listenAddr)
	if err != nil {
		return "", fmt.Errorf("invalid listen address: %w", err)
	}
	portNumber, err := strconv.Atoi(port)
	if err != nil || portNumber < 1 || portNumber > 65535 {
		return "", fmt.Errorf("invalid listen port %q", port)
	}
	return "http://127.0.0.1:" + port + "/healthz", nil
}
