package mocks

import (
	client "github.com/influxdata/kapacitor/client/v1"
	"github.com/snetsystems/cloudhub/backend/kapacitor"
)

var _ kapacitor.KapaClient = &KapaClient{}

// KapaClient Client is a mock Kapacitor client
type KapaClient struct {
	CreateTaskF func(opts client.CreateTaskOptions) (client.Task, error)
	DeleteTaskF func(link client.Link) error
	ListTasksF  func(opts *client.ListTasksOptions) ([]client.Task, error)
	TaskF       func(link client.Link, opts *client.TaskOptions) (client.Task, error)
	UpdateTaskF func(link client.Link, opts client.UpdateTaskOptions) (client.Task, error)
}

// CreateTask ...
func (p *KapaClient) CreateTask(opts client.CreateTaskOptions) (client.Task, error) {
	return p.CreateTaskF(opts)
}

// DeleteTask ...
func (p *KapaClient) DeleteTask(link client.Link) error {
	return p.DeleteTaskF(link)
}

// ListTasks ...
func (p *KapaClient) ListTasks(opts *client.ListTasksOptions) ([]client.Task, error) {
	return p.ListTasksF(opts)
}

// Task ...
func (p *KapaClient) Task(link client.Link, opts *client.TaskOptions) (client.Task, error) {
	return p.TaskF(link, opts)
}

// UpdateTask ...
func (p *KapaClient) UpdateTask(link client.Link, opts client.UpdateTaskOptions) (client.Task, error) {
	return p.UpdateTaskF(link, opts)
}
