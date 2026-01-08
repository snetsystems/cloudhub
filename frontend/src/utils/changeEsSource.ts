import {Me} from 'src/types'
import {BaseElasticSearchData} from 'src/types'

interface Props {
  me: Me
  esSource: BaseElasticSearchData
  esSources?: BaseElasticSearchData[]
  handleGetElasticSearchInfo: () => void
  handleDisconnectElasticSearch: () => void
  handleConnectElasticSearch: ({
    elasticSearchInfo,
  }: {
    elasticSearchInfo: BaseElasticSearchData
  }) => void
}

export const checkAndConnectElasticSearch = async ({
  me,
  esSource,
  esSources,
  handleGetElasticSearchInfo,
  handleDisconnectElasticSearch,
  handleConnectElasticSearch,
}: Props) => {
  if (!me) {
    return
  }

  const currentOrgID = me.currentOrganization?.id

  await handleGetElasticSearchInfo()

  if (!esSource) {
    handleConnectElasticSearch({
      elasticSearchInfo:
        esSources.find(el => el.default === true) ||
        esSources.find(el => el.organization === currentOrgID) ||
        esSources[0],
    })
    return
  }

  const isConnectedSourceValid =
    esSource &&
    esSource.organization === currentOrgID &&
    esSources.some(el => el.id === esSource.id)

  if (isConnectedSourceValid) {
    return
  }

  if (esSource && !esSources.find(el => el.id === esSource.id)) {
    await handleDisconnectElasticSearch()
  }

  const connectCandidate = me.superAdmin
    ? esSources.find(el => el.default === true) || esSources[0]
    : esSources.find(el => el.organization === currentOrgID)

  if (connectCandidate) {
    handleConnectElasticSearch({elasticSearchInfo: connectCandidate})
  } else {
    console.warn(
      `[ElasticSearch] No available source to connect for org: ${currentOrgID}`
    )
  }
}
