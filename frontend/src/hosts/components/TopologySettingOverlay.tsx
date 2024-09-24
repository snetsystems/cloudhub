import React, {PureComponent} from 'react'
import Container from 'src/reusable_ui/components/overlays/OverlayContainer'
import Body from 'src/reusable_ui/components/overlays/OverlayBody'
import {Button, ComponentColor} from 'src/reusable_ui'
import PageSpinner from 'src/shared/components/PageSpinner'
import {RemoteDataState} from 'src/types'
import {TopologyOption} from '../types'

interface Props {
  isOptionOverlayVisible: boolean
  setIsOptionOverlayVisible: (value: boolean) => void
  state: RemoteDataState
  topologyOption: TopologyOption
  setTopologyOption: (value: TopologyOption) => void
}

interface State {
  topologyOption: TopologyOption
}

class TopologySettingOverlay extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      topologyOption: {
        hostStatusVisible: props.topologyOption.hostStatusVisible,
        ipmiVisible: props.topologyOption.ipmiVisible,
        linkVisible: props.topologyOption.linkVisible,
        minimapVisible: props.topologyOption.minimapVisible,
      },
    }
  }

  private get renderSettingHeader() {
    return (
      <div className="overlay--heading">
        <div id="setting-title" className="overlay--title">
          {'Display Setting'}
        </div>
        <Button
          onClick={() => this.onClose()}
          customClass="btn-cancel"
          text="Cancel"
          titleText="Cancel"
        />
        <Button
          color={ComponentColor.Success}
          onClick={() => this.onOkClick()}
          customClass="btn-ok"
          text="OK"
          titleText="OK"
        />
      </div>
    )
  }

  private get renderSetSettingPopup() {
    const {topologyOption} = this.props
    return (
      <div>
        <div className="form-control-static">
          <input
            type="checkbox"
            id="minimapVisible"
            defaultChecked={topologyOption.minimapVisible}
            onChange={e =>
              this.onCheckClick('minimapVisible', e.currentTarget.checked)
            }
          />
          <label htmlFor="minimapVisible">Mini Map</label>
        </div>
        <div className="form-control-static">
          <input
            type="checkbox"
            id="ipmiVisible"
            defaultChecked={topologyOption.ipmiVisible}
            onChange={e =>
              this.onCheckClick('ipmiVisible', e.currentTarget.checked)
            }
          />
          <label htmlFor="ipmiVisible">IPMI Status</label>
        </div>
        <div className="form-control-static">
          <input
            type="checkbox"
            id="linkVisible"
            defaultChecked={topologyOption.linkVisible}
            onChange={e =>
              this.onCheckClick('linkVisible', e.currentTarget.checked)
            }
          />
          <label htmlFor="linkVisible">Link Dashboard</label>
        </div>
        <div className="form-control-static">
          <input
            type="checkbox"
            id="hostStatusVisible"
            defaultChecked={topologyOption.hostStatusVisible}
            onChange={e =>
              this.onCheckClick('hostStatusVisible', e.currentTarget.checked)
            }
          />
          <label htmlFor="hostStatusVisible">Host Status</label>
        </div>
      </div>
    )
  }

  public render() {
    const {state} = this.props
    return (
      <>
        <div className="topology-setting">
          {state === RemoteDataState.Loading && (
            <div className="topology-spinner">
              <PageSpinner />
            </div>
          )}
          <Container maxWidth={700}>
            {this.renderSettingHeader}
            <Body>{this.renderSetSettingPopup}</Body>
          </Container>
        </div>
      </>
    )
  }

  private onCheckClick(option: string, value: boolean) {
    const prevOption = {...this.state.topologyOption}
    prevOption[option] = value

    this.setState({
      topologyOption: {
        ...prevOption,
      },
    })
  }

  private onOkClick() {
    const {setTopologyOption} = this.props
    const {topologyOption} = this.state

    setTopologyOption({
      ...topologyOption,
    })

    this.onClose()
  }

  private onClose() {
    const {setIsOptionOverlayVisible} = this.props
    setIsOptionOverlayVisible(false)
  }
}

export default TopologySettingOverlay
