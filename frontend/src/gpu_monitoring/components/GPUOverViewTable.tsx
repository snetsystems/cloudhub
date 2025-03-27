import _ from 'lodash'
import React from 'react'

interface Props {
  label: string
  contents: Record<string, Record<string, string>>
}

const GPUOverViewTable: React.FC<Props> = ({label, contents}) => {
  const gpuKeys = Object.keys(contents)
  const columnKeys = _.uniq(gpuKeys.flatMap(gpu => Object.keys(contents[gpu])))

  return (
    <div className="section-item-detail-gpu">
      <table className="section-item-detail-gpu-table">
        <thead>
          <tr>
            <th className="section-item-detail-gpu-th">{label}</th>
            {columnKeys.map(key => (
              <th key={key} className="section-item-detail-gpu-th">
                {key.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {gpuKeys.map(gpu => (
            <tr key={gpu}>
              <td className="section-item-detail-gpu-td-bold">{gpu}</td>
              {columnKeys.map(col => (
                <td key={col} className="section-item-detail-gpu-td">
                  {contents[gpu]?.[col] ?? '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default GPUOverViewTable
