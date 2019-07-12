package server

import (
	"fmt"

	cmp "github.com/snetsystems/cmp/backend"
	"github.com/snetsystems/cmp/backend/influx"
)

// ToQueryConfig converts InfluxQL into queryconfigs
// If influxql cannot be represented by a full query config, then, the
// query config's raw text is set to the query.
func ToQueryConfig(query string) cmp.QueryConfig {
	qc, err := influx.Convert(query)
	if err == nil {
		return qc
	}
	return cmp.QueryConfig{
		RawText: &query,
		Fields:  []cmp.Field{},
		GroupBy: cmp.GroupBy{
			Tags: []string{},
		},
		Tags: make(map[string][]string, 0),
	}
}

var validFieldTypes = map[string]bool{
	"func":     true,
	"field":    true,
	"integer":  true,
	"number":   true,
	"regex":    true,
	"wildcard": true,
}

// ValidateQueryConfig checks any query config input
func ValidateQueryConfig(q *cmp.QueryConfig) error {
	for _, fld := range q.Fields {
		invalid := fmt.Errorf(`invalid field type "%s" ; expect func, field, integer, number, regex, wildcard`, fld.Type)
		if !validFieldTypes[fld.Type] {
			return invalid
		}
		for _, arg := range fld.Args {
			if !validFieldTypes[arg.Type] {
				return invalid
			}
		}
	}
	return nil
}
