package mocks

import (
	"errors"

	"github.com/gosnmp/gosnmp"
)

// SNMPConnection is a mock of SNMPInterface to simulate SNMP operations.
type SNMPConnection struct {
	Host      string
	Data      map[string]interface{}
	Connected bool
}

// Walk simulates walking through SNMP data.
func (m *SNMPConnection) Walk(oid string, walkFn gosnmp.WalkFunc) error {
	if !m.Connected {
		return errors.New("not connected to SNMP server")
	}
	for k, v := range m.Data {
		if k == oid {
			pdu := gosnmp.SnmpPDU{
				Name:  k,
				Type:  gosnmp.OctetString,
				Value: v,
			}
			if err := walkFn(pdu); err != nil {
				return err
			}
		}
	}
	return nil
}

// Get simulates an SNMP Get operation.
func (m *SNMPConnection) Get(oids []string) (*gosnmp.SnmpPacket, error) {
	if !m.Connected {
		return nil, errors.New("not connected to SNMP server")
	}
	variables := make([]gosnmp.SnmpPDU, len(oids))
	for i, oid := range oids {
		if value, ok := m.Data[oid]; ok {
			variables[i] = gosnmp.SnmpPDU{
				Name:  oid,
				Type:  gosnmp.OctetString,
				Value: value,
			}
		} else {
			variables[i] = gosnmp.SnmpPDU{
				Name:  oid,
				Type:  gosnmp.NoSuchObject,
				Value: nil,
			}
		}
	}
	return &gosnmp.SnmpPacket{Variables: variables}, nil
}

// Connect simulates connecting to an SNMP server.
func (m *SNMPConnection) Connect() error {
	m.Connected = true
	return nil
}

// Close simulates closing the connection to the SNMP server.
func (m *SNMPConnection) Close() error {
	m.Connected = false
	return nil
}
