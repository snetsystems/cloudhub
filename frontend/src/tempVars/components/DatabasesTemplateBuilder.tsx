import React, {PureComponent} from 'react'
import _ from 'lodash'

import {ErrorHandling} from 'src/shared/decorators/errors'
import {showDatabases} from 'src/shared/apis/metaQuery'
import parseShowDatabases from 'src/shared/parsing/showDatabases'
import TemplateMetaQueryPreview from 'src/tempVars/components/TemplateMetaQueryPreview'

import {
  TemplateBuilderProps,
  RemoteDataState,
  TemplateValueType,
} from 'src/types'

import {isUserAuthorized, SUPERADMIN_ROLE} from 'src/auth/Authorized'

interface State {
  databasesStatus: RemoteDataState
}

@ErrorHandling
class DatabasesTemplateBuilder extends PureComponent<
  TemplateBuilderProps,
  State
> {
  constructor(props) {
    super(props)

    this.state = {
      databasesStatus: RemoteDataState.Loading,
    }
  }

  public async componentDidMount() {
    this.loadDatabases()
  }

  public render() {
    const {template, onUpdateDefaultTemplateValue} = this.props
    const {databasesStatus} = this.state

    return (
      <>
        <div className="form-group col-xs-12">
          <label>Meta Query</label>
          <div className="temp-builder--mq-controls">
            <div className="temp-builder--mq-text">SHOW DATABASES</div>
          </div>
        </div>
        <TemplateMetaQueryPreview
          items={template.values}
          loadingStatus={databasesStatus}
          onUpdateDefaultTemplateValue={onUpdateDefaultTemplateValue}
        />
      </>
    )
  }

  private async loadDatabases(): Promise<void> {
    const {template, source, onUpdateTemplate, me} = this.props

    this.setState({databasesStatus: RemoteDataState.Loading})

    try {
      const {data} = await showDatabases(source.links.proxy)
      const {databases} = parseShowDatabases(data)

      let roleDatabases: string[]

      if (databases && databases.length > 0) {
        if (isUserAuthorized(me.role, SUPERADMIN_ROLE)) {
          roleDatabases = databases
        } else {
          roleDatabases = _.filter(
            databases,
            database => database === me.currentOrganization.name
          )
        }
      }

      this.setState({databasesStatus: RemoteDataState.Done})

      const nextValues = roleDatabases.map(db => {
        return {
          type: TemplateValueType.Database,
          value: db,
          selected: false,
          localSelected: false,
        }
      })

      if (nextValues[0]) {
        nextValues[0].selected = true
      }

      const nextTemplate = {
        ...template,
        values: nextValues,
      }

      onUpdateTemplate(nextTemplate)
    } catch {
      this.setState({databasesStatus: RemoteDataState.Error})
    }
  }
}

export default DatabasesTemplateBuilder
