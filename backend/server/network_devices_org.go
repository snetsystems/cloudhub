package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/influxdata/kapacitor/client/v1"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	kapa "github.com/snetsystems/cloudhub/backend/kapacitor"
)

// AllDevicesOrg returns all devices within the store.
func (s *Service) AllDevicesOrg(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	devices, err := s.Store.NetworkDeviceOrg(ctx).All(ctx)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error(), s.Logger)
		return
	}

	res := newDevicesOrgResponse(ctx, s, devices)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

type devicesOrgResponse struct {
	Organizations []*deviceOrgResponse `json:"organizations"`
}
type deviceOrgResponse struct {
	ID                  string               `json:"organization"`
	LoadModule          string               `json:"load_module"`
	MLFunction          string               `json:"ml_function"`
	DataDuration        int                  `json:"data_duration"`
	LearnedDevicesIDs   []uint64             `json:"learned_devices_ids"`
	CollectorServer     string               `json:"collector_server"`
	CollectedDevicesIDs []uint64             `json:"collected_devices_ids"`
	AIKapacitor         cloudhub.AIKapacitor `json:"ai_kapacitor"`
}
type updateDeviceOrgRequest struct {
	LoadModule          *string               `json:"load_module,omitempty"`
	MLFunction          *string               `json:"ml_function,omitempty"`
	DataDuration        *int                  `json:"data_duration,omitempty"`
	CollectedDevicesIDs *[]uint64             `json:"collected_devices_ids"`
	LearnedDevicesIDs   *[]uint64             `json:"learned_devices_ids"`
	AIKapacitor         *cloudhub.AIKapacitor `json:"ai_kapacitor"`
	RelearnCycle        *string               `json:"relearn_cycle"`
}

type deviceOrgRequest struct {
	ID           string                `json:"organization"`
	MLFunction   *string               `json:"ml_function"`
	DataDuration *int                  `json:"data_duration"`
	RelearnCycle *string               `json:"relearn_cycle"`
	AIKapacitor  *cloudhub.AIKapacitor `json:"ai_kapacitor"`
}

type deviceOrgError struct {
	Index        int    `json:"index"`
	OrgID        string `json:"organization_id,omitempty"`
	ErrorMessage string `json:"errorMessage"`
}

//InfluxdbInfo InfluxDB access Info
type InfluxdbInfo struct {
	Origin   string
	Port     string
	Username string
	Password string
}

// MLFunctionMultiplied represents an ML algorithm for multiplication-based operations.
const MLFunctionMultiplied = "ml_multiplied"

// MLFunctionScalingNormalized represents an ML algorithm for scaling and normalization.
const MLFunctionScalingNormalized = "ml_scaling_normalized"

// MLFunctionGaussianStd represents an ML algorithm for Gaussian standard deviation calculations.
const MLFunctionGaussianStd = "ml_gaussian_std"

// ML/DL Setting
const (
	LoadModule   = "loader.cloudhub.ch_nx_load"
	MLFunction   = MLFunctionMultiplied
	DataDuration = 15
	RelearnCycle = "1 0 1,15 * *"
)

func isAllowedMLFunction(function string) bool {
	switch function {
	case MLFunctionMultiplied, MLFunctionScalingNormalized, MLFunctionGaussianStd:
		return true
	default:
		return false
	}
}

func (r *deviceOrgRequest) validCreate() error {
	if r.ID == "" {
		return fmt.Errorf("organization required in device org request body")
	}
	if !isAllowedMLFunction(*r.MLFunction) {
		return fmt.Errorf("invalid ml_function in device request body")
	}
	if r.DataDuration == nil {
		return fmt.Errorf("data_duration required in device org request body")
	}
	if r.AIKapacitor == nil {
		return fmt.Errorf("AI Kapacitor required in device org request body")
	}
	if r.AIKapacitor.KapaURL == "" {
		return fmt.Errorf("AI Kapacitor URL required in device org request body")
	}
	if r.RelearnCycle != nil {
		return fmt.Errorf("AI RelearnCycle required in device org request body")
	}

	return nil
}

