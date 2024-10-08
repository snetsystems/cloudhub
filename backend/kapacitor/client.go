package kapacitor

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"regexp"

	client "github.com/influxdata/kapacitor/client/v1"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/id"
)

const (
	// Prefix is prepended to the ID of all alerts
	Prefix = "cloudhub-v1-"

	// FetchRate is the rate Paginating Kapacitor Clients will consume responses
	FetchRate = 100
)

var (
	skipVerifyTransport = &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	defaultTransport = &http.Transport{}
)

// Client communicates to kapacitor
type Client struct {
	URL                string
	Username           string
	Password           string
	InsecureSkipVerify bool
	ID                 cloudhub.ID
	Ticker             cloudhub.Ticker
	kapaClient         func(url, username, password string, insecureSkipVerify bool) (KapaClient, error)
}

// KapaClient represents a connection to a kapacitor instance
type KapaClient interface {
	CreateTask(opt client.CreateTaskOptions) (client.Task, error)
	Task(link client.Link, opt *client.TaskOptions) (client.Task, error)
	ListTasks(opt *client.ListTasksOptions) ([]client.Task, error)
	UpdateTask(link client.Link, opt client.UpdateTaskOptions) (client.Task, error)
	DeleteTask(link client.Link) error
}

// NewClient creates a client that interfaces with Kapacitor tasks
func NewClient(url, username, password string, insecureSkipVerify bool) *Client {
	return &Client{
		URL:                url,
		Username:           username,
		Password:           password,
		InsecureSkipVerify: insecureSkipVerify,
		ID:                 &id.UUID{},
		Ticker:             &Alert{},
		kapaClient:         NewKapaClient,
	}
}

// Task represents a running kapacitor task
type Task struct {
	ID         string              // Kapacitor ID
	Href       string              // Kapacitor relative URI
	HrefOutput string              // Kapacitor relative URI to HTTPOutNode
	Rule       cloudhub.AlertRule  // Rule is the rule that represents this Task
	TICKScript cloudhub.TICKScript // TICKScript is the running script
}

var reTaskName = regexp.MustCompile(`[\r\n]*var[ \t]+name[ \t]+=[ \t]+'([^']+)'`)

// TaskPreprocessor is an interface for processing tasks after they are updated.
// Implementations of this interface can define custom logic for handling
// the task based on specific requirements.
type TaskPreprocessor interface {
	Process(task *client.Task) *Task
}

// NewAITaskProcess is a struct that implements the TaskPreprocessor interface.
type NewAITaskProcess struct {
	Regex string
}

// Process processes the provided task using the regex pattern and returns a new AI Task.
func (p NewAITaskProcess) Process(task *client.Task) *Task {
	return NewAITask(task, p.Regex)
}

// NewTaskProcess is a struct that implements the TaskPreprocessor interface.
type NewTaskProcess struct{}

// Process processes the provided task and returns a new Task.
// It creates a new Task using the NewTask function.
func (p NewTaskProcess) Process(task *client.Task) *Task {
	return NewTask(task)
}

// NewTask creates a task from a kapacitor client task
func NewTask(task *client.Task) *Task {
	dbrps := make([]cloudhub.DBRP, len(task.DBRPs))
	for i := range task.DBRPs {
		dbrps[i].DB = task.DBRPs[i].Database
		dbrps[i].RP = task.DBRPs[i].RetentionPolicy
	}

	script := cloudhub.TICKScript(task.TICKscript)
	rule, err := Reverse(script)
	if err != nil {
		// try to parse Name from a line such as: `var name = 'Rule Name'
		name := task.ID
		if matches := reTaskName.FindStringSubmatch(task.TICKscript); matches != nil {
			name = matches[1]
		}
		rule = cloudhub.AlertRule{
			Name:  name,
			Query: nil,
		}
	}

	rule.ID = task.ID
	rule.TICKScript = script
	rule.Type = task.Type.String()
	rule.DBRPs = dbrps
	rule.Status = task.Status.String()
	rule.Executing = task.Executing
	rule.Error = task.Error
	rule.Created = task.Created
	rule.Modified = task.Modified
	rule.LastEnabled = task.LastEnabled
	return &Task{
		ID:         task.ID,
		Href:       task.Link.Href,
		HrefOutput: HrefOutput(task.ID),
		Rule:       rule,
	}
}

