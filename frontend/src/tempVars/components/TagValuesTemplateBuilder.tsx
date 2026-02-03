import React, {PureComponent} from 'react'
import _ from 'lodash'

import {ErrorHandling} from 'src/shared/decorators/errors'
import Dropdown from 'src/shared/components/Dropdown'
import {showDatabases, showMeasurements} from 'src/shared/apis/metaQuery'
import {proxy} from 'src/utils/queryUrlGenerator'
import parseShowDatabases from 'src/shared/parsing/showDatabases'
import parseShowMeasurements from 'src/shared/parsing/showMeasurements'
import parseShowTagValues from 'src/shared/parsing/showTagValues'
import {fetchTagKeys} from 'src/tempVars/components/TagKeysTemplateBuilder'
import TemplateMetaQueryPreview from 'src/tempVars/components/TemplateMetaQueryPreview'
import DropdownLoadingPlaceholder from 'src/shared/components/DropdownLoadingPlaceholder'

import {
  TemplateBuilderProps,
  TemplateValueType,
  TemplateType,
  RemoteDataState,
} from 'src/types'

import {isUserAuthorized, SUPERADMIN_ROLE} from 'src/auth/Authorized'

interface State {
  databases: string[]
  databasesStatus: RemoteDataState
  selectedDatabase: string
  measurements: string[]
  measurementsStatus: RemoteDataState
  selectedMeasurement: string
  tagKeys: string[]
  tagKeysStatus: RemoteDataState
  selectedTagKey: string
  tagValuesStatus: RemoteDataState
}

@ErrorHandling
class KeysTemplateBuilder extends PureComponent<TemplateBuilderProps, State> {
  constructor(props) {
    super(props)

    const selectedDatabase = _.get(props, 'template.query.db', '')
    const selectedMeasurement = _.get(props, 'template.query.measurement', '')
    const selectedTagKey = _.get(props, 'template.query.tagKey', '')

    this.state = {
      databases: [],
      databasesStatus: RemoteDataState.Loading,
      selectedDatabase,
      measurements: [],
      measurementsStatus: RemoteDataState.Loading,
      selectedMeasurement,
      tagKeys: [],
      tagKeysStatus: RemoteDataState.Loading,
      selectedTagKey,
      tagValuesStatus: RemoteDataState.Loading,
    }
  }

  public async componentDidMount() {
    await this.loadDatabases()
    await this.loadMeasurements()
    await this.loadTagKeys()
    await this.loadTagValues()
  }

  public render() {
    const {template, onUpdateDefaultTemplateValue} = this.props
    const {
      databases,
      databasesStatus,
      selectedDatabase,
      measurements,
      measurementsStatus,
      selectedMeasurement,
      tagKeys,
      tagKeysStatus,
      selectedTagKey,
      tagValuesStatus,
    } = this.state

    return (
      <>
        <div className="form-group col-xs-12">
          <label>Meta Query</label>
          <div className="temp-builder--mq-controls">
            <div className="temp-builder--mq-text">SHOW TAG VALUES ON</div>
            <DropdownLoadingPlaceholder rds={databasesStatus}>
              <Dropdown
                items={databases.map(text => ({text}))}
                onChoose={this.handleChooseDatabaseDropdown}
                selected={selectedDatabase}
                buttonSize="btn-sm"
                className="dropdown-stretch"
              />
            </DropdownLoadingPlaceholder>
          </div>
          <div className="temp-builder--mq-controls">
            <div className="temp-builder--mq-text">FROM</div>
            <DropdownLoadingPlaceholder rds={measurementsStatus}>
              <Dropdown
                items={measurements.map(text => ({text}))}
                onChoose={this.handleChooseMeasurementDropdown}
                selected={selectedMeasurement}
                buttonSize="btn-sm"
                className="dropdown-stretch"
              />
            </DropdownLoadingPlaceholder>
            <div className="temp-builder--mq-text">WITH KEY</div>
            <DropdownLoadingPlaceholder rds={tagKeysStatus}>
              <Dropdown
                items={tagKeys.map(text => ({text}))}
                onChoose={this.handleChooseTagKeyDropdown}
                selected={selectedTagKey}
                buttonSize="btn-sm"
                className="dropdown-stretch"
              />
            </DropdownLoadingPlaceholder>
          </div>
        </div>
        <TemplateMetaQueryPreview
          items={template.values}
          loadingStatus={tagValuesStatus}
          onUpdateDefaultTemplateValue={onUpdateDefaultTemplateValue}
          templateType={TemplateType.TagValues}
          onUpdateAllOption={this.handleUpdateAllOption}
          isAllEnabled={template.options?.isAllEnabled}
        />
      </>
    )
  }

