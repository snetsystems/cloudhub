package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gosnmp/gosnmp"
	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// SNMPQuery represents an SNMP query.
type SNMPQuery struct {
	Oid     string
	Key     string
	Process func(string) string
}

// SNMPManager manages SNMP operations and holds the configuration.
type SNMPManager struct {
	Config *SNMPConfig
	SNMP   SNMPInterface
}

// SNMPConfig holds the SNMP configuration.
type SNMPConfig struct {
	DeviceIP      string `json:"device_ip"`
	Community     string `json:"community"`
	Version       string `json:"version"`
	Port          uint16 `json:"port"`
	Protocol      string `json:"protocol"` // "tcp", "tcp4", "tcp6", "udp", "udp4", "udp6"
	SecurityName  string `json:"security_name,omitempty"`
	AuthProtocol  string `json:"auth_protocol,omitempty"` // auth protocol one of ["md5", "sha", "sha2", "hmac128sha224", "hmac192sha256", "hmac256sha384", "hmac384sha512"]
	AuthPass      string `json:"auth_pass,omitempty"`
	PrivProtocol  string `json:"priv_protocol,omitempty"` // priv_protocol one of ["des", "aes", "aes128", "aes192", "aes256"]
	PrivPass      string `json:"priv_pass,omitempty"`
	SecurityLevel string `json:"security_level,omitempty"` // security_level one of ["noAuthNoPriv", "authNoPriv", "authPriv"]
}

const (
	connTimeout = 5 * time.Second
	connRetry   = 3
)

// SNMPInterface defines the required methods for interacting with SNMP.
type SNMPInterface interface {
	Walk(oid string, walkFn gosnmp.WalkFunc) error
	Get(oids []string) (*gosnmp.SnmpPacket, error)
	Connect() error
	Close() error
}

// GoSNMPAdapter wraps gosnmp.GoSNMP to conform to SNMPInterface.
type GoSNMPAdapter struct {
	*gosnmp.GoSNMP
}

// Close closes the connection if it exists.
func (g *GoSNMPAdapter) Close() error {
	if g.Conn != nil {
		return g.Conn.Close()
	}
	return nil
}

// Connect establishes a connection using the embedded GoSNMP instance.
func (g *GoSNMPAdapter) Connect() error {
	return g.GoSNMP.Connect()
}

// Walk performs an SNMP walk operation on the given OID using the provided walk function.
func (g *GoSNMPAdapter) Walk(oid string, walkFn gosnmp.WalkFunc) error {
	return g.GoSNMP.Walk(oid, walkFn)
}

// Get retrieves SNMP variables for the given OIDs.
func (g *GoSNMPAdapter) Get(oids []string) (*gosnmp.SnmpPacket, error) {
	return g.GoSNMP.Get(oids)
}

// NewSNMPManager initializes a new SNMP manager.
func NewSNMPManager(config *SNMPConfig) (*SNMPManager, error) {
	if err := config.validCreate(); err != nil {
		return nil, err
	}

	version, err := parseSNMPVersion(config.Version)
	if err != nil {
		return nil, err
	}
	var msgFlags gosnmp.SnmpV3MsgFlags
	var authProtocol gosnmp.SnmpV3AuthProtocol
	var privProtocol gosnmp.SnmpV3PrivProtocol

	protocol, err := parseProtocol(config.Protocol)
	if err != nil {
		return nil, err
	}

	if version == gosnmp.Version3 {
		flags, err := parseSecurityLevel(config.SecurityLevel)
		if err != nil {
			return nil, err
		}
		msgFlags = flags
	}

	if msgFlags&gosnmp.AuthPriv > 0 || msgFlags&gosnmp.AuthNoPriv > 0 {
		authProtocol, err = parseAuthProtocol(config.AuthProtocol)
		if err != nil {
			return nil, err
		}
	}

	if msgFlags == gosnmp.AuthPriv {
		privProtocol, err = parsePrivProtocol(config.PrivProtocol)
		if err != nil {
			return nil, err
		}
	}

	snmp := &gosnmp.GoSNMP{
		Target:    config.DeviceIP,
		Port:      config.Port,
		Community: config.Community,
		Version:   version,
		Timeout:   connTimeout,
		Retries:   connRetry,
		Transport: protocol,
	}

	if version == gosnmp.Version3 {
		snmp.SecurityModel = gosnmp.UserSecurityModel
		snmp.MsgFlags = msgFlags
		snmp.SecurityParameters = &gosnmp.UsmSecurityParameters{
			UserName:                 config.SecurityName,
			AuthenticationProtocol:   authProtocol,
			AuthenticationPassphrase: config.PrivPass,
			PrivacyProtocol:          privProtocol,
			PrivacyPassphrase:        config.AuthPass,
		}
	}

	adapter := &GoSNMPAdapter{GoSNMP: snmp}
	manager := &SNMPManager{
		Config: config,
		SNMP:   adapter,
	}
	return manager, nil
}