// NewAITask creates a task from a kapacitor client  AI task
func NewAITask(task *client.Task, regex string) *Task {
	dbrps := make([]cloudhub.DBRP, len(task.DBRPs))
	for i := range task.DBRPs {
		dbrps[i].DB = task.DBRPs[i].Database
		dbrps[i].RP = task.DBRPs[i].RetentionPolicy
	}

	script := cloudhub.TICKScript(task.TICKscript)
	rule, err := TargetedReverseParser(script, regex)
	if err != nil {
		name := task.ID
		if matches := reTaskName.FindStringSubmatch(task.TICKscript); matches != nil {
			name = matches[1]
		}
		rule = cloudhub.AlertRule{
			Name:  name,
			Query: nil,
		}
	}

	rule.ID = task.ID
	rule.TICKScript = script
	rule.Type = task.Type.String()
	rule.DBRPs = dbrps
	rule.Error = task.Error
	rule.Status = task.Status.String()
	rule.Executing = task.Executing
	rule.Created = task.Created
	rule.Modified = task.Modified
	rule.LastEnabled = task.LastEnabled
	return &Task{
		ID:         task.ID,
		Href:       task.Link.Href,
		HrefOutput: HrefOutput(task.ID),
		Rule:       rule,
	}
}

// HrefOutput returns the link to a kapacitor task httpOut Node given an id
func HrefOutput(ID string) string {
	return fmt.Sprintf("/kapacitor/v1/tasks/%s/%s", ID, HTTPEndpoint)
}

// Href returns the link to a kapacitor task given an id
func (c *Client) Href(ID string) string {
	return fmt.Sprintf("/kapacitor/v1/tasks/%s", ID)
}

// HrefOutput returns the link to a kapacitor task httpOut Node given an id
func (c *Client) HrefOutput(ID string) string {
	return HrefOutput(ID)
}

// Create builds and POSTs a tickscript to kapacitor
func (c *Client) Create(ctx context.Context, rule cloudhub.AlertRule) (*Task, error) {
	var opt *client.CreateTaskOptions
	var err error
	if rule.Query != nil {
		opt, err = c.createFromQueryConfig(rule)
	} else {
		opt, err = c.createFromTick(rule)
	}

	if err != nil {
		return nil, err
	}

	kapa, err := c.kapaClient(c.URL, c.Username, c.Password, c.InsecureSkipVerify)
	if err != nil {
		return nil, err
	}

	task, err := kapa.CreateTask(*opt)
	if err != nil {
		return nil, err
	}

	return NewTask(&task), nil
}

// AutoGenerateCreate builds and POSTs a tickScript to kapacitor
func (c *Client) AutoGenerateCreate(ctx context.Context, taskOptions *client.CreateTaskOptions) (*Task, error) {

	kapa, err := c.kapaClient(c.URL, c.Username, c.Password, c.InsecureSkipVerify)
	if err != nil {
		return nil, err
	}

	task, err := kapa.CreateTask(*taskOptions)
	if err != nil {
		return nil, err
	}

	return NewTask(&task), nil
}

// AutoGenerateUpdate Update a tickScript to kapacitor
func (c *Client) AutoGenerateUpdate(ctx context.Context, taskOptions *client.UpdateTaskOptions, href string, preprocessor TaskPreprocessor) (*Task, error) {
	kapa, err := c.kapaClient(c.URL, c.Username, c.Password, c.InsecureSkipVerify)
	if err != nil {
		return nil, err
	}
	originalStatus := taskOptions.Status
	if originalStatus == client.Enabled {
		taskOptions.Status = client.Disabled
	}

	task, err := kapa.UpdateTask(client.Link{Href: href}, *taskOptions)
	if err != nil {
		return nil, err
	}
	// Now enable the task if previously enabled
	if originalStatus == client.Enabled {
		if _, err := c.Enable(ctx, href); err != nil {
			return nil, err
		}
	}

	return preprocessor.Process(&task), nil
}

