import React, {useEffect, useMemo, useState} from 'react'
import {
  Button,
  ComponentColor,
  Form,
  OverlayBody,
  OverlayContainer,
  OverlayHeading,
  OverlayTechnology,
} from 'src/reusable_ui'
import ApplyMonitoringTableComponent from './ApplyMonitoringTableComponent'
import {ApplyMonitoringProps, DeviceData} from 'src/types'

interface Props {
  isVisible: boolean
  setIsVisible: () => void
  applyLearningData: DeviceData[]
}

function ApplyMonitoringModal({
  isVisible,
  setIsVisible,
  applyLearningData,
}: Props) {
  const [data, setData] = useState<ApplyMonitoringProps[]>(
    applyLearningData.map(i => ({
      ...{
        organization: i.organization,
        device_ip: i.device_ip,
        hostname: i.hostname,
        //todo: isMonitoring
      },
      isCreateLearning: true,
    }))
  )

  const changeToggle = (value, rowIndex) => {}

  useEffect(() => {
    console.log('useEffect data : ', data)
  }, [
    [
      data.map(i => i.isCreateLearning).join(','),
      data,
      JSON.stringify(data),
      isVisible,
      applyLearningData,
    ],
  ])

  return (
    <OverlayTechnology visible={isVisible}>
      <OverlayContainer>
        <OverlayHeading
          title={'Apply Monitoring Confirm'}
          onDismiss={() => {
            setIsVisible()
          }}
        />
        <OverlayBody>
          <Form>
            <Form.Element>
              <div className="message-zone device-modal--childNode">
                <ApplyMonitoringTableComponent
                  value={data}
                  setValue={setData}
                />
              </div>
            </Form.Element>
            <Form.Footer>
              <Button
                color={ComponentColor.Warning}
                text={'Confirm'}
                onClick={() => {
                  console.log('confirm: ', data)
                  // applyMonitoring function
                }}
              />

              <Button
                text={'Cancel'}
                onClick={() => {
                  setIsVisible()
                }}
              />
            </Form.Footer>
          </Form>
        </OverlayBody>
      </OverlayContainer>
    </OverlayTechnology>
  )
}

export default ApplyMonitoringModal