// Connect establishes a connection to the SNMP server.
func (manager *SNMPManager) Connect() error {
	if manager.SNMP == nil {
		return fmt.Errorf("SNMP configuration is not initialized")
	}
	fmt.Printf("Connecting to SNMP device at %s:%d using %s\n", manager.Config.DeviceIP, manager.Config.Port, manager.Config.Protocol)
	return manager.SNMP.Connect()
}

// Disconnect closes the connection to the SNMP server.
func (manager *SNMPManager) Disconnect() error {
	if manager.SNMP == nil {
		return fmt.Errorf("SNMP configuration is not initialized")
	}
	return manager.SNMP.Close()
}

// SNMPCollector collects SNMP data.
type SNMPCollector struct {
	Manager *SNMPManager
	Queries []SNMPQuery
}

// CollectData retrieves SNMP data based on the configured queries.
func (collector *SNMPCollector) CollectData() (map[string]string, error) {
	results := make(map[string]string)
	if collector.Manager.SNMP == nil {
		return nil, fmt.Errorf("SNMP manager configuration is not initialized")
	}

	for _, query := range collector.Queries {
		err := collector.Manager.SNMP.Walk(query.Oid, func(pdu gosnmp.SnmpPDU) error {
			var value string
			switch pdu.Type {
			case gosnmp.OctetString:
				value = string(pdu.Value.([]byte))
			case gosnmp.Integer:
				value = fmt.Sprintf("%d", pdu.Value.(int))
			case gosnmp.Counter32, gosnmp.Gauge32, gosnmp.TimeTicks, gosnmp.Counter64:
				value = fmt.Sprintf("%d", gosnmp.ToBigInt(pdu.Value).Uint64())
			default:
				return fmt.Errorf("Unsupported PDU type encountered: %v", pdu.Type)
			}

			if query.Process != nil {
				value = query.Process(value)
			}
			results[query.Key] = value
			return nil
		})
		if err != nil {
			return nil, fmt.Errorf("Error during SNMP Walk for OID %s: %v", query.Oid, err)
		}
	}
	return results, nil
}

// parseSNMPVersion parses the SNMP version from a string.
func parseSNMPVersion(versionStr string) (gosnmp.SnmpVersion, error) {
	switch versionStr {
	case "1", "v1", "V1":
		return gosnmp.Version1, nil
	case "2c", "v2c", "V2C":
		return gosnmp.Version2c, nil
	case "3", "v3", "V3":
		return gosnmp.Version3, nil
	default:
		return 0, fmt.Errorf("unsupported SNMP version: %s", versionStr)
	}
}

func processHostname(result string) string {
	parts := strings.Split(result, ".")
	if len(parts) > 0 {
		return parts[0]
	}
	return result
}

func processDeviceType(result string) string {
	parts := strings.Split(result, ":")
	if len(parts) < 2 {
		return "router"
	}

	temp := strings.TrimSpace(parts[1])
	if temp == "2" || temp == "4" || temp == "6" {
		return "switch"
	}
	return "router"
}

