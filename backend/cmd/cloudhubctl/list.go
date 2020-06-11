package main

import (
	"context"
	"strconv"

	cloudhub "github.com/snetsystems/cloudhub/backend"
)

// StoreCommand Flags
type StoreCommand struct {
	BoltPath string `short:"b" long:"bolt-path" description:"Full path to boltDB file (e.g. './cloudhub-v1.db')" required:"true"`
	StoreType string `short:"s" long:"store-type" description:"Type of boltDB store (e.g. User, Build, Servers, Layouts, Dashboards, Organizations, Config, Mappings, OrganizationConfig)" required:"true"`
	ID int `short:"i" long:"id" description:"Details of the instance in the store(Layouts, Dashboards, OrganizationConfig). (e.g. 1, 2)"`
}

var storeCommand StoreCommand

// Execute list-store
func (s *StoreCommand) Execute(args []string) error {
	c, err := NewBoltClient(s.BoltPath)
	if err != nil {
		return err
	}
	defer c.Close()

	ctx := context.Background()
	w := NewTabWriter()
	
	switch s.StoreType {
	case "User":
		users, err := c.UsersStore.All(ctx)
		if err != nil {
			return err
		}

		WriteUserHeaders(w)
		for _, user := range users {
			WriteUser(w, &user)
		}
	case "Servers":
		servers, err := c.ServersStore.All(ctx)
		if err != nil {
			return err
		}

		WriteServerHeaders(w)
		for _, server := range servers {
			WriteServer(w, &server)
		}
	case "Layouts":
		layouts, err := c.LayoutsStore.All(ctx)
		if err != nil {
			return err
		}

		if s.ID == 0 {
			WriteLayoutsHeaders(w)
			for _, layout := range layouts {
				WriteLayout(w, &layout)
			}
		} else {
			WriteCellHeaders(w)
			id := strconv.Itoa(s.ID)

			for _, layout := range layouts {
				if id == layout.ID {
					WriteLalyoutCell(w, &layout)
					break
				}
			}
		}
	case "Dashboards":
		dashboards, err := c.DashboardsStore.All(ctx)
		if err != nil {
			return err
		}

		if s.ID == 0 {
			WriteDashboardsHeaders(w)
			for _, dashboard := range dashboards {
				WriteDashboard(w, &dashboard)
			}
		} else {
			WriteCellHeaders(w)
			id := cloudhub.DashboardID(s.ID)

			for _, dashboard := range dashboards {
				if id == dashboard.ID {
					WriteCell(w, &dashboard)
					break
				}
			}
		}
	case "Organizations":
		organizations, err := c.OrganizationsStore.All(ctx)
		if err != nil {
			return err
		}

		WriteOrganizationsHeaders(w)
		for _, organization := range organizations {
			WriteOrganization(w, &organization)
		}
		
	case "Config":
		configs, err := c.ConfigStore.All(ctx)
		if err != nil {
			return err
		}

		WriteConfigHeaders(w)
		for _, config := range configs {
			WriteConfig(w, &config)
		}
	case "Mappings":
		mappings, err := c.MappingsStore.All(ctx)
		if err != nil {
			return err
		}

		WriteMappingsHeaders(w)
		for _, mapping := range mappings {
			WriteMappings(w, &mapping)
		}
	case "OrganizationConfig":
		organizationConfigs, err := c.OrganizationConfigStore.All(ctx)
		if err != nil {
			return err
		}

		if s.ID == 0 {
			WriteOrganizationConfigHeaders(w)
			for _, organizationConfig := range organizationConfigs {
				WriteOrganizationConfig(w, &organizationConfig)
			}
		} else {
			WriteColumnEncodingHeaders(w)
			id := strconv.Itoa(s.ID)

			for _, organizationConfig := range organizationConfigs {
				if id == organizationConfig.OrganizationID {
					WriteColumnEncoding(w, &organizationConfig)
					break
				}
			}
		}
	default:
		return nil
	}

	w.Flush()
	
	return nil
}

func init() {
	parser.AddCommand("stores-info",
		"Boltdb store instances infomation",
		"The stores-info command lists cloudhub boltdb store instances.",
		&storeCommand)
}