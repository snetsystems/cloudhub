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

func TestGetDLNxRst(t *testing.T) {
	type fields struct {
		DLNxRstStore       cloudhub.DLNxRstStore
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
		wantBody        dlNxRstResponse
	}{
		{
			name: "Get Single DLNxRst",
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
				DLNxRstStore: &mocks.DLNxRstStore{
					GetF: func(ctx context.Context, query cloudhub.DLNxRstQuery) (*cloudhub.DLNxRst, error) {
						if *query.ID == "192.168.1.1" {
							return &cloudhub.DLNxRst{
								Device:                 "192.168.1.1",
								LearningFinishDatetime: "2023-07-29T12:00:00Z",
								DLThreshold:            0.01,
								TrainLoss:              []float32{0.1, 0.2},
								ValidLoss:              []float32{0.3, 0.4},
								MSE:                    []float32{0.5, 0.6},
							}, nil
						}
						return nil, cloudhub.ErrDLNxRstNotFound
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{},
			},
			ip:              "192.168.1.1",
			wantStatus:      http.StatusOK,
			wantContentType: "application/json",
			wantBody: dlNxRstResponse{
				Device:                 "192.168.1.1",
				LearningFinishDatetime: "2023-07-29T12:00:00Z",
				DLThreshold:            0.01,
				TrainLoss:              []float32{0.1, 0.2},
				ValidLoss:              []float32{0.3, 0.4},
				MSE:                    []float32{0.5, 0.6},
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
				DLNxRstStore:       &mocks.DLNxRstStore{},
				OrganizationsStore: &mocks.OrganizationsStore{},
			},
			ip:              "",
			wantStatus:      http.StatusUnprocessableEntity,
			wantContentType: "application/json",
			wantBody:        dlNxRstResponse{},
		},
		{
			name: "DLNxRst Not Found",
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
				DLNxRstStore: &mocks.DLNxRstStore{
					GetF: func(ctx context.Context, query cloudhub.DLNxRstQuery) (*cloudhub.DLNxRst, error) {
						return nil, cloudhub.ErrDLNxRstNotFound
					},
				},
				OrganizationsStore: &mocks.OrganizationsStore{},
			},
			ip:              "192.168.1.1",
			wantStatus:      http.StatusNotFound,
			wantContentType: "application/json",
			wantBody:        dlNxRstResponse{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{
				Store: &mocks.Store{
					DLNxRstStore:       tt.fields.DLNxRstStore,
					OrganizationsStore: tt.fields.OrganizationsStore,
				},
				Logger: tt.fields.Logger,
			}

			s.GetDLNxRst(tt.args.w, tt.args.r)

			resp := tt.args.w.Result()
			content := resp.Header.Get("Content-Type")
			body, _ := io.ReadAll(resp.Body)

			if resp.StatusCode != tt.wantStatus {
				t.Errorf("%q. GetDLNxRst() = %v, want %v", tt.name, resp.StatusCode, tt.wantStatus)
			}
			if tt.wantContentType != "" && content != tt.wantContentType {
				t.Errorf("%q. GetDLNxRst() = %v, want %v", tt.name, content, tt.wantContentType)
			}

			var gotBody dlNxRstResponse
			if resp.StatusCode == http.StatusOK {
				err := json.Unmarshal(body, &gotBody)
				if err != nil {
					t.Fatalf("%q. GetDLNxRst() = error decoding response body: %v", tt.name, err)
				}

				if !reflect.DeepEqual(gotBody, tt.wantBody) {
					t.Errorf("%q. GetDLNxRst() = \n***%v***\n,\nwant\n***%v***", tt.name, gotBody, tt.wantBody)
				}
			} else if resp.StatusCode == http.StatusUnprocessableEntity || resp.StatusCode == http.StatusNotFound {
				var gotBody map[string]interface{}
				err := json.Unmarshal(body, &gotBody)
				if err != nil {
					t.Fatalf("%q. GetDLNxRst() = error decoding response body: %v", tt.name, err)
				}

				if msg, ok := gotBody["message"]; ok && msg != "missing parameter ip" && msg != "ID 192.168.1.1 not found" {
					t.Errorf("%q. GetDLNxRst() = %v, want %v", tt.name, msg, "missing parameter ip")
				}
			}
		})
	}
}