func (r *updateDeviceOrgRequest) validUpdate() error {
	return nil
}

func newDevicesOrgResponse(ctx context.Context, s *Service, devicesOrg []cloudhub.NetworkDeviceOrg) *devicesOrgResponse {
	Organizations := []*deviceOrgResponse{}
	for _, org := range devicesOrg {
		data, err := newDeviceOrgResponse(ctx, s, &org)
		if err == nil {

			Organizations = append(Organizations, data)
		}
	}

	return &devicesOrgResponse{
		Organizations: Organizations,
	}
}

func newDeviceOrgResponse(ctx context.Context, s *Service, deviceOrg *cloudhub.NetworkDeviceOrg) (*deviceOrgResponse, error) {

	resData := &deviceOrgResponse{
		ID:                  deviceOrg.ID,
		LoadModule:          deviceOrg.LoadModule,
		MLFunction:          deviceOrg.MLFunction,
		DataDuration:        deviceOrg.DataDuration,
		LearnedDevicesIDs:   deviceOrg.LearnedDevicesIDs,
		CollectorServer:     deviceOrg.CollectorServer,
		CollectedDevicesIDs: deviceOrg.CollectedDevicesIDs,
		AIKapacitor:         deviceOrg.AIKapacitor,
	}

	return resData, nil
}

// NetworkDeviceOrgID returns a device org by ID.
func (s *Service) NetworkDeviceOrgID(w http.ResponseWriter, r *http.Request) {
	id, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()

	deviceOrg, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &id})
	if err != nil {
		notFound(w, id, s.Logger)
		return
	}

	res, err := newDeviceOrgResponse(ctx, s, deviceOrg)
	if err != nil {
		Error(w, http.StatusInternalServerError, fmt.Sprintf("Error creating response for Device Org ID %s: %v", id, err), s.Logger)
		return
	}

	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// UpdateNetworkDeviceOrg completely updates either the Device Org
func (s *Service) UpdateNetworkDeviceOrg(w http.ResponseWriter, r *http.Request) {
	idStr, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}
	isChangedKapaURL := false
	previousAIKapacitor := cloudhub.AIKapacitor{}
	var req updateDeviceOrgRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.validUpdate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()

	deviceOrg, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &idStr})
	if err != nil {
		notFound(w, idStr, s.Logger)
		return
	}
	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &idStr})
	if err != nil {
		notFound(w, idStr, s.Logger)
		return
	}
	previousAIKapacitor = deviceOrg.AIKapacitor

	if req.LoadModule != nil {
		deviceOrg.LoadModule = *req.LoadModule
	}
	if req.MLFunction != nil {
		deviceOrg.MLFunction = *req.MLFunction
	}
	if req.DataDuration != nil {
		deviceOrg.DataDuration = *req.DataDuration
	}
	if req.CollectedDevicesIDs != nil {
		deviceOrg.CollectedDevicesIDs = *req.CollectedDevicesIDs
	}
	if req.LearnedDevicesIDs != nil {
		deviceOrg.LearnedDevicesIDs = *req.LearnedDevicesIDs
	}
	if req.AIKapacitor != nil {
		deviceOrg.AIKapacitor.SrcID = req.AIKapacitor.SrcID
		deviceOrg.AIKapacitor.KapaID = req.AIKapacitor.KapaID
		deviceOrg.AIKapacitor.Username = req.AIKapacitor.Username
		deviceOrg.AIKapacitor.Password = req.AIKapacitor.Password
		deviceOrg.AIKapacitor.InsecureSkipVerify = req.AIKapacitor.InsecureSkipVerify

		if deviceOrg.AIKapacitor.KapaURL != req.AIKapacitor.KapaURL {
			deviceOrg.AIKapacitor.KapaURL = req.AIKapacitor.KapaURL
			isChangedKapaURL = true
		}
	}

	if isChangedKapaURL {
		if previousAIKapacitor.KapaURL != "" {
			deleteLearningTask(ctx, s, org, previousAIKapacitor)
		}
		reqTask := deviceOrgRequest{
			ID:           deviceOrg.ID,
			MLFunction:   &deviceOrg.MLFunction,
			DataDuration: &deviceOrg.DataDuration,
			RelearnCycle: req.RelearnCycle,
			AIKapacitor:  &deviceOrg.AIKapacitor,
		}
		err = createLearningTask(ctx, s, org, reqTask, deviceOrg)
		if err != nil {
			msg := fmt.Sprintf("Error updating TickSCript %s: %v", idStr, err)
			Error(w, http.StatusInternalServerError, msg, s.Logger)
			return
		}
	}

	if err := s.Store.NetworkDeviceOrg(ctx).Update(ctx, deviceOrg); err != nil {
		msg := fmt.Sprintf("Error updating Device Org ID %s: %v", idStr, err)
		Error(w, http.StatusInternalServerError, msg, s.Logger)
		return
	}

	msg := fmt.Sprintf(MsgNetWorkDeviceModified.String(), idStr)
	s.logRegistration(ctx, "NetWorkDevice", msg)

	res, err := newDeviceOrgResponse(ctx, s, deviceOrg)
	if err != nil {
		notFound(w, idStr, s.Logger)
		return
	}

	msg = fmt.Sprintf(MsgNetWorkDeviceOrgModified.String(), idStr)
	s.logRegistration(ctx, "NetWorkDeviceOrg", msg)
	encodeJSON(w, http.StatusOK, res, s.Logger)
}

