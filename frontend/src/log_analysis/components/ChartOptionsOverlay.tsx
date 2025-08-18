import React, {useEffect, useState} from 'react'
import OverlayTechnology from 'src/reusable_ui/components/overlays/OverlayTechnology'
import Body from 'src/reusable_ui/components/overlays/OverlayBody'
import Heading from 'src/reusable_ui/components/overlays/OverlayHeading'
import Container from 'src/reusable_ui/components/overlays/OverlayContainer'
import TopologyRadioButton from 'src/hosts/components/TopologyRadioButton'
import {connect} from 'react-redux'
import {LogConfig} from 'src/types/logs'
import {saveChartOptions} from '../apis/chartOptions'
import InputDropdownWrapper from 'src/shared/components/InputDropdownWrapper'
import {bindActionCreators} from 'redux'
import {getLogConfigAsync, setConfig} from 'src/logs/actions'
import {
  DEFAULT_TIME_RANGE_OPTIONS,
  DEFAULT_TIME_RANGE_OPTIONS_PLACEHOLDER,
} from 'src/log_analysis/constants'

interface Props {
  isOpen: boolean
  onClose: () => void
  logConfig?: LogConfig
  setConfig?: typeof setConfig
  getConfig?: typeof getLogConfigAsync
  logConfigLink?: string
}

function ChartOptionsOverlay({
  isOpen,
  onClose,
  logConfig,
  setConfig,
  getConfig,
  logConfigLink,
}: Props) {
  const [fillOption, setFillOption] = useState(
    logConfig?.chartOptions?.queryFillOption ?? 'none'
  )
  const [annotationTimeRange, setAnnotationTimeRange] = useState(
    logConfig?.chartOptions?.annotationPadding ?? '2h'
  )

  useEffect(() => {
    getConfig(logConfigLink)
  }, [])

  const handleSave = () => {
    saveChartOptions({
      queryFillOption: fillOption,
      annotationPadding: annotationTimeRange,
    })

    setConfig({
      ...logConfig,
      chartOptions: {
        queryFillOption: fillOption,
        annotationPadding: annotationTimeRange,
      },
    })

    onClose()
  }

  const overlayActionButtons = (): JSX.Element => {
    return (
      <div className="btn-group--right">
        <button className="btn btn-sm btn-default" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-sm btn-success" onClick={handleSave}>
          Save
        </button>
      </div>
    )
  }

  return (
    <OverlayTechnology visible={isOpen}>
      <Container maxWidth={500}>
        <Heading title="Chart Options">{overlayActionButtons()}</Heading>
        <Body>
          <div className="row chart-options-container">
            <div className={`col-sm-12`}>
              <label className="form-label">Fill Option</label>
            </div>
            <div className={`col-sm-12 option-section`}>
              {/* radio button */}
              <div className="radio-btn-container">
                <div className="radio-btn-title">{'None'}</div>
                <div className="radio-btn-item">
                  <TopologyRadioButton
                    id="none"
                    checked={fillOption === 'none'}
                    name="fill_option"
                    titleText="None"
                    onChange={() => {
                      setFillOption('none')
                    }}
                  />
                </div>
              </div>

              <div className="radio-btn-container">
                <div className="radio-btn-title">{'Null'}</div>
                <div className="radio-btn-item">
                  <TopologyRadioButton
                    id="null"
                    checked={fillOption === 'null'}
                    name="fill_option"
                    titleText="Null"
                    onChange={() => {
                      setFillOption('null')
                    }}
                  />
                </div>
              </div>
            </div>
            <div className={`col-sm-12`}>
              <label className="form-label">Annotation Time Range</label>
            </div>
            <div className={`col-sm-12 option-section`}>
              <InputDropdownWrapper
                selectedItem={annotationTimeRange}
                setSelectedItem={text => {
                  setAnnotationTimeRange(text)
                }}
                placeholder={DEFAULT_TIME_RANGE_OPTIONS_PLACEHOLDER}
                items={DEFAULT_TIME_RANGE_OPTIONS}
                onChange={text => setAnnotationTimeRange(text)}
              />
            </div>
          </div>
        </Body>
      </Container>
    </OverlayTechnology>
  )
}

const mstp = state => {
  const {
    logs: {logConfig},
    links: {
      orgConfig: {logViewer},
    },
  } = state

  return {
    logConfig,
    logConfigLink: logViewer,
  }
}

const mdtp = dispatch => ({
  setConfig: bindActionCreators(setConfig, dispatch),
  getConfig: bindActionCreators(getLogConfigAsync, dispatch),
})

export default connect(mstp, mdtp, null)(ChartOptionsOverlay)
