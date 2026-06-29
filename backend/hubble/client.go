package hubble

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/cilium/cilium/api/v1/flow"
	"github.com/cilium/cilium/api/v1/observer"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"
)

// keepaliveParams enables HTTP/2 PING-based dead-connection detection.
// Hubble Relay flows arrive irregularly (idle clusters can be silent for
// minutes), so without keepalive a half-dead path (SSH tunnel /
// kubectl port-forward stall, NAT timeout, etc.) leaves grpc.ClientConn
// blocked in Recv() forever — the OnDisconnected callback never fires and
// reconnection never happens.
//
// Time:                ping interval when no other traffic is flowing
// Timeout:             how long to wait for the PONG before declaring dead
// PermitWithoutStream: send pings even when no active RPC (otherwise idle
//                      streams aren't health-checked)
var keepaliveParams = keepalive.ClientParameters{
	Time:                30 * time.Second,
	Timeout:             10 * time.Second,
	PermitWithoutStream: true,
}

// streamIdleTimeout aborts a stream that hasn't received a flow within this
// window, even if gRPC keepalive says the connection is fine. Defends against
// the case where Relay itself silently stops streaming while the underlying
// connection appears healthy.
const streamIdleTimeout = 2 * time.Minute

// ClientConfig holds connection parameters for a Hubble Relay gRPC client.
// Set Plaintext=true when the relay is exposed without TLS (e.g. via
// kubectl port-forward to the service's plain HTTP/2 port). InsecureSkipVerify
// still does TLS but skips cert verification — different from Plaintext.
type ClientConfig struct {
	RelayURL           string
	TLSCA              string
	TLSCert            string
	TLSKey             string
	TLSServerName      string
	InsecureSkipVerify bool
	Plaintext          bool
}

// Validate checks that the config is self-consistent.
func (c ClientConfig) Validate() error {
	if c.RelayURL == "" {
		return errors.New("hubble: RelayURL is required")
	}
	if (c.TLSCert != "") != (c.TLSKey != "") {
		return errors.New("hubble: TLSCert and TLSKey must both be set or both empty")
	}
	return nil
}

// RelayClient connects to a Hubble Relay via gRPC and streams flows into the provided sink.
type RelayClient struct {
	cfg    ClientConfig
	logger cloudhub.Logger
	sink   chan<- *flow.Flow

	onConnected    func(time.Time)
	onDisconnected func(err error)
}

// NewRelayClient creates a RelayClient. sink receives decoded flows; logger records connection events.
func NewRelayClient(cfg ClientConfig, logger cloudhub.Logger, sink chan<- *flow.Flow) *RelayClient {
	return &RelayClient{cfg: cfg, logger: logger, sink: sink}
}

// OnConnected registers a callback invoked each time a stream is successfully opened.
func (c *RelayClient) OnConnected(fn func(time.Time)) { c.onConnected = fn }

// OnDisconnected registers a callback invoked each time a stream ends with an error.
func (c *RelayClient) OnDisconnected(fn func(error)) { c.onDisconnected = fn }

// Run blocks until ctx is cancelled, opening one stream and reconnecting with exponential backoff on failure.
func (c *RelayClient) Run(ctx context.Context) {
	attempt := 0
	for {
		if err := ctx.Err(); err != nil {
			return
		}
		err := c.streamOnce(ctx)
		if c.onDisconnected != nil && err != nil {
			c.onDisconnected(err)
		}
		if err == nil || ctx.Err() != nil {
			return
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoffFor(attempt)):
			attempt++
		}
	}
}