func (c *Client) createFromTick(rule cloudhub.AlertRule) (*client.CreateTaskOptions, error) {
	dbrps := make([]client.DBRP, len(rule.DBRPs))
	for i := range rule.DBRPs {
		dbrps[i] = client.DBRP{
			Database:        rule.DBRPs[i].DB,
			RetentionPolicy: rule.DBRPs[i].RP,
		}
	}

	status := client.Enabled
	if rule.Status != "" {
		if err := status.UnmarshalText([]byte(rule.Status)); err != nil {
			return nil, err
		}
	}

	taskType := client.StreamTask
	if rule.Type != "stream" {
		if err := taskType.UnmarshalText([]byte(rule.Type)); err != nil {
			return nil, err
		}
	}

	return &client.CreateTaskOptions{
		ID:         rule.Name,
		Type:       taskType,
		DBRPs:      dbrps,
		TICKscript: string(rule.TICKScript),
		Status:     status,
	}, nil
}

func (c *Client) createFromQueryConfig(rule cloudhub.AlertRule) (*client.CreateTaskOptions, error) {
	id, err := c.ID.Generate()
	if err != nil {
		return nil, err
	}

	script, err := c.Ticker.Generate(rule)
	if err != nil {
		return nil, err
	}

	kapaID := Prefix + id
	return &client.CreateTaskOptions{
		ID:         kapaID,
		Type:       toTask(rule.Query),
		DBRPs:      []client.DBRP{{Database: rule.Query.Database, RetentionPolicy: rule.Query.RetentionPolicy}},
		TICKscript: string(script),
		Status:     client.Enabled,
	}, nil
}

// Delete removes tickscript task from kapacitor
func (c *Client) Delete(ctx context.Context, href string) error {
	kapa, err := c.kapaClient(c.URL, c.Username, c.Password, c.InsecureSkipVerify)
	if err != nil {
		return err
	}
	return kapa.DeleteTask(client.Link{Href: href})
}

func (c *Client) updateStatus(ctx context.Context, href string, status client.TaskStatus) (*Task, error) {
	kapa, err := c.kapaClient(c.URL, c.Username, c.Password, c.InsecureSkipVerify)
	if err != nil {
		return nil, err
	}

	opts := client.UpdateTaskOptions{
		Status: status,
	}

	task, err := kapa.UpdateTask(client.Link{Href: href}, opts)
	if err != nil {
		return nil, err
	}

	return NewTask(&task), nil
}

// Disable changes the tickscript status to disabled for a given href.
func (c *Client) Disable(ctx context.Context, href string) (*Task, error) {
	return c.updateStatus(ctx, href, client.Disabled)
}

// Enable changes the tickscript status to disabled for a given href.
func (c *Client) Enable(ctx context.Context, href string) (*Task, error) {
	return c.updateStatus(ctx, href, client.Enabled)
}

// Status returns the status of a task in kapacitor
func (c *Client) Status(ctx context.Context, href string) (string, error) {
	s, err := c.status(ctx, href)
	if err != nil {
		return "", err
	}

	return s.String(), nil
}

func (c *Client) status(ctx context.Context, href string) (client.TaskStatus, error) {
	kapa, err := c.kapaClient(c.URL, c.Username, c.Password, c.InsecureSkipVerify)
	if err != nil {
		return 0, err
	}
	task, err := kapa.Task(client.Link{Href: href}, nil)
	if err != nil {
		return 0, err
	}

	return task.Status, nil
}

// All returns all tasks in kapacitor
func (c *Client) All(ctx context.Context) (map[string]*Task, error) {
	kapa, err := c.kapaClient(c.URL, c.Username, c.Password, c.InsecureSkipVerify)
	if err != nil {
		return nil, err
	}

	// Only get the status, id and link section back
	opts := &client.ListTasksOptions{}
	tasks, err := kapa.ListTasks(opts)
	if err != nil {
		return nil, err
	}

	all := map[string]*Task{}
	for _, task := range tasks {
		all[task.ID] = NewTask(&task)
	}
	return all, nil
}

// Reverse builds a cloudhub.AlertRule and its QueryConfig from a tickscript
func (c *Client) Reverse(id string, script cloudhub.TICKScript) cloudhub.AlertRule {
	rule, err := Reverse(script)
	if err != nil {
		return cloudhub.AlertRule{
			ID:         id,
			Name:       id,
			Query:      nil,
			TICKScript: script,
		}
	}
	rule.ID = id
	rule.TICKScript = script
	return rule
}

