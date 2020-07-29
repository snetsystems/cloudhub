package main

import (
	"reflect"
	"context"
	"fmt"
	"io"
	"os"
	"strings"
	"text/tabwriter"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/kv"
	"github.com/snetsystems/cloudhub/backend/kv/bolt"
)

// NewBoltClient DBConnect
func NewBoltClient(path string) (kv.Store, error) {
	return bolt.NewClient(context.TODO(),
		bolt.WithPath(path),
	)
}

// NewService ...
func NewService(s kv.Store) (*kv.Service, error) {
	return kv.NewService(context.TODO(), s)
}

// NewTabWriter stores-info tab
func NewTabWriter() *tabwriter.Writer {
	return tabwriter.NewWriter(os.Stdout, 0, 8, 1, '\t', 0)
}

// WriteUserHeaders stores-info headers
func WriteUserHeaders(w io.Writer) {
	fmt.Fprintln(w, "ID\tName\tProvider\tScheme\tSuperAdmin\tOrganization(s)")
}

// WriteServerHeaders stores-info headers
func WriteServerHeaders(w io.Writer) {
	fmt.Fprintln(w, "ID\tActive\tInsecureSkipVerify\tName\tOrganization\tPassword\tSrcID\tType\tURL\tUsername")
}

// WriteLayoutsHeaders stores-info headers
func WriteLayoutsHeaders(w io.Writer) { 
	fmt.Fprintln(w, "ID\tApplication\tMeasurement\tAutoflow\tCells")
}

// WriteDashboardsHeaders stores-info headers
func WriteDashboardsHeaders(w io.Writer) {
	fmt.Fprintln(w, "ID\tName\tOrganization\tTemplates\tCells")
}

// WriteCellHeaders stores-info cell in Dashboards headers
func WriteCellHeaders(w io.Writer) {
	fmt.Fprintln(w, "ID\tName\tX\tY\tW\tH\tQuery")
}

// WriteOrganizationsHeaders stores-info headers
func WriteOrganizationsHeaders(w io.Writer) {
	fmt.Fprintln(w, "ID\tName\tDefaultRole")
}

// WriteConfigHeaders stores-info headers
func WriteConfigHeaders(w io.Writer) {
	fmt.Fprintln(w, "Auth")
}

// WriteMappingsHeaders stores-info headers
func WriteMappingsHeaders(w io.Writer) {
	fmt.Fprintln(w, "ID\tOrganization\tProvider\tScheme\tProviderOrganization")
}

// WriteOrganizationConfigHeaders stores-info headers
func WriteOrganizationConfigHeaders(w io.Writer) {
	fmt.Fprintln(w, "OrganizationID\tLogViewer")
}

// WriteColumnEncodingHeaders stores-info columnEncoding in OrganizationConfig headers
func WriteColumnEncodingHeaders(w io.Writer) {
	fmt.Fprintln(w, "Type\tValue\tName")
}

// WriteHeaders store headers
func WriteHeaders(w io.Writer, anything interface{}) {
	target := reflect.ValueOf(anything)
	elements := target.Elem()

	headers := []string{}

	for i := 0; i < elements.NumField(); i++ {
		headers = append(headers, fmt.Sprintf("%s\t", elements.Type().Field(i).Name))
	}

	fmt.Fprintf(w, "%s\n", strings.Join(headers, ""));
}

// WriteUser stores-info User
func WriteUser(w io.Writer, user *cloudhub.User) {
	orgs := []string{}
	for _, role := range user.Roles {
		orgs = append(orgs, role.Organization)
	}

	fmt.Fprintf(w, "%d\t%s\t%s\t%s\t%t\t%s\n", user.ID, user.Name, user.Provider, user.Scheme, user.SuperAdmin, strings.Join(orgs, ","))
}

// WriteServer stores-info Servers
func WriteServer(w io.Writer, server *cloudhub.Server) {
	fmt.Fprintf(w, "%d\t%t\t%t\t%s\t%s\t%s\t%d\t%s\t%s\t%s\n", server.ID, server.Active, server.InsecureSkipVerify, server.Name, server.Organization, server.Password, server.SrcID, server.Type, server.URL, server.Username)
}

