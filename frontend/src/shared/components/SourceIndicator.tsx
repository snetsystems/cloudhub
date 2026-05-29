import React, {FunctionComponent, useCallback} from 'react'
import _ from 'lodash'
import uuid from 'uuid'

import ReactTooltip from 'react-tooltip'
import {SourceContext} from 'src/CheckSources'
import {BaseElasticSearchData, Source} from 'src/types'
import {connect} from 'react-redux'

interface Props {
  sourceOverride?: Source
  esSource?: BaseElasticSearchData
}

const SourceIndicator: FunctionComponent<Props> = ({
  sourceOverride,
  esSource,
}) => {
  const uuidTooltip: string = uuid.v4()

  const getTooltipText = useCallback(
    (
      source: Source,
      sourceOverride: Source,
      esSource: BaseElasticSearchData
    ): string => {
      const {name, url} = source

      const sourceName: string = _.get(sourceOverride, 'name', name)
      const sourceUrl: string = _.get(sourceOverride, 'url', url)
      const sourceText = `<h1>Connected to Source:</h1><p><code>${sourceName} @ ${sourceUrl}</code></p>`

      if (!esSource) {
        return `${sourceText}`
      } else {
        const {name: esSourceName, url: esSourceUrl} = esSource
        const esSourceText = `<h1>Connected to Elastic Search:</h1><p><code>${esSourceName} @ ${esSourceUrl}</code></p>`

        return `${sourceText}${esSourceText}`
      }
    },
    [esSource]
  )

  return (
    <SourceContext.Consumer>
      {(source: Source) => (
        <div
          className="source-indicator"
          data-for={uuidTooltip}
          data-tip={getTooltipText(source, sourceOverride, esSource)}
        >
          <span className="icon disks" />
          <ReactTooltip
            id={uuidTooltip}
            effect="solid"
            html={true}
            place="left"
            class="influx-tooltip"
            offset={{
              top: !!esSource ? -36 : 0,
            }}
          />
        </div>
      )}
    </SourceContext.Consumer>
  )
}

const mstp = (state: any) => {
  const {esSource} = state.app.persisted
  return {
    esSource,
  }
}

export default connect(mstp, null, null)(SourceIndicator)
