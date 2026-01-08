import React from 'react'

function ElasticTableHead() {
  return (
    <thead>
      <tr>
        <th className="source-table--connect-col" />
        <th>Elasticsearch Connection</th>
        <th className="text-right" />
      </tr>
    </thead>
  )
}

export default ElasticTableHead