// WriteLayout stores-info Layouts
func WriteLayout(w io.Writer, layout *cloudhub.Layout) {
	cells := []string{}
	for _, cell := range layout.Cells {
		cells = append(cells, cell.Name)
	}

	fmt.Fprintf(w, "%s\t%s\t%s\t%t\t%s\n", layout.ID, layout.Application, layout.Measurement, layout.Autoflow, strings.Join(cells, ","))
}

// WriteLalyoutCell stores-info Layouts
func WriteLalyoutCell(w io.Writer, layout *cloudhub.Layout) {
	queries := []string{}

	for _, cell := range layout.Cells {
		for _, querie := range cell.Queries {
			queries = append(queries, fmt.Sprintf("%s.%s|%s", querie.DB, querie.RP, querie.Command))	
		}

		fmt.Fprintf(w, "%s\t%s\t%d\t%d\t%d\t%d\t%s\n", cell.I, cell.Name, cell.X, cell.Y, cell.W, cell.H, strings.Join(queries, ","))
	}
}

// WriteDashboard stores-info Dashboards
func WriteDashboard(w io.Writer, dashboard *cloudhub.Dashboard) {
	cells := []string{}
	for _, cell := range dashboard.Cells {
		cells = append(cells, cell.Name)
	}

	templates := []string{}
	for _, template := range dashboard.Templates {
		templates = append(templates, template.Label)
	}

	fmt.Fprintf(w, "%d\t%s\t%s\t%s\t%s\n", dashboard.ID, dashboard.Name, dashboard.Organization, strings.Join(templates, ","), strings.Join(cells, ","))
}

// WriteCell stores-info Dashboards
func WriteCell(w io.Writer, dashboard *cloudhub.Dashboard) {
	queries := []string{}

	for _, dashboardCell := range dashboard.Cells {
		for _, dashboardQuery := range dashboardCell.Queries {
			queries = append(queries, fmt.Sprintf("%s", dashboardQuery.Command))	
		}

		fmt.Fprintf(w, "%s\t%s\t%d\t%d\t%d\t%d\t%s\n", dashboardCell.ID, dashboardCell.Name, dashboardCell.X, dashboardCell.Y, dashboardCell.W, dashboardCell.H, strings.Join(queries, ","))
	}
}

// WriteOrganization stores-info Organizations
func WriteOrganization(w io.Writer, organization *cloudhub.Organization) {
	fmt.Fprintf(w, "%s\t%s\t%s\n", organization.ID, organization.Name, organization.DefaultRole)
}

// WriteConfig stores-info Config
func WriteConfig(w io.Writer, config *cloudhub.Config) {
	fmt.Fprintf(w, "%t\n", config.Auth.SuperAdminNewUsers)
}

// WriteMappings stores-info Mappings
func WriteMappings(w io.Writer, mapping *cloudhub.Mapping) {
	//WriteHeaders(w, mapping)

	fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", mapping.ID, mapping.Organization, mapping.Provider, mapping.Scheme, mapping.ProviderOrganization)
}

// WriteOrganizationConfig stores-info OrganizationConfig
func WriteOrganizationConfig(w io.Writer, organizationConfig *cloudhub.OrganizationConfig) {
	logViewerColumns := []string{}
	for _, logViewerColumn := range organizationConfig.LogViewer.Columns {
		logViewerColumns = append(logViewerColumns, logViewerColumn.Name)
	}

	fmt.Fprintf(w, "%s\t%s\n", organizationConfig.OrganizationID, strings.Join(logViewerColumns, ","))
}

// WriteColumnEncoding stores-info OrganizationConfig
func WriteColumnEncoding(w io.Writer, organizationConfig *cloudhub.OrganizationConfig) {
	encodings := []string{}	
	for _, logViewerColumn := range organizationConfig.LogViewer.Columns {
		for _, encoding := range logViewerColumn.Encodings {
			encodings = append(encodings, fmt.Sprintf("%s|%s|%s", encoding.Type, encoding.Value, encoding.Name))	
		}

		fmt.Fprintf(w, "%s\t%d\t%s\n", logViewerColumn.Name, logViewerColumn.Position, strings.Join(encodings, ","))	
	}
}