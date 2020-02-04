package server

import (
	"context"

	cmp "github.com/snetsystems/cmp/backend"
	"github.com/snetsystems/cmp/backend/influx"
)

// Service handles REST calls to the persistence
type Service struct {
	Store                    DataStore
	TimeSeriesClient         TimeSeriesClient
	Logger                   cmp.Logger
	UseAuth                  bool
	SuperAdminProviderGroups superAdminProviderGroups
	Env                      cmp.Environment
	Databases                cmp.Databases
	AddonURLs                map[string]string
}

type superAdminProviderGroups struct {
	auth0 string
}

// TimeSeriesClient returns the correct client for a time series database.
type TimeSeriesClient interface {
	New(cmp.Source, cmp.Logger) (cmp.TimeSeries, error)
}

// ErrorMessage is the error response format for all service errors
type ErrorMessage struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// TimeSeries returns a new client connected to a time series database
func (s *Service) TimeSeries(src cmp.Source) (cmp.TimeSeries, error) {
	return s.TimeSeriesClient.New(src, s.Logger)
}

// InfluxClient returns a new client to connect to OSS
type InfluxClient struct{}

// New creates a client to connect to OSS
func (c *InfluxClient) New(src cmp.Source, logger cmp.Logger) (cmp.TimeSeries, error) {
	client := &influx.Client{
		Logger: logger,
	}
	if err := client.Connect(context.TODO(), &src); err != nil {
		return nil, err
	}

	return client, nil
}