  private async loadDatabases(): Promise<void> {
    const {source, me, isUsingAuth} = this.props

    this.setState({databasesStatus: RemoteDataState.Loading})

    try {
      const {data} = await showDatabases(source.links.proxy)
      const {databases} = parseShowDatabases(data)
      const {selectedDatabase} = this.state

      let roleDatabases: string[]

      if (databases && databases.length > 0) {
        if (isUserAuthorized(me.role, SUPERADMIN_ROLE) || !isUsingAuth) {
          roleDatabases = databases
        } else {
          roleDatabases = _.filter(
            databases,
            database => database === me.currentOrganization.name
          )
        }
      }

      this.setState({
        databases: roleDatabases,
        databasesStatus: RemoteDataState.Done,
      })

      if (!selectedDatabase) {
        this.handleChooseDatabase(_.get(roleDatabases, 0, ''))
      }
    } catch (error) {
      this.setState({databasesStatus: RemoteDataState.Error})
      console.error(error)
    }
  }

  private async loadMeasurements(): Promise<void> {
    const {source} = this.props
    const {selectedDatabase, selectedMeasurement} = this.state

    this.setState({measurementsStatus: RemoteDataState.Loading})

    try {
      const {data} = await showMeasurements(
        source.links.proxy,
        selectedDatabase
      )
      const {measurementSets} = parseShowMeasurements(data)
      const measurements = _.get(measurementSets, '0.measurements', [])

      this.setState({
        measurements,
        measurementsStatus: RemoteDataState.Done,
      })

      if (!selectedMeasurement) {
        this.handleChooseMeasurement(_.get(measurements, 0, ''))
      }
    } catch (error) {
      this.setState({measurementsStatus: RemoteDataState.Error})
      console.error(error)
    }
  }

  private async loadTagKeys(): Promise<void> {
    const {source} = this.props
    const {selectedTagKey} = this.state

    const {selectedDatabase, selectedMeasurement} = this.state

    this.setState({tagKeysStatus: RemoteDataState.Loading})

    try {
      const tagKeys = await fetchTagKeys(
        source,
        selectedDatabase,
        selectedMeasurement
      )

      this.setState({
        tagKeys,
        tagKeysStatus: RemoteDataState.Done,
      })

      if (!selectedTagKey) {
        this.handleChooseTagKey(_.get(tagKeys, 0, ''))
      }
    } catch (error) {
      this.setState({tagKeysStatus: RemoteDataState.Error})
      console.error(error)
    }
  }

  private loadTagValues = async (): Promise<void> => {
    const {source, template, onUpdateTemplate} = this.props
    const {selectedDatabase, selectedMeasurement, selectedTagKey} = this.state

    this.setState({tagValuesStatus: RemoteDataState.Loading})

    try {
      const {data} = await proxy({
        source: source.links.proxy,
        db: selectedDatabase,
        query: `SHOW TAG VALUES ON "${selectedDatabase}" FROM "${selectedMeasurement}" WITH KEY = "${selectedTagKey}"`,
      })

      const {tags} = parseShowTagValues(data)
      const tagValues = _.get(Object.values(tags), 0, [])

      this.setState({tagValuesStatus: RemoteDataState.Done})

      const nextValues = tagValues.map(value => {
        return {
          type: TemplateValueType.TagValue,
          value,
          selected: false,
          localSelected: false,
        }
      })


      const isAllEnabled =
        template.options?.isAllEnabled !== undefined
          ? template.options.isAllEnabled
          : true

      const allValue = template.values.find(v => v.value === 'allTagValues')
      const hasAll = allValue && isAllEnabled

      let finalValues
      let finalOptions

      if (isAllEnabled) {

        if (hasAll) {
          finalValues = [
            {
              ...allValue,
              selected: false,
              localSelected: false,
            },
            ...nextValues.map((v, index) => ({
              ...v,
              selected: index === 0,
              localSelected: index === 0,
            })),
          ]
        } else {
          finalValues = [
            {
              value: 'allTagValues',
              type: TemplateValueType.TagValue,
              selected: false,
              localSelected: false,
            },
            ...nextValues.map((v, index) => ({
              ...v,
              selected: index === 0,
              localSelected: index === 0,
            })),
          ]
        }
        finalOptions = {
          ...template.options,
          isAllEnabled: true,
        }
      } else {
        if (nextValues.length > 0) {
          finalValues = nextValues.map((v, index) => ({
            ...v,
            selected: index === 0,
            localSelected: index === 0,
          }))
        } else {
          finalValues = nextValues
        }
        finalOptions = {
          ...template.options,
          isAllEnabled: false,
        }
      }

      onUpdateTemplate({
        ...template,
        values: finalValues,
        options: finalOptions,
        query: {
          ...template.query,
          db: selectedDatabase,
          measurement: selectedMeasurement,
          tagKey: selectedTagKey,
        },
      })
    } catch (error) {
      this.setState({tagValuesStatus: RemoteDataState.Error})
      console.error(error)
    }
  }

