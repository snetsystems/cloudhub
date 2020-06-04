import React, {PureComponent} from 'react'

import DatabaseListItem from 'src/flux/components/DatabaseListItem'

import {showDatabases} from 'src/shared/apis/metaQuery'
import showDatabasesParser from 'src/shared/parsing/showDatabases'

import {ErrorHandling} from 'src/shared/decorators/errors'
import {Source, NotificationAction, Me} from 'src/types'
import _ from 'lodash'
import {isUserAuthorized, SUPERADMIN_ROLE} from 'src/auth/Authorized'

interface Props {
  source: Source
  notify: NotificationAction
  me: Me
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
    const {source, me} = this.props
    const currentOrganization = _.get(
      me,
      'currentOrganization.name',
      source.telegraf
    )

    try {
      const {data} = await showDatabases(source.links.proxy)
      const {databases, errors} = showDatabasesParser(data)

      if (errors.length > 0) {
        throw errors[0] // only one error can come back from this, but it's returned as an array
      }

      let roleDatabases: string[]

      if (isUserAuthorized(me.role, SUPERADMIN_ROLE) || !me.role) {
        this.setState({databases: databases.sort()})
      } else {
        roleDatabases = _.filter(
          databases,
          database => database === currentOrganization
        )

        this.setState({databases: roleDatabases})
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
