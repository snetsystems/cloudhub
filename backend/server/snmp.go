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
	Community    string                    `json:"community"`
	DeviceIP     string                    `json:"device_ip"`
	Port         uint16                    `json:"port"`
	Version      string                    `json:"version"`
	Username     string                    `json:"snmp_user"`
	AuthPassword string                    `json:"snmp_auth_password"`
	AuthProtocol gosnmp.SnmpV3AuthProtocol `json:"snmp_v3_auth_protocol"`
	PrivPassword string                    `json:"snmp_private_password"`
	PrivProtocol gosnmp.SnmpV3PrivProtocol `json:"snmp_v3_private_protocol"`
	Protocol     string                    `json:"protocol"` // "tcp", "tcp4", "tcp6", "udp", "udp4", "udp6"
}

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
// Returns an error if the connection cannot be closed.
func (g *GoSNMPAdapter) Close() error {
	if g.Conn != nil {
		return g.Conn.Close()
	}
	return nil
}

// Connect establishes a connection using the embedded GoSNMP instance.
// Returns an error if the connection cannot be established.
func (g *GoSNMPAdapter) Connect() error {
	return g.GoSNMP.Connect()
}

// Walk performs an SNMP walk operation on the given OID using the provided walk function.
// The walk function is called for each variable retrieved during the walk.
// Returns an error if the walk operation fails.
func (g *GoSNMPAdapter) Walk(oid string, walkFn gosnmp.WalkFunc) error {
	return g.GoSNMP.Walk(oid, walkFn)
}

// Get retrieves SNMP variables for the given OIDs.
// Returns the SNMP packet containing the variables and an error if the get operation fails.
func (g *GoSNMPAdapter) Get(oids []string) (*gosnmp.SnmpPacket, error) {
	return g.GoSNMP.Get(oids)
}

// NewSNMPManager initializes a new SNMP manager.
func NewSNMPManager(config *SNMPConfig) (*SNMPManager, error) {
	version, err := parseSNMPVersion(config.Version)
	if err != nil {
		return nil, err
	}
	snmp := &gosnmp.GoSNMP{
		Target:    config.DeviceIP,
		Port:      config.Port,
		Community: config.Community,
		Version:   version,
		Timeout:   5 * time.Second,
		Retries:   3,
	}

	switch protocol := strings.ToLower(config.Protocol); protocol {
	case "tcp", "tcp4", "tcp6", "udp", "udp4", "udp6":
		snmp.Transport = protocol
	default:
		return nil, fmt.Errorf("unsupported protocol: %s", config.Protocol)
	}

	if version == gosnmp.Version3 {
		snmp.SecurityModel = gosnmp.UserSecurityModel
		snmp.MsgFlags = gosnmp.AuthPriv
		snmp.SecurityParameters = &gosnmp.UsmSecurityParameters{
			UserName:                 config.Username,
			AuthenticationProtocol:   config.AuthProtocol,
			AuthenticationPassphrase: config.AuthPassword,
			PrivacyProtocol:          config.PrivProtocol,
			PrivacyPassphrase:        config.PrivPassword,
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

// SNMPConnTestBulk handles the SNMP connections test request.
func (s *Service) SNMPConnTestBulk(w http.ResponseWriter, r *http.Request) {
	var reqs []SNMPConfig
	if err := json.NewDecoder(r.Body).Decode(&reqs); err != nil {
		invalidJSON(w, s.Logger)
		return
	}
	ctx := r.Context()

	workerLimit := 10 // This value can be adjusted based on system performance and requirements.
	sem := make(chan struct{}, workerLimit)

	var wg sync.WaitGroup
	failedRequests := []map[string]interface{}{}
	results := make(chan SNMPResponse, len(reqs))
	var mu sync.Mutex

	for i, config := range reqs {
		wg.Add(1)
		sem <- struct{}{}
		go func(ctx context.Context, config SNMPConfig, index int) {
			defer wg.Done()
			defer func() {

				if rec := recover(); rec != nil {
					s.Logger.Error("Recovered from panic: %v", rec)
					mu.Lock()
					failedRequests = append(failedRequests, map[string]interface{}{
						"index":        i,
						"device_ip":    config.DeviceIP,
						"errorMessage": "internal server error",
					})
					mu.Unlock()
				}
				<-sem
			}()
			snmpResult, err := s.testSNMP(ctx, config, index)
			if err != nil {
				mu.Lock()
				failedRequests = append(failedRequests, map[string]interface{}{
					"index":        index,
					"device_ip":    config.DeviceIP,
					"errorMessage": err.Error(),
				})
				mu.Unlock()
				return
			}
			results <- snmpResult
		}(ctx, config, i)
	}

	wg.Wait()
	close(results)

	var allResults []SNMPResponse
	for result := range results {
		allResults = append(allResults, result)
	}

	response := map[string]interface{}{
		"failed_requests": failedRequests,
		"results":         allResults,
	}
	encodeJSON(w, http.StatusOK, response, s.Logger)
}

func (s *Service) testSNMP(ctx context.Context, config SNMPConfig, i int) (SNMPResponse, error) {
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
