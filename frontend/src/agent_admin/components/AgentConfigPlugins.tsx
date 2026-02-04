// libraries
import React, {useEffect, useState} from 'react'
import _ from 'lodash'
import yaml from 'js-yaml'

// apis
import {
  getLocalSaltCmdTelegraf,
  getRunnerSaltCmdTelegraf,
  getRunnerSaltCmdTelegrafPlugin,
} from 'src/shared/apis/saltStack'

// components
import AgentConfigPlugInModal from 'src/agent_admin/components/AgentConfigPlugInModal'
import SearchBar from 'src/hosts/components/SearchBar'
import AgentConfigPluginContents from 'src/agent_admin/components/AgentConfigPluginContents'

// types
import {Minion} from 'src/agent_admin/type'
import {TelegrafPlugin} from 'src/agent_admin/type/agent'
import {RemoteDataState} from 'src/types'

// utils
import {
  extractNumericVersion,
  extractTelegrafVersion,
  parsePluginsV2,
  parsePluginsV3,
} from 'src/agent_admin/utils'

// constants
import {LegacyTelegrafVersion} from 'src/agent_admin/constants/agentControlTableSupportedOsVersion'

interface AgentConfigPluginProps {
  loadingState: JSX.Element
  errorStateComponent: JSX.Element
  saltMasterUrl: string
  saltMasterToken: string
  minionsObject: Minion
}

