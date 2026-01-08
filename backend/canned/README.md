## Canned Applications

The JSON application layouts in this directory ship with the application as nice, default layouts and queries for telegraf data.

### Structure

Each canned application JSON file contains the following key structure:

- **id**: Unique identifier for the application (UUID)
- **measurement**: The InfluxDB measurement name (e.g., "cpu", "mysql", "disk")
- **app**: Application name for grouping related dashboards
- **autoflow**: Boolean flag for automatic layout flow
- **whereTagKey**: Array of tag keys that will be used as WHERE conditions in queries.
  - **Example**: `["host"]` creates `WHERE "host" = '<value selected from UI>'`
  - **Multiple tags**: `["host", "device_type"]` creates `WHERE "host" = '<value selected from UI>' OR "device_type" = '<value selected from UI>'`
  - **Empty array**: `[]` disables filtering (applies no WHERE conditions)
  - **Behavior**: Value selected from UI is applied as the right side of equality conditions for all specified tag keys
- **cells**: Array of dashboard cells containing:
  - **x, y**: Position coordinates
  - **w, h**: Width and height dimensions
  - **minW, minH**: Minimum width and height constraints
  - **i**: Unique cell identifier (UUID)
  - **name**: Display name for the cell
  - **queries**: Array of InfluxDB queries with:
    - **query**: Query string
    - **label**: Display label
    - **groupbys**: Array of grouping fields
    - **wheres**: Array of WHERE clause conditions

### whereTagKey Usage Examples

```json
{
  "measurement": "cpu",
  "whereTagKey": ["host"],
  "cells": [...]
}
```

- When value selected from UI is "host1", queries get `WHERE "host" = 'host1'`

```json
{
  "measurement": "cloudwatch_aws_application_elb",
  "whereTagKey": ["load_balancer_name", "host"],
  "cells": [...]
}
```

- When value selected from UI is "host1", queries get `WHERE "load_balancer_name" = 'host1' OR "host" = 'host1'`

### Create New Application

To create a new application in this directory run `./new_apps.sh MEASUREMENT_NAME`. This shell script will create a new application template with a generated UUID.

Example:

```bash
./new_apps.sh my_measurement
```

This will create `my_measurement.json` with a basic template structure. Update this layout application file's queries, measurements, and application name as needed.
