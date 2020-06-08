package main

import (
	"context"
)

// StoreCommand Flags
type StoreCommand struct {
	BoltPath string `short:"b" long:"bolt-path" description:"Full path to boltDB file (e.g. './cloudhub-v1.db')" required:"true"`
	StoreType string `short:"s" long:"store-type" description:"Type of boltDB store (e.g. User, Build, Servers, Layouts, Dashboards, Organizations, Config, Mappings, OrganizationConfig)" required:"true"`
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

		WriteLayoutsHeaders(w)
		for _, layout := range layouts {
			WriteLayout(w, &layout)
		}
	case "Dashboards":
		dashboards, err := c.DashboardsStore.All(ctx)
		if err != nil {
			return err
		}

		WriteDashboardsHeaders(w)
		for _, dashboard := range dashboards {
			WriteDashboard(w, &dashboard)
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

		WriteOrganizationConfigHeaders(w)
		for _, organizationConfig := range organizationConfigs {
			WriteOrganizationConfig(w, &organizationConfig)
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