const AgentConfigPlugin = ({
  loadingState,
  errorStateComponent,
  saltMasterUrl,
  saltMasterToken,
  minionsObject,
}: AgentConfigPluginProps) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [measurementsStatus, setMeasurementsStatus] = useState(
    RemoteDataState.NotStarted
  )
  const [collapsedCategories, setCollapsedCategories] = useState({})
  const [isPluginModalVisible, setIsPluginModalVisible] = useState(false)
  const [focusedMeasure, setFocusedMeasure] = useState('')
  const [description, setDescription] = useState('')
  const [pluginsObject, setPluginsObject] = useState<
    Record<string, TelegrafPlugin[]>
  >({})
  const [defaultTelegrafVersion, setDefaultTelegrafVersion] = useState('')
  const [verifiedVersions, setVerifiedVersions] = useState<
    Record<string, string>
  >({})

  const currentVersion =
    minionsObject?.telegrafVersion || defaultTelegrafVersion

  const pluginSearchTerm = (term: string) => {
    setSearchTerm(term)
  }

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prevState => ({
      ...prevState,
      [cat]: !(prevState?.[cat] ?? true),
    }))
  }

  const handleFocusedPlugin = async ({
    name,
    category,
  }: {
    name: string
    category: string
    idx: number
  }) => {
    const currentVersion =
      minionsObject?.telegrafVersion || defaultTelegrafVersion
    const currentPlugins = pluginsObject[currentVersion] || []

    const newPlugins = currentPlugins.map(p =>
      p.category === category && p.name === name
        ? {...p, isActive: true}
        : {...p, isActive: false}
    )

    setPluginsObject(prev => ({...prev, [currentVersion]: newPlugins}))
    setIsPluginModalVisible(true)
    setFocusedMeasure(name)
    setDescription('')

    try {
      const {data} = await getRunnerSaltCmdTelegraf(
        saltMasterUrl,
        saltMasterToken,
        name
      )
      setDescription(data.return[0])
    } catch (error) {
      console.error(error)
    }
  }

  const handlePluginModal = () => {
    setIsPluginModalVisible(false)
  }

  const getTelegrafPlugin = async () => {
    const versionResponse = await getRunnerSaltCmdTelegrafPlugin(
      saltMasterUrl,
      saltMasterToken,
      'telegraf version'
    )
    const versionData = _.get(
      yaml.safeLoad(versionResponse.data),
      'return'
    )?.[0]

    const telegrafVersion = extractTelegrafVersion(versionData).version || ''

    setDefaultTelegrafVersion(telegrafVersion)

    if (
      parseFloat(extractNumericVersion(telegrafVersion)) < LegacyTelegrafVersion
    ) {
      const combinedPlugins = await fetchLegacyTelegrafPlugins(
        saltMasterUrl,
        saltMasterToken
      )

      setPluginsObject(prev => ({
        ...prev,
        [telegrafVersion]: combinedPlugins,
      }))
    } else {
      const pluginResponse = await getRunnerSaltCmdTelegrafPlugin(
        saltMasterUrl,
        saltMasterToken,
        'telegraf plugins'
      )
      const pluginStr =
        _.get(yaml.safeLoad(pluginResponse.data), 'return')?.[0] || ''
      const telegrafPlugins = parsePluginsV3(pluginStr)

      setPluginsObject(prev => ({
        ...prev,
        [telegrafVersion]: telegrafPlugins,
      }))
    }
    setMeasurementsStatus(RemoteDataState.Done)
  }

  async function fetchLegacyTelegrafPlugins(
    saltMasterUrl: string,
    saltMasterToken: string
  ): Promise<TelegrafPlugin[]> {
    const commands = [
      {command: 'telegraf --input-list', category: 'inputs'},
      {command: 'telegraf --output-list', category: 'outputs'},
    ]
    const responses = await Promise.all(
      commands.map(({command}) =>
        getRunnerSaltCmdTelegrafPlugin(saltMasterUrl, saltMasterToken, command)
      )
    )
    const plugins = responses.flatMap((response, index) => {
      const category = commands[index].category
      const pluginStr = _.get(yaml.safeLoad(response.data), 'return')?.[0] || ''
      return parsePluginsV2(pluginStr, category)
    })

    return plugins
  }

  const extractPluginStr = (parsed: string, response: any): string => {
    const fromParsed = _.get(parsed, 'return')?.[0]
    if (typeof fromParsed === 'string') {
      return fromParsed
    }
    const fromResponse = _.get(response.data, 'return')?.[0]

    if (fromResponse && typeof fromResponse === 'object') {
      const dynamicValue = Object.values(fromResponse)[0] || ''
      return typeof dynamicValue === 'string'
        ? dynamicValue.split('\n').slice(1).join('\n')
        : ''
    } else if (typeof fromResponse === 'string') {
      return fromResponse.split('\n').slice(1).join('\n')
    }
    return ''
  }

  const getTelegrafInfoWithVersion = async (version: string) => {
    try {
      if (parseFloat(extractNumericVersion(version)) < LegacyTelegrafVersion) {
        const combinedPlugins = await fetchLegacyTelegrafPlugins(
          saltMasterUrl,
          saltMasterToken
        )

        setPluginsObject(prev => ({
          ...prev,
          [version]: combinedPlugins,
        }))
      } else {
        const response = await getLocalSaltCmdTelegraf(
          saltMasterUrl,
          saltMasterToken,
          'telegraf plugins',
          minionsObject.host
        )
        const pluginStr = extractPluginStr(
          yaml.safeLoad(response.data),
          response
        )

        const telegrafPlugins = parsePluginsV3(pluginStr)
        setPluginsObject(prev => ({
          ...prev,
          [version]: telegrafPlugins,
        }))
      }
    } catch (error) {
      console.error('Error fetching telegraf info for version', version, error)
    } finally {
      setMeasurementsStatus(RemoteDataState.Done)
    }
  }

  const verifyVersion = async (version: string) => {
    if (!version || verifiedVersions[version]) return

    try {
      const response = await fetch(
        `https://api.github.com/repos/snetsystems/telegraf/git/ref/tags/v${version}`
      )
      if (response.ok) {
        setVerifiedVersions(prev => ({...prev, [version]: `v${version}`}))
      } else {
        setVerifiedVersions(prev => ({...prev, [version]: 'HEAD'}))
      }
    } catch (error) {
      console.warn('Error verifying version:', error)
      setVerifiedVersions(prev => ({...prev, [version]: 'HEAD'}))
    }
  }

  useEffect(() => {
    setMeasurementsStatus(RemoteDataState.Loading)
    getTelegrafPlugin()
  }, [])

  useEffect(() => {
    const version = minionsObject?.telegrafVersion

    if (version && !pluginsObject[version]) {
      setMeasurementsStatus(RemoteDataState.Loading)
      getTelegrafInfoWithVersion(version)
    }
  }, [minionsObject, pluginsObject])

  useEffect(() => {
    if (currentVersion) {
      verifyVersion(currentVersion)
    }
  }, [currentVersion])

  return (
    <div className="panel">
      <div className="panel-heading">
        <h2 className="panel-title use-user-select" style={{width: '100%'}}>
          Plugins
        </h2>
        <SearchBar
          placeholder="Filter by Plugin..."
          onSearch={pluginSearchTerm}
          width={500}
        />
      </div>
      {measurementsStatus === RemoteDataState.Loading ? (
        <>{loadingState}</>
      ) : (
        <>
          <div className="panel-body">
            <AgentConfigPluginContents
              toggleCategory={toggleCategory}
              searchTerm={searchTerm}
              plugins={
                pluginsObject[
                  minionsObject?.telegrafVersion || defaultTelegrafVersion
                ] || []
              }
              telegrafVersion={
                minionsObject?.telegrafVersion || defaultTelegrafVersion
              }
              measurementsStatus={measurementsStatus}
              handleFocusedPlugin={handleFocusedPlugin}
              focusedMeasure={focusedMeasure}
              errorStateComponent={errorStateComponent}
              description={description}
              collapsedCategories={collapsedCategories}
              githubRef={
                verifiedVersions[currentVersion] || `v${currentVersion}`
              }
            />
          </div>
          <div>
            <AgentConfigPlugInModal
              isVisible={isPluginModalVisible}
              onClose={handlePluginModal}
              plugin={focusedMeasure}
              description={description}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default AgentConfigPlugin
