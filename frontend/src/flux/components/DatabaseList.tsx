import React, {PureComponent} from 'react'

import DatabaseListItem from 'src/flux/components/DatabaseListItem'

import {showDatabases} from 'src/shared/apis/metaQuery'
import showDatabasesParser from 'src/shared/parsing/showDatabases'

import {ErrorHandling} from 'src/shared/decorators/errors'
import {Source, NotificationAction, Me} from 'src/types'
import _ from 'lodash'
import {isUserAuthorized, SUPERADMIN_ROLE} from 'src/auth/Authorized'
import {executeQuery} from 'src/shared/apis/flux/query'
import {parseResponse} from 'src/shared/parsing/flux/response'

interface Props {
  source: Source
  notify: NotificationAction
  me: Me
  isUsingAuth: boolean
  v2?: boolean
}

export async function getBuckets(source: Source): Promise<string[]> {
  const {csv} = await executeQuery(source, 'buckets()')
  const tables = parseResponse(csv)
  if (tables && tables.length > 0) {
    const data = tables[0].data
    if (data.length > 1) {
      const nameIndex = data[0].indexOf('name')
      if (nameIndex > 0) {
        const buckets = data.slice(1).map(arr => arr[nameIndex] as string)
        return buckets.sort()
      }
    }
  }
  return []
}

interface State {
  databases: string[]
}

@ErrorHandling
class DatabaseList extends PureComponent<Props, State> {
  constructor(props) {
    super(props)

    this.state = {
      databases: [],
    }
  }

  public componentDidMount() {
    this.getDatabases()
  }

  public async getDatabases() {
    const {source, me, isUsingAuth, v2} = this.props
    const currentOrganization = _.get(me, 'currentOrganization.name')

    try {
      if (v2) {
        const buckets = await getBuckets(source)
        this.setState({databases: buckets})
      } else {
        const {data} = await showDatabases(source.links.proxy)
        const {databases} = showDatabasesParser(data)

        let roleDatabases: string[]

        if (isUserAuthorized(me.role, SUPERADMIN_ROLE) || !isUsingAuth) {
          this.setState({databases: databases.sort()})
        } else {
          roleDatabases = _.filter(
            databases,
            database => database === currentOrganization
          )

          this.setState({databases: roleDatabases})
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  public render() {
    const {databases} = this.state
    const {source, notify} = this.props

    return databases.map(db => {
      return (
        <DatabaseListItem db={db} key={db} source={source} notify={notify} />
      )
    })
  }
}

export default DatabaseList