  private handleChooseDatabaseDropdown = ({text}) => {
    this.handleChooseDatabase(text)
  }

  private handleChooseDatabase = (db: string): void => {
    this.setState({selectedDatabase: db, selectedMeasurement: ''}, () =>
      this.loadMeasurements()
    )

    const {template, onUpdateTemplate} = this.props

    onUpdateTemplate({
      ...template,
      query: {
        ...template.query,
        db,
        tagKey: '',
        measurement: '',
      },
    })
  }

  private handleChooseMeasurementDropdown = ({text}): void => {
    this.handleChooseMeasurement(text)
  }

  private handleChooseMeasurement = (measurement: string): void => {
    this.setState({selectedMeasurement: measurement, selectedTagKey: ''}, () =>
      this.loadTagKeys()
    )

    const {template, onUpdateTemplate} = this.props

    onUpdateTemplate({
      ...template,
      query: {
        ...template.query,
        measurement,
        tagKey: '',
      },
    })
  }

  private handleChooseTagKeyDropdown = ({text}): void => {
    this.handleChooseTagKey(text)
  }

  private handleChooseTagKey = (tagKey: string): void => {
    this.setState({selectedTagKey: tagKey}, () => this.loadTagValues())

    const {template, onUpdateTemplate} = this.props

    onUpdateTemplate({
      ...template,
      query: {
        ...template.query,
        tagKey,
      },
    })
  }

  private handleUpdateAllOption = (isAllEnabled: boolean): void => {
    const {template, onUpdateTemplate} = this.props

    let updatedValues = [...template.values]
    let updatedOptions = {
      ...template.options,
      isAllEnabled: isAllEnabled,
    }

    if (isAllEnabled) {

      const hasAll = updatedValues.some(v => v.value === 'allTagValues')

      if (!hasAll) {
        const allValue = {
          value: 'allTagValues',
          type: TemplateValueType.TagValue,
          selected: false,
          localSelected: false,
        }

        updatedValues = updatedValues.map((v, index) => ({
          ...v,
          selected: index === 0,
          localSelected: index === 0,
        }))

        updatedValues = [allValue, ...updatedValues]
      } else {

        let firstNonAllIndex = -1
        updatedValues = updatedValues.map((v, index) => {
          if (v.value === 'allTagValues') {
            return {
              ...v,
              selected: false,
              localSelected: false,
            }
          }
          if (firstNonAllIndex === -1) {
            firstNonAllIndex = index
          }
          return v
        })

        if (firstNonAllIndex !== -1) {
          updatedValues[firstNonAllIndex] = {
            ...updatedValues[firstNonAllIndex],
            selected: true,
            localSelected: true,
          }
        }
      }
    } else {
      updatedValues = updatedValues.filter(v => v.value !== 'allTagValues')
      if (updatedValues.length > 0) {
        updatedValues = updatedValues.map((v, index) => ({
          ...v,
          selected: index === 0,
          localSelected: index === 0,
        }))
      }
    }

    onUpdateTemplate({
      ...template,
      values: updatedValues,
      options: updatedOptions,
    })
  }
}

export default KeysTemplateBuilder
