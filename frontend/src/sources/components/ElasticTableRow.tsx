import React, {ReactElement, useEffect, useRef} from 'react'
import Authorized from 'src/auth/Authorized'
import EsConnectionLink from './EsConnectionLink'
import {EDITOR_ROLE} from 'src/auth/Authorized'
import ConfirmButton from 'src/shared/components/ConfirmButton'
import {BaseElasticSearchData} from 'src/types'
import {deleteElasticSearchInfo} from 'src/shared/apis/elasticSearch'
import {
  connectElasticSearch,
  disconnectElasticSearch,
  getElasticSearchInfoAsync,
} from 'src/shared/actions/elasticSearch'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {ButtonShape} from 'src/reusable_ui/types'
import {ComponentSize} from 'src/reusable_ui/types'
import {ComponentColor} from 'src/reusable_ui/types'
import {Button} from 'src/reusable_ui'

interface Props {
  esSource: BaseElasticSearchData
  connectedEsSource: BaseElasticSearchData | null
  fetchElasticSearchInfo?: () => void
  connectElasticSearch?: ({elasticSearchInfo}) => void
  toggleEsWizard: (open: boolean) => () => void
  disconnectElasticSearch?: () => void
}

function ElasticTableRow({
  esSource,
  connectedEsSource,
  fetchElasticSearchInfo,
  connectElasticSearch,
  toggleEsWizard,
  disconnectElasticSearch,
}: Props) {
  const connectionLink = useRef<EsConnectionLink>(null)

  useEffect(() => {
    if (connectionLink.current) {
      connectionLink.current.forceUpdate()
    }
  }, [connectionLink])

  const onDeleteElasticSearch = async (id: string) => {
    await deleteElasticSearchInfo(id)
    if (connectedEsSource.id === id) {
      disconnectElasticSearch()
    }

    await fetchElasticSearchInfo()
  }

  const connectButton = (
    esInfo: BaseElasticSearchData
  ): ReactElement<HTMLDivElement> => {
    if (esInfo.id === connectedEsSource?.id) {
      return (
        <Button
          text={'Connected'}
          color={ComponentColor.Success}
          size={ComponentSize.ExtraSmall}
          shape={ButtonShape.StretchToFit}
        />
      )
    }
    return (
      <Button
        text={'Connect'}
        onClick={() => handleConnect(esInfo)}
        color={ComponentColor.Default}
        size={ComponentSize.ExtraSmall}
        shape={ButtonShape.StretchToFit}
      />
    )
  }

  const handleConnect = (esInfo: BaseElasticSearchData) => {
    connectElasticSearch({elasticSearchInfo: esInfo})
  }

  return (
    <>
      <tr>
        <td>{connectButton(esSource)}</td>
        <td>
          <div>
            <EsConnectionLink
              ref={connectionLink}
              esSource={esSource}
              toggleEsWizard={toggleEsWizard}
              connectedEsSource={connectedEsSource}
            />

            <div>{esSource.url}</div>
          </div>
        </td>
        <td className="text-right">
          <Authorized requiredRole={EDITOR_ROLE}>
            <ConfirmButton
              type="btn-danger"
              size="btn-xs"
              text="Delete Connection"
              confirmAction={() => onDeleteElasticSearch(esSource.id)}
              customClass="delete-source table--show-on-row-hover"
            />
          </Authorized>
        </td>
      </tr>
    </>
  )
}

const mstp = state => {
  const {
    esSources: {esSources},
  } = state

  return {
    esSources,
  }
}

const mdtp = dispatch => {
  return {
    fetchElasticSearchInfo: () => dispatch(getElasticSearchInfoAsync()),
    connectElasticSearch: bindActionCreators(connectElasticSearch, dispatch),
    disconnectElasticSearch: bindActionCreators(
      disconnectElasticSearch,
      dispatch
    ),
  }
}

export default connect(mstp, mdtp, null)(ElasticTableRow)
