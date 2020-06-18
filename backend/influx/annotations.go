package influx

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/id"
)

const (
	// AllAnnotations returns all annotations from the CloudHub database
	AllAnnotations = `SELECT * FROM "annotations" WHERE "deleted"=false AND time >= %dns and "start_time" <= %d %s ORDER BY time DESC`
	// GetAnnotationID returns all annotations from the CloudHub database where id is %s
	GetAnnotationID = `SELECT * FROM "annotations" WHERE "id"='%s' AND "deleted"=false ORDER BY time DESC`
	// AnnotationsDB is CloudHub.  Perhaps later we allow this to be changed
	AnnotationsDB = "cloudhub"
	// DefaultRP is autogen. Perhaps later we allow this to be changed
	DefaultRP = "autogen"
	// DefaultMeasurement is annotations.
	DefaultMeasurement = "annotations"
)

var _ cloudhub.AnnotationStore = &AnnotationStore{}

// AnnotationStore stores annotations within InfluxDB
type AnnotationStore struct {
	client cloudhub.TimeSeries
	id     cloudhub.ID
	now    Now
}

// NewAnnotationStore constructs an annoation store with a client
func NewAnnotationStore(client cloudhub.TimeSeries) *AnnotationStore {
	return &AnnotationStore{
		client: client,
		id:     &id.UUID{},
		now:    time.Now,
	}
}

// All lists all Annotations
func (a *AnnotationStore) All(ctx context.Context, start, stop time.Time, filters []*cloudhub.AnnotationTagFilter) ([]cloudhub.Annotation, error) {
	exprs := make([]string, len(filters))

	for i, f := range filters {
		exprs[i] = f.String()
	}

	expr := ""

	if len(exprs) > 0 {
		expr = " AND " + strings.Join(exprs, " AND ")
	}

	return a.queryAnnotations(ctx, fmt.Sprintf(AllAnnotations, start.UnixNano(), stop.UnixNano(), expr))
}

// Get retrieves an annotation
func (a *AnnotationStore) Get(ctx context.Context, id string) (*cloudhub.Annotation, error) {
	annos, err := a.queryAnnotations(ctx, fmt.Sprintf(GetAnnotationID, id))
	if err != nil {
		return nil, err
	}
	if len(annos) == 0 {
		return nil, cloudhub.ErrAnnotationNotFound
	}
	return &annos[0], nil
}

// Add creates a new annotation in the store
func (a *AnnotationStore) Add(ctx context.Context, anno *cloudhub.Annotation) (*cloudhub.Annotation, error) {
	var err error
	anno.ID, err = a.id.Generate()
	if err != nil {
		return nil, err
	}
	return anno, a.client.Write(ctx, []cloudhub.Point{
		toPoint(anno, a.now()),
	})
}

// Delete removes the annotation from the store
func (a *AnnotationStore) Delete(ctx context.Context, id string) error {
	cur, err := a.Get(ctx, id)
	if err != nil {
		return err
	}
	return a.client.Write(ctx, []cloudhub.Point{
		toDeletedPoint(cur, a.now()),
	})
}

// Update replaces annotation; if the annotation's time is different, it
// also removes the previous annotation
func (a *AnnotationStore) Update(ctx context.Context, anno *cloudhub.Annotation) error {
	cur, err := a.Get(ctx, anno.ID)
	if err != nil {
		return err
	}

	if err := a.client.Write(ctx, []cloudhub.Point{toPoint(anno, a.now())}); err != nil {
		return err
	}

	// If the updated annotation has a different time, then, we must
	// delete the previous annotation
	if !cur.EndTime.Equal(anno.EndTime) {
		return a.client.Write(ctx, []cloudhub.Point{
			toDeletedPoint(cur, a.now()),
		})
	}
	return nil
}

// queryAnnotations queries the CloudHub db and produces all annotations
func (a *AnnotationStore) queryAnnotations(ctx context.Context, query string) ([]cloudhub.Annotation, error) {
	res, err := a.client.Query(ctx, cloudhub.Query{
		Command: query,
		DB:      AnnotationsDB,
		Epoch:   "ns",
	})
	if err != nil {
		return nil, err
	}
	octets, err := res.MarshalJSON()
	if err != nil {
		return nil, err
	}

	results := influxResults{}
	d := json.NewDecoder(bytes.NewReader(octets))
	d.UseNumber()
	if err := d.Decode(&results); err != nil {
		return nil, err
	}
	return results.Annotations()
}

