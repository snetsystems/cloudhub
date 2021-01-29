package server

import (
	"context"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/influx"
)

// Service handles REST calls to the persistence
type Service struct {
	Store                    DataStore
	TimeSeriesClient         TimeSeriesClient
	Logger                   cloudhub.Logger
	UseAuth                  bool
	SuperAdminProviderGroups superAdminProviderGroups
	Env                      cloudhub.Environment
	Databases                cloudhub.Databases
	AddonURLs                map[string]string
	MailSubject              string
	MailBody                 string
	ProgramPath              string
	ExecuteFile              string
	BasicAuth                bool
}

type superAdminProviderGroups struct {
	auth0 string
}

// TimeSeriesClient returns the correct client for a time series database.
// todo(glinton): should this be always reconnecting?
type TimeSeriesClient interface {
	New(cloudhub.Source, cloudhub.Logger) (cloudhub.TimeSeries, error)
}

// ErrorMessage is the error response format for all service errors
type ErrorMessage struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// TimeSeries returns a new client connected to a time series database
func (s *Service) TimeSeries(src cloudhub.Source) (cloudhub.TimeSeries, error) {
	return s.TimeSeriesClient.New(src, s.Logger)
}

// InfluxClient returns a new client to connect to OSS
type InfluxClient struct{}

// New creates a client to connect to OSS
func (c *InfluxClient) New(src cloudhub.Source, logger cloudhub.Logger) (cloudhub.TimeSeries, error) {
	client := &influx.Client{
		Logger: logger,
	}
	if err := client.Connect(context.TODO(), &src); err != nil {
		return nil, err
	}

	return client, nil
}
