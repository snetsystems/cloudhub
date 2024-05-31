package server

import (
	"bytes"
	"encoding/json"
)

// FormatTestResultJSON is Test Result string to json format convert
func FormatTestResultJSON(s string) (string, error) {
	var formatted bytes.Buffer
	err := json.Indent(&formatted, []byte(s), "", "  ")
	return formatted.String(), err
}
