import React, {useEffect, useState} from 'react'
import TableComponent from '../components/TableComponent'
import {ColumnInfo} from 'src/types'

//dummy
import {AccordionTableColumns} from '../constants/AccordionTableColumn'

// redux
import {connect} from 'react-redux'

function PredictionPage() {
  const [checkdList, setCheckedList] = useState<string[]>([])

  useEffect(() => {
    console.log('checkdList: ', checkdList)
  }, [checkdList])

  const data = []

  const columns: ColumnInfo[] = [
    {key: 'device_ip', name: '', options: {checkbox: true}},
    {
      key: 'organization',
      name: 'Organization',
      options: {
        sorting: true,
      },
    },
    {
      key: 'device_ip',
      name: 'Device Ip',
      options: {
        sorting: true,
      },
      render: item => {
        return (
          <div>
            <a
              onClick={e => {
                e.stopPropagation()
              }}
            >
              {item}
            </a>
          </div>
        )
      },
    },
    {
      key: 'hostname',
      name: 'Hostname',
      options: {
        sorting: true,
      },
    },
    {
      key: 'device_type',
      name: 'Device Type',
      options: {
        sorting: true,
      },
    },
    {
      key: 'device_os',
      name: 'Device OS',
      options: {
        sorting: true,
      },
    },
    {
      key: 'algorithm',
      name: 'Algorithm',
      options: {
        sorting: true,
      },
    },
    {
      key: 'epsilon',
      name: 'epsilon',
      options: {
        sorting: true,
      },
    },
    {
      key: 'learning_state',
      name: 'State',
      options: {
        sorting: true,
      },
    },

    {
      key: 'device_id',
      name: 'Device Id',
      options: {
        isAccordion: true,
      },
    },
  ]

  return (
    <TableComponent
      tableTitle={`${
        data.length
          ? data.length === 1
            ? '1 Device'
            : data.length + ' ' + 'Devices'
          : '0 Device'
      } list`}
      data={data}
      columns={columns}
      isAccordion={true}
      accordionColumns={AccordionTableColumns}
      setCheckedArray={setCheckedList}
    />
  )
}

export default connect(null)(PredictionPage)
// export default AiSettingPage
