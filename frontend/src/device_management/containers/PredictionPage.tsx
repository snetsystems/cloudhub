import React, {useEffect, useState} from 'react'
import TableComponent from '../components/TableComponent'
import {Page} from 'src/reusable_ui'
import {ColumnInfo, Me, Organization} from 'src/types'

//dummy
import {AccordionTableColumns} from '../constants/AccordionTableColumn'
import dummy from '../constants/dummy.json'

// redux
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

interface Props {
  isUsingAuth: boolean
  me: Me
  organizations: Organization[]
  notify: (n: Notification) => void
}

function PredictionPage({isUsingAuth, me, notify, organizations}: Props) {
  const [checkdList, setCheckedList] = useState<string[]>([])

  useEffect(() => {
    console.log(isUsingAuth, me, notify, organizations)
    console.log('checkdList: ', checkdList)
  }, [checkdList])

  const data = dummy

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

const mstp = ({adminCloudHub: {organizations}, auth: {isUsingAuth, me}}) => ({
  organizations,
  isUsingAuth,
  me,
})

const mdtp = (dispatch: any) => ({
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(mstp, mdtp, null)(PredictionPage)
// export default AiSettingPage
