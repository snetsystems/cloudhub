package kapacitor

import (
	"fmt"

	cmp "github.com/snetsystems/cmp/backend"
)

// HTTPEndpoint is the default location of the tickscript output
const HTTPEndpoint = "output"

// HTTPOut adds a kapacitor httpOutput to a tickscript
func HTTPOut(rule cmp.AlertRule) (string, error) {
	return fmt.Sprintf(`trigger|httpOut('%s')`, HTTPEndpoint), nil
}
