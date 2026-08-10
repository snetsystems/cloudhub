// Command cloudhub-openclaw-provision provisions this CloudHub process as a
// paired OpenClaw operator device: it generates (or reuses) an Ed25519
// device key, pairs with the OpenClaw Gateway using a provisioning-only
// bootstrap token, and persists the device token the Gateway issues. It is
// meant to be run once during deployment, before the CloudHub server starts
// using the paired device credentials at runtime.
//
// It never prints secret values: only the device ID and provisioning
// status are written to stdout. The bootstrap token is accepted only via
// the OPENCLAW_GATEWAY_BOOTSTRAP_TOKEN environment variable so that the
// Gateway administrator token can never land in a process listing or a
// shell history.
//
// Exit codes:
//
//	0  provisioned, or already provisioned
//	1  provisioning failed
//	2  usage error (bad or rejected command-line flag)
//	3  the device is registered but pending operator approval
package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/snetsystems/cloudhub/backend/openclaw"
)

func main() {
	os.Exit(run(os.Args[1:]))
}

// Distinct exit codes; see the package comment. A usage error must not be
// reportable as "pending approval", because the shell wrapper propagates
// this code verbatim.
const (
	exitOK             = 0
	exitFailed         = 1
	exitUsage          = 2
	exitPendingApprove = 3
)

func run(args []string) int {
	fs := flag.NewFlagSet("cloudhub-openclaw-provision", flag.ContinueOnError)
	gatewayURL := fs.String("gateway-url", os.Getenv("OPENCLAW_GATEWAY_URL"), "WebSocket URL for the OpenClaw Gateway (env OPENCLAW_GATEWAY_URL)")
	// The bootstrap token is the Gateway administrator token. It is read
	// from the environment only: a command-line value would be visible in
	// `ps` and recorded in shell history, so passing one is a usage error.
	bootstrapTokenFlag := fs.String("bootstrap-token", "", "Rejected: pass the provisioning-only bootstrap token in OPENCLAW_GATEWAY_BOOTSTRAP_TOKEN instead, so it never appears in a process listing")
	privateKeyPath := fs.String("private-key-path", os.Getenv("OPENCLAW_DEVICE_PRIVATE_KEY_FILE"), "Path to the paired OpenClaw device Ed25519 private key (env OPENCLAW_DEVICE_PRIVATE_KEY_FILE)")
	deviceTokenPath := fs.String("device-token-path", os.Getenv("OPENCLAW_DEVICE_TOKEN_FILE"), "Path to the paired OpenClaw device token (env OPENCLAW_DEVICE_TOKEN_FILE)")
	fs.Usage = func() {
		fmt.Fprintln(fs.Output(), "Usage of cloudhub-openclaw-provision:")
		fs.PrintDefaults()
		fmt.Fprintln(fs.Output(), "\nExit codes: 0 provisioned or already provisioned, 1 failed, 2 usage error, 3 pending operator approval.")
	}
	if err := fs.Parse(args); err != nil {
		return exitUsage
	}

	if *bootstrapTokenFlag != "" {
		fmt.Fprintln(os.Stderr, "cloudhub-openclaw-provision: -bootstrap-token does not accept a value; set OPENCLAW_GATEWAY_BOOTSTRAP_TOKEN in the environment instead so the token never appears in a process listing or shell history")
		return exitUsage
	}
	bootstrapToken := os.Getenv("OPENCLAW_GATEWAY_BOOTSTRAP_TOKEN")

	if *gatewayURL == "" || bootstrapToken == "" || *privateKeyPath == "" || *deviceTokenPath == "" {
		fmt.Fprintln(os.Stderr, "cloudhub-openclaw-provision: -gateway-url, -private-key-path, and -device-token-path (or their env equivalents) and OPENCLAW_GATEWAY_BOOTSTRAP_TOKEN are all required")
		return exitFailed
	}

	result, err := openclaw.ProvisionDevice(context.Background(), openclaw.ProvisionConfig{
		GatewayURL:      *gatewayURL,
		BootstrapToken:  bootstrapToken,
		PrivateKeyPath:  *privateKeyPath,
		DeviceTokenPath: *deviceTokenPath,
		RequiredScopes:  openclaw.RequiredOperatorScopes,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "cloudhub-openclaw-provision: %v\n", err)
		return exitFailed
	}

	status := "already-provisioned"
	switch {
	case result.PendingApproval:
		status = "pending-approval"
	case result.CreatedToken:
		status = "created"
	}
	fmt.Printf("device-id %s\n", result.DeviceID)
	fmt.Printf("status %s\n", status)

	if result.PendingApproval {
		return exitPendingApprove
	}
	return exitOK
}