// AddNetworkDeviceOrg adds a new Device Org to the store.
func (s *Service) AddNetworkDeviceOrg(w http.ResponseWriter, r *http.Request) {
	var req deviceOrgRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		invalidJSON(w, s.Logger)
		return
	}

	if err := req.validCreate(); err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()

	org, err := s.Store.Organizations(ctx).Get(ctx, cloudhub.OrganizationQuery{ID: &req.ID})
	if err != nil {
		Error(w, http.StatusInternalServerError, fmt.Sprintf("Error checking for existing Org: %v", err), s.Logger)
		return
	}

	existingDeviceOrg, _ := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &req.ID})
	if existingDeviceOrg != nil {
		Error(w, http.StatusConflict, fmt.Sprintf("Device Org with ID %s already exists", req.ID), s.Logger)
		return
	}

	// Create a new NetworkDeviceOrg from the request data
	newDeviceOrg := cloudhub.NetworkDeviceOrg{
		ID:                  req.ID,
		LoadModule:          LoadModule,
		MLFunction:          *req.MLFunction,
		DataDuration:        *req.DataDuration,
		LearnedDevicesIDs:   []uint64{},
		CollectedDevicesIDs: []uint64{},
		CollectorServer:     "",
		AIKapacitor: cloudhub.AIKapacitor{
			SrcID:              req.AIKapacitor.SrcID,
			KapaID:             req.AIKapacitor.KapaID,
			KapaURL:            req.AIKapacitor.KapaURL,
			Username:           req.AIKapacitor.Username,
			Password:           req.AIKapacitor.Password,
			InsecureSkipVerify: req.AIKapacitor.InsecureSkipVerify,
		},
	}

	deviceOrg, err := s.Store.NetworkDeviceOrg(ctx).Add(ctx, &newDeviceOrg)
	if err != nil {
		Error(w, http.StatusInternalServerError, fmt.Sprintf("Error creating new Device Org: %v", err), s.Logger)
		return
	}
	if req.AIKapacitor != nil && req.AIKapacitor.KapaURL != "" {
		err = createLearningTask(ctx, s, org, req, deviceOrg)
		if err != nil {
			invalidData(w, err, s.Logger)
			return
		}
	}

	res, err := newDeviceOrgResponse(ctx, s, deviceOrg)
	if err != nil {
		Error(w, http.StatusInternalServerError, fmt.Sprintf("Error creating response for new Device Org: %v", err), s.Logger)
		return
	}
	msg := fmt.Sprintf(MsgNetWorkDeviceOrgCreated.String(), deviceOrg.ID)
	s.logRegistration(ctx, "NetWorkDeviceOrg", msg)
	encodeJSON(w, http.StatusCreated, res, s.Logger)
}