func processDeviceOS(result string) string {
	var osName string
	if strings.Contains(result, "XE") {
		osName = "iosxe"
	} else if strings.Contains(result, "NX") {
		osName = "nxos"
	} else {
		osName = "ios"
	}
	return osName
}

// collectSNMPData is a utility function to modularize the SNMP data collection.
func collectSNMPData(snmpConfig *SNMPConfig, queries []SNMPQuery) (map[string]string, error) {
	snmpManager, err := NewSNMPManager(snmpConfig)
	if err != nil {
		return nil, err
	}

	if err := snmpManager.Connect(); err != nil {
		return nil, err
	}
	defer snmpManager.Disconnect()

	collector := &SNMPCollector{
		Manager: snmpManager,
		Queries: queries,
	}
	results, err := collector.CollectData()
	if err != nil {
		return nil, err
	}

	return results, nil
}

// SNMPResponse is SNMP Connection after Response
type SNMPResponse struct {
	DeviceIP   string `json:"device_ip"`
	Index      int    `json:"index"`
	DeviceType string `json:"device_type"`
	Hostname   string `json:"hostname"`
	DeviceOS   string `json:"device_os"`
}
type snmpReqError struct {
	Index        int    `json:"index"`
	DeviceIP     string `json:"device_ip,omitempty"`
	ErrorMessage string `json:"errorMessage,omitempty"`
}

func (r *SNMPConfig) validCreate() error {
	switch {
	case r.DeviceIP == "":
		return fmt.Errorf("device_ip required in device request body")
	case r.Protocol == "":
		return fmt.Errorf("Protocol required in device request body")
	case r.Version == "":
		return fmt.Errorf("Version required in device request body")
	}
	isSNMPV3, _ := parseSNMPVersion("v3")
	reqVersion, err := parseSNMPVersion(strings.ToLower(r.Version))
	if err != nil {
		return fmt.Errorf(err.Error())
	}
	if reqVersion != isSNMPV3 {
		if r.Community == "" {
			return fmt.Errorf("Community required in device request body for SNMP v1/v2c")
		}
		return nil
	}
	reqSecurityLevel, err := parseSecurityLevel(strings.ToLower(r.SecurityLevel))
	if err != nil {
		return fmt.Errorf(err.Error())
	}
	switch reqSecurityLevel {
	case gosnmp.NoAuthNoPriv:
		if r.SecurityName == "" {
			return fmt.Errorf("snmp_user required for noAuthNoPriv security level")
		}
	case gosnmp.AuthNoPriv:
		if r.SecurityName == "" || r.PrivPass == "" || r.AuthProtocol == "" {
			return fmt.Errorf("snmp_user, snmp_auth_password, and snmp_v3_auth_protocol required for authNoPriv security level")
		}
	case gosnmp.AuthPriv:
		if r.SecurityName == "" || r.PrivPass == "" || r.AuthProtocol == "" || r.AuthPass == "" || r.PrivProtocol == "" {
			return fmt.Errorf("snmp_user, snmp_auth_password, snmp_v3_auth_protocol, snmp_private_password, and snmp_v3_private_protocol required for authPriv security level")
		}
	default:
		return fmt.Errorf("unsupported security level: %s", r.SecurityLevel)
	}
	return nil
}

