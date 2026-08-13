import {ServerListQuery} from 'src/hosts/constants/serverListColumns'

export const alertStatusQueries: ServerListQuery[] = [
  // CPU (Linux)
  {
    id: 'alert-cpu',
    text: `SELECT mean("usage_system") AS "usage_system", mean("usage_user") AS "usage_user", mean("usage_system") + mean("usage_user") AS "usage_total"
FROM ":db:".":rp:"."cpu"
WHERE time >= :dashboardTime: AND time <= :upperDashboardTime: AND "host" = ':host:' AND "cpu"='cpu-total'
GROUP BY time(10s) FILL(null)`,
  },
  // CPU (Windows)
  {
    id: 'alert-win-cpu',
    text: `SELECT mean("Percent_Privileged_Time") AS "usage_system", mean("Percent_User_Time") AS "usage_user", 100 - mean("Percent_Idle_Time") AS "usage_total"
FROM ":db:".":rp:"."win_cpu"
WHERE time >= :dashboardTime: AND time <= :upperDashboardTime: AND "host" = ':host:' AND "instance"='_Total'
GROUP BY time(10s) FILL(null)`,
  },
  // CPU Queue (Linux)
  {
    id: 'alert-system',
    text: `SELECT mean("load1") AS "queue_length"
FROM ":db:".":rp:"."system"
WHERE time >= :dashboardTime: AND time <= :upperDashboardTime: AND "host" = ':host:'
GROUP BY time(10s) FILL(null)`,
  },
  // CPU Queue (Windows)
  {
    id: 'alert-win-system',
    text: `SELECT mean("Processor_Queue_Length") AS "queue_length"
FROM ":db:".":rp:"."win_system"
WHERE time >= :dashboardTime: AND time <= :upperDashboardTime: AND "host" = ':host:'
GROUP BY time(10s) FILL(null)`,
  },
  // Mem (Linux)
  {
    id: 'alert-mem',
    text: `SELECT mean("used_percent") AS "used_percent", mean("used") AS "used", mean("free") AS "free", mean("cached") AS "cached"
FROM ":db:".":rp:"."mem"
WHERE time >= :dashboardTime: AND time <= :upperDashboardTime: AND "host" = ':host:'
GROUP BY time(10s) FILL(null)`,
  },
  // Mem (Windows)
  {
    id: 'alert-win-mem',
    text: `SELECT mean("Percent_Committed_Bytes_In_Use") AS "used_percent", mean("Committed_Bytes") AS "used", mean("Available_Bytes") AS "free", mean("Standby_Cache_Core_Bytes") + mean("Standby_Cache_Normal_Priority_Bytes") + mean("Standby_Cache_Reserve_Bytes") AS "cached", mean("Page_Faults_persec") AS "pagefaults", mean("Pool_Paged_Bytes") AS "pool_paged", mean("Pool_Nonpaged_Bytes") AS "pool_nonpaged"
FROM ":db:".":rp:"."win_mem"
WHERE time >= :dashboardTime: AND time <= :upperDashboardTime: AND "host" = ':host:'
GROUP BY time(10s) FILL(null)`,
  },
  // Swap (Linux)
  {
    id: 'alert-swap',
    text: `SELECT mean("used_percent") AS "swap_used_percent", mean("used") AS "swap_used"
FROM ":db:".":rp:"."swap"
WHERE time >= :dashboardTime: AND time <= :upperDashboardTime: AND "host" = ':host:'
GROUP BY time(10s) FILL(null)`,
  },
  // Swap (Windows)
  {
    id: 'alert-win-swap',
    text: `SELECT mean("Percent_Usage") AS "swap_used_percent"
FROM ":db:".":rp:"."win_swap"
WHERE time >= :dashboardTime: AND time <= :upperDashboardTime: AND "host" = ':host:' AND "instance"='_Total'
GROUP BY time(10s) FILL(null)`,
  },
  // Disk (Linux)
  {
    id: 'alert-disk',
    text: `SELECT mean("used_percent") AS "Disk Usage"
FROM ":db:".":rp:"."disk"
WHERE time >= :dashboardTime: AND time <= :upperDashboardTime: AND "host" = ':host:' AND path !~ /^\\/boot/ AND path !~ /^\\/run/
GROUP BY "path", time(10s) FILL(null)`,
  },
  // Disk (Windows)
  {
    id: 'alert-win-disk',
    text: `SELECT mean("used_percent") AS "Disk Usage"
FROM ":db:".":rp:"."disk"
WHERE time >= :dashboardTime: AND time <= :upperDashboardTime: AND "host" = ':host:' AND path !~ /^\\/boot/ AND path !~ /^\\/run/
GROUP BY "path", time(10s) FILL(null)`,
  },
  // Disk I/O (Linux)
  {
    id: 'alert-disk-io',
    text: `SELECT non_negative_derivative(max("io_time"),1s) / 10 AS "Disk I/O %"
FROM ":db:".":rp:"."diskio"
WHERE time >= :dashboardTime: AND time <= :upperDashboardTime: AND "host" = ':host:' AND "mount_path" != ''
GROUP BY "mount_path", time(10s) FILL(null)`,
  },
  // Disk I/O (Windows)
  {
    id: 'alert-win-disk-io',
    text: `SELECT mean("Percent_Disk_Time") AS "Disk I/O %"
FROM ":db:".":rp:"."win_diskio"
WHERE time >= :dashboardTime: AND time <= :upperDashboardTime: AND "host" = ':host:' AND "instance" !~ /^_Total/
GROUP BY "instance", time(10s) FILL(null)`,
  },
  // Network (Linux)
  {
    id: 'alert-net',
    text: `SELECT non_negative_derivative(max("bytes_recv"),1s) + non_negative_derivative(max("bytes_sent"),1s) AS "traffic"
FROM ":db:".":rp:"."net"
WHERE time >= :dashboardTime: AND time <= :upperDashboardTime: AND "host" = ':host:'
GROUP BY "interface", time(10s) FILL(null)`,
  },
  // Network (Win)
  {
    id: 'alert-win-net',
    text: `SELECT max("Bytes_Received_persec") + max("Bytes_Sent_persec") AS "traffic"
FROM ":db:".":rp:"."win_net"
WHERE time >= :dashboardTime: AND time <= :upperDashboardTime: AND "host" = ':host:' AND "instance" !~ /^_Total/
GROUP BY "instance", time(10s) FILL(null)`,
  },
]