func toPoint(anno *cloudhub.Annotation, now time.Time) cloudhub.Point {
	tags := cloudhub.AnnotationTags{
		"id": anno.ID,
	}

	for k, v := range anno.Tags {
		tags[k] = v
	}

	return cloudhub.Point{
		Database:        AnnotationsDB,
		RetentionPolicy: DefaultRP,
		Measurement:     DefaultMeasurement,
		Time:            anno.EndTime.UnixNano(),
		Tags:            tags,
		Fields: map[string]interface{}{
			"deleted":          false,
			"start_time":       anno.StartTime.UnixNano(),
			"modified_time_ns": int64(now.UnixNano()),
			"text":             anno.Text,
		},
	}
}

func toDeletedPoint(anno *cloudhub.Annotation, now time.Time) cloudhub.Point {
	tags := cloudhub.AnnotationTags{
		"id": anno.ID,
	}

	for k, v := range anno.Tags {
		tags[k] = v
	}

	return cloudhub.Point{
		Database:        AnnotationsDB,
		RetentionPolicy: DefaultRP,
		Measurement:     DefaultMeasurement,
		Time:            anno.EndTime.UnixNano(),
		Tags:            tags,
		Fields: map[string]interface{}{
			"deleted":          true,
			"start_time":       int64(0),
			"modified_time_ns": int64(now.UnixNano()),
			"text":             "",
		},
	}
}

type value []interface{}

func (v value) Int64(idx int) (int64, error) {
	if idx >= len(v) {
		return 0, fmt.Errorf("index %d does not exist in values", idx)
	}
	n, ok := v[idx].(json.Number)
	if !ok {
		return 0, fmt.Errorf("value at index %d is not int64, but, %T", idx, v[idx])
	}
	return n.Int64()
}

func (v value) Time(idx int) (time.Time, error) {
	tm, err := v.Int64(idx)
	if err != nil {
		return time.Time{}, err
	}
	return time.Unix(0, tm), nil
}

func (v value) String(idx int) (string, error) {
	if idx >= len(v) {
		return "", fmt.Errorf("index %d does not exist in values", idx)
	}
	str, ok := v[idx].(string)
	if !ok {
		return "", fmt.Errorf("value at index %d is not string, but, %T", idx, v[idx])
	}
	return str, nil
}

type influxResults []struct {
	Series []struct {
		Columns []string `json:"columns"`
		Values  []value  `json:"values"`
	} `json:"series"`
}

// annotationResult is an intermediate struct to track the latest modified
// time of an annotation
type annotationResult struct {
	cloudhub.Annotation
	// modTime is bookkeeping to handle the case when an update fails; the latest
	// modTime will be the record returned
	modTime int64
}

// Annotations converts AllAnnotations query to annotations
func (r *influxResults) Annotations() (res []cloudhub.Annotation, err error) {
	annos := map[string]annotationResult{}
	for _, u := range *r {
		for _, s := range u.Series {
			columnIndex := map[string]int{}

			for i, c := range s.Columns {
				columnIndex[c] = i
			}

			indexOf := func(k string) (int, error) {
				i, prs := columnIndex[k]

				if !prs {
					return -1, fmt.Errorf("Could not find %q in annotation", k)
				}

				return i, nil
			}

			for _, v := range s.Values {
				anno := annotationResult{}
				var i int

				i, err = indexOf("time")
				if err != nil {
					return
				}
				if anno.EndTime, err = v.Time(i); err != nil {
					return
				}

				i, err = indexOf("start_time")
				if err != nil {
					return
				}
				if anno.StartTime, err = v.Time(i); err != nil {
					return
				}

				i, err = indexOf("modified_time_ns")
				if err != nil {
					return
				}
				if anno.modTime, err = v.Int64(i); err != nil {
					return
				}

				i, err = indexOf("text")
				if err != nil {
					return
				}
				if anno.Text, err = v.String(i); err != nil {
					return
				}

				i, err = indexOf("id")
				if err != nil {
					return
				}
				if anno.ID, err = v.String(i); err != nil {
					return
				}

				anno.Tags = cloudhub.AnnotationTags{}

				// Collect all other columns as tags
				for i, vv := range v {
					key := s.Columns[i]
					err := cloudhub.ValidateAnnotationTagKey(key)
					svv, ok := vv.(string)

					// Ignore blacklisted tags and tags that cannot be coerced to a string
					if err == nil && ok {
						anno.Tags[key] = svv
					}
				}

				// If there are two annotations with the same id, take
				// the annotation with the latest modification time
				// This is to prevent issues when an update or delete fails.
				// Updates and deletes are multiple step queries.
				prev, ok := annos[anno.ID]
				if !ok || anno.modTime > prev.modTime {
					annos[anno.ID] = anno
				}
			}
		}
	}
	res = []cloudhub.Annotation{}
	for _, a := range annos {
		res = append(res, a.Annotation)
	}

	sort.Slice(res, func(i int, j int) bool {
		return res[i].StartTime.Before(res[j].StartTime) || res[i].ID < res[j].ID
	})

	return res, err
}