// SNMPConnTestBulk handles the SNMP connections test request.
func (s *Service) SNMPConnTestBulk(w http.ResponseWriter, r *http.Request) {
	var reqs []SNMPConfig
	if err := json.NewDecoder(r.Body).Decode(&reqs); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	ctx := r.Context()

	workerLimit := cloudhub.WorkerLimit
	sem := make(chan struct{}, workerLimit)

	var wg sync.WaitGroup
	failedRequests := make(chan snmpReqError, len(reqs))
	results := make(chan SNMPResponse, len(reqs))

	for i, config := range reqs {
		wg.Add(1)
		sem <- struct{}{}
		i := i
		go func(ctx context.Context, config SNMPConfig, index int) {
			defer wg.Done()
			defer func() { <-sem }()
			snmpResult, err := s.testSNMP(config, index)
			if err != nil {
				failedRequests <- snmpReqError{
					Index:        index,
					DeviceIP:     config.DeviceIP,
					ErrorMessage: err.Error(),
				}
				return
			}
			results <- snmpResult

		}(ctx, config, i)
	}
	go func() {
		wg.Wait()
		close(results)
		close(failedRequests)
	}()

	var allResults []SNMPResponse
	for result := range results {
		allResults = append(allResults, result)
	}
	var failedResults []snmpReqError
	for failedRes := range failedRequests {
		failedResults = append(failedResults, failedRes)
	}
	response := map[string]interface{}{
		"failed_requests": failedResults,
		"results":         allResults,
	}
	encodeJSON(w, http.StatusOK, response, s.Logger)
}

func (s *Service) testSNMP(config SNMPConfig, i int) (SNMPResponse, error) {
	queries := []SNMPQuery{
		{Oid: "1.3.6.1.2.1.1.5", Key: "hostname", Process: processHostname},
		{Oid: "1.3.6.1.2.1.1.7", Key: "deviceType", Process: processDeviceType},
		{Oid: "1.3.6.1.2.1.1.1", Key: "deviceOS", Process: processDeviceOS},
	}

	results, err := collectSNMPData(&config, queries)
	if err != nil {
		return SNMPResponse{}, err
	}
	return SNMPResponse{
		DeviceIP:   config.DeviceIP,
		Index:      i,
		DeviceType: results["deviceType"],
		Hostname:   results["hostname"],
		DeviceOS:   results["deviceOS"],
	}, nil
}

func parseAuthProtocol(authProtocol string) (gosnmp.SnmpV3AuthProtocol, error) {
	switch strings.ToUpper(authProtocol) {
	case "MD5":
		return gosnmp.MD5, nil
	case "SHA":
		return gosnmp.SHA, nil
	case "SHA2":
		return gosnmp.SHA256, nil
	case "HMAC128SHA224":
		return gosnmp.SHA224, nil
	case "HMAC192SHA256":
		return gosnmp.SHA256, nil
	case "HMAC256SHA384":
		return gosnmp.SHA384, nil
	case "HMAC384SHA512":
		return gosnmp.SHA512, nil
	default:
		return gosnmp.NoAuth, fmt.Errorf("unsupported SNMP v3 auth protocol: %s", authProtocol)
	}
}

func parsePrivProtocol(privProtocol string) (gosnmp.SnmpV3PrivProtocol, error) {
	switch strings.ToUpper(privProtocol) {
	case "DES":
		return gosnmp.DES, nil
	case "AES", "AES128":
		return gosnmp.AES, nil
	case "AES192":
		return gosnmp.AES192, nil
	case "AES256":
		return gosnmp.AES256, nil
	default:
		return gosnmp.NoPriv, fmt.Errorf("unsupported SNMP v3 priv protocol: %s", privProtocol)
	}
}

func parseSecurityLevel(securityLevel string) (gosnmp.SnmpV3MsgFlags, error) {
	switch strings.ToLower(securityLevel) {
	case "noauthnopriv":
		return gosnmp.NoAuthNoPriv, nil
	case "authnopriv":
		return gosnmp.AuthNoPriv, nil
	case "authpriv":
		return gosnmp.AuthPriv, nil
	default:
		return 0, fmt.Errorf("unsupported security level: %s", securityLevel)
	}
}

func parseProtocol(protocol string) (string, error) {
	switch strings.ToLower(protocol) {
	case "tcp", "tcp4", "tcp6", "udp", "udp4", "udp6":
		return protocol, nil
	default:
		return "", fmt.Errorf("unsupported protocol: %s", protocol)
	}
}
