package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/log"
	"github.com/snetsystems/cloudhub/backend/mocks"
)

func TestGetMLNxRst(t *testing.T) {
	type fields struct {
		MLNxRstStore       cloudhub.MLNxRstStore
		OrganizationsStore cloudhub.OrganizationsStore
		Logger             cloudhub.Logger
	}
	type args struct {
		w *httptest.ResponseRecorder
		r *http.Request
	}

	tests := []struct {
		name            string
		fields          fields
		args            args
		ip              string
		wantStatus      int
		wantContentType string
		wantBody        mlNxRstResponse
	}{
		{
			name: "Get Single MLNxRst",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url?ip=192.168.1.1",
					nil,
				),
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				MLNxRstStore: &mocks.MLNxRstStore{
					GetF: func(ctx context.Context, query cloudhub.MLNxRstQuery) (*cloudhub.MLNxRst, error) {
						if *query.ID == "192.168.1.1" {
							return &cloudhub.MLNxRst{
								Device:                 "192.168.1.1",
								LearningFinishDatetime: "2023-07-29T12:00:00Z",
								Epsilon:                0.01,
								MeanMatrix:             "[[1,0],[0,1]]",
								CovarianceMatrix:       "[[1,0],[0,1]]",
								K:                      1.0,
								Mean:                   0.0,
								MDThreshold:            0.5,
								MDArray:                []float32{0.1, 0.2},
								CPUArray:               []float32{10.0, 20.0},
								TrafficArray:           []float32{100.0, 200.0},
								GaussianArray:          []float32{0.1, 0.2},
							}, nil
						}
						return nil, cloudhub.ErrMLNxRstNotFound
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{},
			},
			ip:              "192.168.1.1",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody: mlNxRstResponse{
				Device:                 "192.168.1.1",
				LearningFinishDatetime: "2023-07-29T12:00:00Z",
				Epsilon:                0.01,
				MeanMatrix:             "[[1,0],[0,1]]",
				CovarianceMatrix:       "[[1,0],[0,1]]",
				K:                      1.0,
				Mean:                   0.0,
				MDThreshold:            0.5,
				MDArray:                []float32{0.1, 0.2},
				CPUArray:               []float32{10.0, 20.0},
				TrafficArray:           []float32{100.0, 200.0},
				GaussianArray:          []float32{0.1, 0.2},
			},
		},
		{
			name: "Missing IP Parameter",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url",
					nil,
				),
			},
			fields: fields{
				Logger:             log.New(log.DebugLevel),
				MLNxRstStore:       &mocks.MLNxRstStore{},
				OrganizationsStore: &mocks.OrganizationsStore{},
			},
			ip:              "",
			wantStatus:      http.StatusUnprocessableEntity,
			wantContentType: "application/json",
			wantBody:        mlNxRstResponse{},
		},
		{
			name: "MLNxRst Not Found",
			args: args{
				w: httptest.NewRecorder(),
				r: httptest.NewRequest(
					"GET",
					"http://any.url?ip=192.168.1.1",
					nil,
				),
			},
			fields: fields{
				Logger: log.New(log.DebugLevel),
				MLNxRstStore: &mocks.MLNxRstStore{
					GetF: func(ctx context.Context, query cloudhub.MLNxRstQuery) (*cloudhub.MLNxRst, error) {
						return nil, cloudhub.ErrMLNxRstNotFound
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{},
			},
			ip:              "192.168.1.1",
			wantStatus:      http.StatusNotFound,
			wantContentType: "application/json",
			wantBody:        mlNxRstResponse{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					MLNxRstStore:       tt.fields.MLNxRstStore,
					OrganizationsStore: tt.fields.OrganizationsStore,
				},
				Logger: tt.fields.Logger,
			}

			s.GetMLNxRst(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := io.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. GetMLNxRst() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. GetMLNxRst() = %v, want %v", tt.name, content, tt.wantContentType)
			}

			var gotBody mlNxRstResponse
			if resp.StatusCode == http.StatusOK {
				err := json.Unmarshal(body, &gotBody)
				if err != nil {
					t.Fatalf("%q. GetMLNxRst() = error decoding response body: %v", tt.name, err)
				}

				if !reflect.DeepEqual(gotBody, tt.wantBody) {
					t.Errorf("%q. GetMLNxRst() = \n***%v***\n,\nwant\n***%v***", tt.name, gotBody, tt.wantBody)
				}
			} else if resp.StatusCode == http.StatusUnprocessableEntity || resp.StatusCode == http.StatusNotFound {
				var gotBody map[string]interface{}
				err := json.Unmarshal(body, &gotBody)
				if err != nil {
					t.Fatalf("%q. GetMLNxRst() = error decoding response body: %v", tt.name, err)
				}

				if msg, ok := gotBody["message"]; ok && msg != "missing parameter ip" && msg != "ID 192.168.1.1 not found" {
					t.Errorf("%q. GetMLNxRst() = %v, want %v", tt.name, msg, "missing parameter ip")
				}
			}
		})
	}
}
