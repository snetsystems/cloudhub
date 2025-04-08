// libraries
import memoize from 'memoize-one'
import React from 'react'
import _ from 'lodash'

// types
import {RemoteDataState} from 'src/types'
import {SortDirection} from 'src/agent_admin/type'
import {TelegrafPlugin} from 'src/agent_admin/type/agent'

// components
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import AgentToolbarFunction from 'src/agent_admin/components/AgentToolbarFunction'

interface AgentConfigPluginContentsProps {
  measurementsStatus: RemoteDataState
  errorStateComponent: JSX.Element
  searchTerm: string
  plugins: TelegrafPlugin[]
  focusedMeasure: string
  description: string
  collapsedCategories: {}
  telegrafVersion: string
  toggleCategory: (cat: string) => void
  handleFocusedPlugin: ({
    name,
    category,
  }: {
    name: string
    category: string
    idx: number
  }) => Promise<void>
}

const pluginFilter = (
  plugin: TelegrafPlugin[],
  searchTerm: string
): TelegrafPlugin[] => {
  const filterText = searchTerm.toLowerCase()
  return plugin.filter(h => {
    return h.name.toLowerCase().includes(filterText)
  })
}

const pluginsSort = (
  plugin: TelegrafPlugin[],
  key: string,
  direction: SortDirection
): TelegrafPlugin[] => {
  switch (direction) {
    case SortDirection.ASC:
      return _.sortBy(plugin, e => e[key])
    case SortDirection.DESC:
      return _.sortBy(plugin, e => e[key]).reverse()
    default:
      return plugin
  }
}

const getSortedPlugin = memoize(
  (
    inputPluginList: TelegrafPlugin[],
    searchTerm: string,
    sortKey: string,
    sortDirection: SortDirection.ASC
  ) =>
    pluginsSort(
      pluginFilter(inputPluginList, searchTerm),
      sortKey,
      sortDirection
    )
)

const AgentConfigPluginContents = ({
  measurementsStatus,
  errorStateComponent,
  searchTerm,
  plugins,
  focusedMeasure,
  description,
  collapsedCategories,
  telegrafVersion,
  toggleCategory,
  handleFocusedPlugin,
}: AgentConfigPluginContentsProps) => {
  if (measurementsStatus === RemoteDataState.Error)
    return <>{errorStateComponent}</>

  const sortedPlugins = getSortedPlugin(
    plugins,
    searchTerm,
    'name',
    SortDirection.ASC
  )

  const groupedPlugins = _.groupBy(sortedPlugins, 'category')
  return (
    <FancyScrollbar>
      {_.isEmpty(groupedPlugins) && (
        <div>
          <p>This version of Telegraf is not supported.</p>
          <p>Please update to the latest version.</p>
        </div>
      )}
      {Object.keys(groupedPlugins).map((cat, i) => {
        const isCollapsed = collapsedCategories?.[cat] || false
        return (
          <div key={i}>
            <div style={{display: 'flex'}}>
              <div
                className={
                  'default-measurements telegraf-plugins-default-measurements'
                }
                onClick={() => toggleCategory(cat)}
              >
                ({_.capitalize(cat)} Plugin)
                <span
                  className={`telegraf-plugins-dropdown icon caret-${
                    isCollapsed ? 'up' : 'down'
                  } `}
                ></span>
              </div>
            </div>
            {!isCollapsed && (
              <div className="query-builder--list">
                {groupedPlugins[cat].map((plugin, j) => {
                  const category = plugin.category

                  return (
                    <AgentToolbarFunction
                      key={`${category}-${plugin.name}`}
                      idx={j}
                      inoutkind={category.toUpperCase()}
                      name={plugin.name}
                      category={category}
                      version={telegrafVersion}
                      isActivity={plugin.isActive}
                      handleFocusedPlugin={() =>
                        handleFocusedPlugin({
                          name: plugin.name,
                          category: category,
                          idx: j,
                        })
                      }
                      description={description}
                      focusedMeasure={focusedMeasure}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </FancyScrollbar>
  )
}

export default AgentConfigPluginContents