func (c *RelayClient) streamOnce(ctx context.Context) error {
	dialOpts := []grpc.DialOption{
		grpc.WithBlock(),
		grpc.WithKeepaliveParams(keepaliveParams),
	}
	if c.cfg.Plaintext {
		dialOpts = append(dialOpts, grpc.WithTransportCredentials(insecure.NewCredentials()))
	} else {
		creds, err := c.dialCreds()
		if err != nil {
			return fmt.Errorf("tls: %w", err)
		}
		dialOpts = append(dialOpts, grpc.WithTransportCredentials(creds))
	}

	// Cap the initial dial so a misconfig (wrong port, TLS/plaintext mismatch)
	// surfaces as an error instead of hanging on grpc.WithBlock retries.
	dialCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	//nolint:staticcheck // grpc.DialContext deprecated in v1.27+; grpc.NewClient preferred in v1.63+
	conn, err := grpc.DialContext(dialCtx, c.cfg.RelayURL, dialOpts...)
	if err != nil {
		return fmt.Errorf("dial: %w", err)
	}
	defer conn.Close()

	if c.onConnected != nil {
		c.onConnected(time.Now())
	}

	// streamCtx is derived from ctx but lets us cancel just this Recv loop
	// when the stream sits idle for too long. ctx cancellation still
	// propagates (so shutdown is clean).
	streamCtx, cancelStream := context.WithCancel(ctx)
	defer cancelStream()

	cli := observer.NewObserverClient(conn)
	stream, err := cli.GetFlows(streamCtx, &observer.GetFlowsRequest{Follow: true})
	if err != nil {
		return fmt.Errorf("get flows: %w", err)
	}

	// idleTimer fires if no flow arrives within streamIdleTimeout. We can't
	// reset stream.Recv() directly, so we cancel the context — Recv() then
	// returns and the outer Run() loop will reconnect.
	idleTimer := time.NewTimer(streamIdleTimeout)
	defer idleTimer.Stop()
	go func() {
		select {
		case <-streamCtx.Done():
			return
		case <-idleTimer.C:
			cancelStream()
		}
	}()
	resetIdle := func() {
		if !idleTimer.Stop() {
			select {
			case <-idleTimer.C:
			default:
			}
		}
		idleTimer.Reset(streamIdleTimeout)
	}

	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			// streamCtx cancellation (idle timeout, parent shutdown) surfaces
			// here as a context error — propagate so the outer loop can decide
			// whether to reconnect.
			return err
		}
		if fl := resp.GetFlow(); fl != nil {
			resetIdle()
			select {
			case c.sink <- fl:
			default:
				// fan-out is slow — drop
			}
		}
	}
}

func (c *RelayClient) dialCreds() (credentials.TransportCredentials, error) {
	if c.cfg.TLSCert == "" && c.cfg.TLSCA == "" {
		if c.cfg.InsecureSkipVerify {
			return credentials.NewTLS(&tls.Config{InsecureSkipVerify: true}), nil //nolint:gosec
		}
		// No TLS config at all — return system-default TLS
		return credentials.NewTLS(&tls.Config{}), nil
	}

	tlsConf := &tls.Config{
		ServerName:         c.cfg.TLSServerName,
		InsecureSkipVerify: c.cfg.InsecureSkipVerify, //nolint:gosec
	}

	if c.cfg.TLSCA != "" {
		caBytes, err := os.ReadFile(c.cfg.TLSCA)
		if err != nil {
			return nil, fmt.Errorf("read CA: %w", err)
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(caBytes) {
			return nil, errors.New("failed to append CA certs")
		}
		tlsConf.RootCAs = pool
	}

	if c.cfg.TLSCert != "" {
		cert, err := tls.LoadX509KeyPair(c.cfg.TLSCert, c.cfg.TLSKey)
		if err != nil {
			return nil, fmt.Errorf("load client cert: %w", err)
		}
		tlsConf.Certificates = []tls.Certificate{cert}
	}

	return credentials.NewTLS(tlsConf), nil
}

// backoffFor returns the wait duration before reconnect attempt n.
// It doubles each attempt starting from 1s, capped at 30s. The early
// return prevents int64 overflow at attempt >= 34.
func backoffFor(attempt int) time.Duration {
	if attempt > 5 {
		return 30 * time.Second
	}
	d := time.Second << attempt
	if d > 30*time.Second {
		d = 30 * time.Second
	}
	return d
}
