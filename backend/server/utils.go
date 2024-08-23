package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
)

// FormatTestResultJSON is Test Result string to json format convert
func FormatTestResultJSON(s string) (string, error) {
	var formatted bytes.Buffer
	err := json.Indent(&formatted, []byte(s), "", "  ")
	return formatted.String(), err
}

// FormatTestResultJSONCompare compares two JSON strings and returns the differences in a formatted string.
// If there are no differences, it returns an empty string.
func FormatTestResultJSONCompare(actual, expected string) (string, error) {
	var obj1, obj2 map[string]interface{}

	if err := json.Unmarshal([]byte(actual), &obj1); err != nil {
		return "", err
	}
	if err := json.Unmarshal([]byte(expected), &obj2); err != nil {
		return "", err
	}

	// Convert all values to string
	obj1 = convertValuesToString(obj1)
	obj2 = convertValuesToString(obj2)

	diff := compareJSON(obj1, obj2)
	if len(diff) == 0 {
		return "", nil
	}

	formattedDiff, err := json.MarshalIndent(diff, "", "  ")
	if err != nil {
		return "", err
	}

	return string(formattedDiff), nil
}

func convertValuesToString(obj map[string]interface{}) map[string]interface{} {
	for k, v := range obj {
		switch v := v.(type) {
		case float64:
			obj[k] = strconv.FormatFloat(v, 'f', -1, 64)
		case int:
			obj[k] = strconv.Itoa(v)
		case int64:
			obj[k] = strconv.FormatInt(v, 10)
		case uint64:
			obj[k] = strconv.FormatUint(v, 10)
		case bool:
			obj[k] = strconv.FormatBool(v)
		case map[string]interface{}:
			obj[k] = convertValuesToString(v)
		case []interface{}:
			for i, u := range v {
				if m, ok := u.(map[string]interface{}); ok {
					v[i] = convertValuesToString(m)
				} else {
					v[i] = fmt.Sprintf("%v", u)
				}
			}
		default:
			obj[k] = fmt.Sprintf("%v", v)
		}
	}
	return obj
}

func compareJSON(obj1, obj2 map[string]interface{}) map[string]interface{} {
	diff := make(map[string]interface{})

	for k, v1 := range obj1 {
		if v2, ok := obj2[k]; ok {
			if !reflect.DeepEqual(v1, v2) {
				diff[k] = map[string]interface{}{
					"actual":   v1,
					"expected": v2,
				}
			}
		} else {
			diff[k] = map[string]interface{}{
				"actual":   v1,
				"expected": nil,
			}
		}
	}

	for k, v2 := range obj2 {
		if _, ok := obj1[k]; !ok {
			diff[k] = map[string]interface{}{
				"actual":   nil,
				"expected": v2,
			}
		}
	}

	return diff
}
