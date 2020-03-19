package kapacitor

import (
	"fmt"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// HTTPEndpoint is the default location of the tickscript output
const HTTPEndpoint = "output"

// HTTPOut adds a kapacitor httpOutput to a tickscript
func HTTPOut(rule cloudhub.AlertRule) (string, error) {
	return fmt.Sprintf(`trigger|httpOut('%s')`, HTTPEndpoint), nil
}