// RemoveNetworkDeviceOrg removes a Device Org from the store by ID.
func (s *Service) RemoveNetworkDeviceOrg(w http.ResponseWriter, r *http.Request) {
	idStr, err := paramStr("id", r)
	if err != nil {
		invalidData(w, err, s.Logger)
		return
	}

	ctx := r.Context()

	deviceOrg, err := s.Store.NetworkDeviceOrg(ctx).Get(ctx, cloudhub.NetworkDeviceOrgQuery{ID: &idStr})
	if err != nil {
		notFound(w, idStr, s.Logger)
		return
	}

	if err := s.Store.NetworkDeviceOrg(ctx).Delete(ctx, &cloudhub.NetworkDeviceOrg{ID: deviceOrg.ID}); err != nil {
		Error(w, http.StatusInternalServerError, fmt.Sprintf("Error removing Device Org ID %s: %v", idStr, err), s.Logger)
		return
	}

	msg := fmt.Sprintf("Network Device Org with ID %s removed successfully", idStr)
	s.logRegistration(ctx, "NetWorkDeviceOrg", msg)
	encodeJSON(w, http.StatusOK, map[string]string{"message": msg}, s.Logger)
}

// GetServerInfluxDBs retrieves InfluxDB information from the server.
func GetServerInfluxDBs(ctx context.Context, s *Service) ([]InfluxdbInfo, error) {
	influxDBs := make([]InfluxdbInfo, 0)
	serverCtx := serverContext(ctx)
	i := 0
	for {
		source, err := s.Store.Sources(serverCtx).Get(serverCtx, i)
		if err != nil {
			break
		}
		origin, port, err := getIPAndPort(source.URL)
		if err != nil {
			break
		}
		influxDB := InfluxdbInfo{
			Origin:   origin,
			Port:     port,
			Username: source.Username,
			Password: source.Password,
		}

		influxDBs = append(influxDBs, influxDB)
		i++
	}
	if len(influxDBs) < 1 {
		return nil, fmt.Errorf("no InfluxDB sources found")
	}
	return influxDBs, nil
}

