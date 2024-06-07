import React, {useEffect, useState} from 'react'
import TableComponent from '../components/TableComponent'
import {DeviceData} from 'src/types'

//dummy
import {AccordionTableColumns} from '../constants/AccordionTableColumn'

// redux
import {connect} from 'react-redux'
import {getDeviceList} from '../apis'
import {predictionColumn} from '../constants'

function PredictionPage() {
  const [checkdList, setCheckedList] = useState<string[]>([])
  const [dataList, setDataList] = useState<DeviceData[]>([])

  useEffect(() => {
    getDeviceAJAX()
  }, [])

  const getDeviceAJAX = async () => {
    const {data} = await getDeviceList()
    setDataList(data.Devices)
  }

  return (
    <TableComponent
      tableTitle={`${
        dataList.length
          ? dataList.length === 1
            ? '1 Device'
            : dataList.length + ' ' + 'Devices'
          : '0 Device'
      } list`}
      data={dataList || []}
      columns={predictionColumn}
      isAccordion={true}
      accordionColumns={AccordionTableColumns}
      checkedArray={checkdList}
      setCheckedArray={setCheckedList}
    />
  )
}

export default connect(null)(PredictionPage)
// export default AiSettingPage