// Get returns a single alert in kapacitor
func (c *Client) Get(ctx context.Context, id string) (*Task, error) {
	kapa, err := c.kapaClient(c.URL, c.Username, c.Password, c.InsecureSkipVerify)
	if err != nil {
		return nil, err
	}
	href := c.Href(id)
	task, err := kapa.Task(client.Link{Href: href}, nil)
	if err != nil {
		return nil, cloudhub.ErrAlertNotFound
	}

	return NewTask(&task), nil
}

// Update changes the tickscript of a given id.
func (c *Client) Update(ctx context.Context, href string, rule cloudhub.AlertRule) (*Task, error) {
	kapa, err := c.kapaClient(c.URL, c.Username, c.Password, c.InsecureSkipVerify)
	if err != nil {
		return nil, err
	}

	prevStatus, err := c.status(ctx, href)
	if err != nil {
		return nil, err
	}

	var opt *client.UpdateTaskOptions
	if rule.Query != nil {
		opt, err = c.updateFromQueryConfig(rule)
	} else {
		opt, err = c.updateFromTick(rule)
	}
	if err != nil {
		return nil, err
	}

	task, err := kapa.UpdateTask(client.Link{Href: href}, *opt)
	if err != nil {
		return nil, err
	}

	// Now enable the task if previously enabled
	if prevStatus == client.Enabled {
		if _, err := c.Enable(ctx, href); err != nil {
			return nil, err
		}
	}

	return NewTask(&task), nil
}

func (c *Client) updateFromQueryConfig(rule cloudhub.AlertRule) (*client.UpdateTaskOptions, error) {
	script, err := c.Ticker.Generate(rule)
	if err != nil {
		return nil, err
	}

	// We need to disable the kapacitor task followed by enabling it during update.
	return &client.UpdateTaskOptions{
		TICKscript: string(script),
		Status:     client.Disabled,
		Type:       toTask(rule.Query),
		DBRPs: []client.DBRP{
			{
				Database:        rule.Query.Database,
				RetentionPolicy: rule.Query.RetentionPolicy,
			},
		},
	}, nil
}

func (c *Client) updateFromTick(rule cloudhub.AlertRule) (*client.UpdateTaskOptions, error) {
	dbrps := make([]client.DBRP, len(rule.DBRPs))
	for i := range rule.DBRPs {
		dbrps[i] = client.DBRP{
			Database:        rule.DBRPs[i].DB,
			RetentionPolicy: rule.DBRPs[i].RP,
		}
	}

	taskType := client.StreamTask
	if rule.Type != "stream" {
		if err := taskType.UnmarshalText([]byte(rule.Type)); err != nil {
			return nil, err
		}
	}

	// We need to disable the kapacitor task followed by enabling it during update.
	return &client.UpdateTaskOptions{
		TICKscript: string(rule.TICKScript),
		Status:     client.Disabled,
		Type:       taskType,
		DBRPs:      dbrps,
	}, nil
}

func toTask(q *cloudhub.QueryConfig) client.TaskType {
	if q == nil || q.RawText == nil || *q.RawText == "" {
		return client.StreamTask
	}
	return client.BatchTask
}

// NewKapaClient creates a Kapacitor client connection
func NewKapaClient(url, username, password string, insecureSkipVerify bool) (KapaClient, error) {
	var creds *client.Credentials
	if username != "" {
		creds = &client.Credentials{
			Method:   client.UserAuthentication,
			Username: username,
			Password: password,
		}
	}

	var transport http.RoundTripper

	if insecureSkipVerify {
		transport = skipVerifyTransport
	} else {
		transport = defaultTransport
	}

	clnt, err := client.New(client.Config{
		URL:                url,
		Credentials:        creds,
		InsecureSkipVerify: insecureSkipVerify,
		Transport:          transport,
	})

	if err != nil {
		return clnt, err
	}

	return &PaginatingKapaClient{clnt, FetchRate}, nil
}

// GetAITask returns a single alert in kapacitor
func (c *Client) GetAITask(ctx context.Context, id string, regex string) (*Task, error) {
	kapa, err := c.kapaClient(c.URL, c.Username, c.Password, c.InsecureSkipVerify)
	if err != nil {
		return nil, err
	}
	href := c.Href(id)
	task, err := kapa.Task(client.Link{Href: href}, nil)
	if err != nil {
		return nil, cloudhub.ErrAlertNotFound
	}

	return NewAITask(&task, regex), nil
}
