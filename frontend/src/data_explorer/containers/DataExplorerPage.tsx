import React, {PureComponent} from 'react'

import DataExplorer from './DataExplorer'

import {ErrorHandling} from 'src/shared/decorators/errors'

import {Source, Me} from 'src/types'

interface Auth {
  me: Me
  isUsingAuth: boolean
}

interface Props {
  source: Source
  auth: Auth
}

@ErrorHandling
class DataExplorerPage extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {
      auth: {me, isUsingAuth},
    } = this.props

    return (
      <div className="page">
        <DataExplorer
          source={this.props.source}
          me={me}
          isUsingAuth={isUsingAuth}
        />
      </div>
    )
  }
}

export default DataExplorerPage
