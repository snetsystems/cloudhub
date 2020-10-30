import React, {PureComponent} from 'react'
import yaml from 'js-yaml'

import {Controlled as ReactCodeMirror} from 'react-codemirror2'

interface Props {
  script: string
}

class KubernetesRawData extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }
  public render() {
    const {script} = this.props
    const options = {
      tabIndex: 1,
      mode: 'flux',
      readonly: false,
      lineNumbers: true,
      autoRefresh: true,
      theme: 'flux',
      completeSingle: false,
      lineWrapping: true,
    }

    return (
      <div className={`kubernetes-editor--field`}>
        <ReactCodeMirror
          autoFocus={true}
          autoCursor={true}
          value={yaml.dump(script)}
          options={options}
          onBeforeChange={this.beforeChange}
          onTouchStart={this.onTouchStart}
        />
      </div>
    )
  }

  private beforeChange = (): void => {}
  private onTouchStart = (): void => {}
}

export default KubernetesRawData
