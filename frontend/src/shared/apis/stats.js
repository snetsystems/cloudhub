import {buildInfluxUrl, proxy} from 'utils/queryUrlGenerator'

// alternative is proposed) for disk usage when it's available.
export function fetchShardDiskBytesForDatabase(host, database, clusterID) {
  const statement = `SELECT last(diskBytes) FROM "shard" WHERE "database"='${database}' AND clusterID='${clusterID}' GROUP BY nodeID, path, retentionPolicy`
  const url = buildInfluxUrl({host, statement, database: '_internal'})

  return proxy(url, clusterID)
}

export function nodeDiskUsage(host, clusterID, nodeID) {
  const statement = `SELECT last(diskBytes) FROM "shard" WHERE nodeID = '${nodeID}' AND clusterID='${clusterID}' GROUP BY *`
  const url = buildInfluxUrl({host, statement, database: '_internal'})

  return proxy(url, clusterID)
}

export function clusterDiskUsage(host, clusterID) {
  const statement = `SELECT last(diskBytes) FROM "shard" WHERE clusterID='${clusterID}' GROUP BY *`
  const url = buildInfluxUrl({host, statement, database: '_internal'})

  return proxy(url, clusterID)
}