func createLearningTask(ctx context.Context, s *Service, org *cloudhub.Organization, req deviceOrgRequest, deviceOrg *cloudhub.NetworkDeviceOrg) error {
	influxDBs, err := GetServerInfluxDBs(ctx, s)
	if err != nil || len(influxDBs) < 1 {
		return fmt.Errorf("Error fetching InfluxDBs: %v", err)
	}
	etcdDBs := s.EtcdEndpoints
	EtcdOrigin := ""
	EtcdPort := ""
	if len(etcdDBs) > 0 {
		EtcdOrigin, EtcdPort, err = getIPAndPort(etcdDBs[0])
		if err != nil {
			return fmt.Errorf("Error fetching ETCD: %v", err)
		}
	}

	c := kapa.NewClient(deviceOrg.AIKapacitor.KapaURL, deviceOrg.AIKapacitor.Username, deviceOrg.AIKapacitor.Password, deviceOrg.AIKapacitor.InsecureSkipVerify)

	taskReq := cloudhub.AutoGenerateLearnRule{
		OrganizationName: org.Name,
		Organization:     org.ID,
		TaskTemplate:     kapa.LearnTaskField,
		RelearnCycle:     *req.RelearnCycle,
		LoadModule:       LoadModule,
		MLFunction:       *req.MLFunction,
		RetentionPolicy:  "auto",
		AlertRule: cloudhub.AlertRule{
			ID: cloudhub.LearnScriptPrefix + org.ID,
		},
		InfluxOrigin:     influxDBs[0].Origin,
		InfluxDBPort:     influxDBs[0].Port,
		InfluxDBUsername: influxDBs[0].Username,
		InfluxDBPassword: influxDBs[0].Password,
		EtcdOrigin:       EtcdOrigin,
		EtcdPort:         EtcdPort,
	}

	if req.MLFunction == nil {
		taskReq.MLFunction = MLFunction
	} else {
		taskReq.MLFunction = *req.MLFunction
	}
	if req.RelearnCycle == nil {
		taskReq.RelearnCycle = RelearnCycle
	}

	tmplParams := cloudhub.TemplateParams{
		"OrgName":         taskReq.OrganizationName,
		"LoadModule":      taskReq.LoadModule,
		"MLFunction":      taskReq.MLFunction,
		"Message":         taskReq.Message,
		"RelearnCycle":    taskReq.RelearnCycle,
		"RetentionPolicy": taskReq.RetentionPolicy,
		"InfluxOrigin":    taskReq.InfluxOrigin,
		"InfluxPort":      taskReq.InfluxDBPort,
		"InfluxUsername":  taskReq.InfluxDBUsername,
		"InfluxPassword":  taskReq.InfluxDBPassword,
		"EtcdOrigin":      taskReq.EtcdOrigin,
		"EtcdPort":        taskReq.EtcdPort,
	}

	script, err := c.Ticker.GenerateTaskFromTemplate(cloudhub.LoadTemplateConfig{
		Field: kapa.LearnTaskField,
		Path:  nil,
	}, tmplParams)
	if err != nil {
		return err
	}

	kapaID := cloudhub.LearnScriptPrefix + org.ID
	createTaskOptions := &client.CreateTaskOptions{
		ID:   kapaID,
		Type: client.BatchTask,
		DBRPs: []client.DBRP{
			{Database: org.Name, RetentionPolicy: "autogen"},
			{Database: "Default", RetentionPolicy: "autogen"},
		},
		TICKscript: string(script),
		Status:     client.Enabled,
	}
	task, err := c.AutoGenerateCreate(ctx, createTaskOptions)
	if err != nil && task != nil {
		return err
	}

	msg := fmt.Sprintf(MsgKapacitorRuleCreated.String(), createTaskOptions.ID, org.Name)
	s.logRegistration(ctx, "Kapacitors Task", msg)
	return nil
}

func deleteLearningTask(ctx context.Context, s *Service, org *cloudhub.Organization, AIKapacitor cloudhub.AIKapacitor) error {
	c := kapa.NewClient(AIKapacitor.KapaURL, AIKapacitor.Username, AIKapacitor.Password, AIKapacitor.InsecureSkipVerify)

	kapaID := cloudhub.LearnScriptPrefix + org.ID

	// Check if the task exists
	task, err := c.Get(ctx, kapaID)
	if err != nil {
		return fmt.Errorf("Error fetching Kapacitor task: %v", err)
	}

	if task == nil {
		return fmt.Errorf("Kapacitor task %s not found", kapaID)
	}

	// Delete the task
	err = c.Delete(ctx, c.Href(kapaID))
	if err != nil {
		return fmt.Errorf("Error deleting Kapacitor task: %v", err)
	}

	msg := fmt.Sprintf("Kapacitor task %s for organization %s deleted", kapaID, org.Name)
	s.logRegistration(ctx, "Kapacitors Task", msg)
	return nil
}

func getIPAndPort(rawURL string) (string, string, error) {
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return "", "", fmt.Errorf("error parsing URL: %v", err)
	}

	ip := parsedURL.Hostname()

	port := parsedURL.Port()
	if port == "" {
		if parsedURL.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}

	return ip, port, nil
}
