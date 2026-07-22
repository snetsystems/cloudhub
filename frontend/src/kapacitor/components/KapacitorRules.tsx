import React, {FunctionComponent, useState, useEffect} from 'react'
import {Link} from 'react-router'

import KapacitorRulesTable from 'src/kapacitor/components/KapacitorRulesTable'
import TasksTable from 'src/kapacitor/components/TasksTable'
import {
  ComponentSize,
  ComponentStatus,
  SlideToggle,
  Dropdown,
} from 'src/reusable_ui'

import {Source, AlertRule, Kapacitor, Me} from 'src/types'
import {isUserAuthorized, SUPERADMIN_ROLE} from 'src/auth/Authorized'

interface KapacitorRulesProps {
  source: Source
  kapacitor: Kapacitor
  rules: AlertRule[]
  me: Me
  onDelete: (rule: AlertRule) => void
  onChangeRuleStatus: (rule: AlertRule) => void
}

const KapacitorRules: FunctionComponent<KapacitorRulesProps> = ({
  source,
  kapacitor,
  rules,
  me,
  onDelete,
  onChangeRuleStatus,
}) => {
  const isSuperAdmin = isUserAuthorized(me?.role, SUPERADMIN_ROLE)
  const DEFAULT_SELECTED_VALUE: string = 'All'
  const [showDefault, setShowDefault] = useState<boolean>(() => {
    return sessionStorage.getItem('kapacitor_showDefault') === 'true'
  })

  const [selectedDefault, setSelectedDefault] = useState<string>(() => {
    const saved = sessionStorage.getItem('kapacitor_selectedDefault')
    return saved && saved !== 'undefined' ? saved : DEFAULT_SELECTED_VALUE
  })

  useEffect(() => {
    sessionStorage.setItem('kapacitor_showDefault', String(showDefault))
  }, [showDefault])

  useEffect(() => {
    sessionStorage.setItem('kapacitor_selectedDefault', selectedDefault)
  }, [selectedDefault])

  const handleDefaultDropdownChange = (value: {id: string}) => {
    setSelectedDefault(value.id)
  }

  const handleOnChangeShowDefault = () => {
    setShowDefault(!showDefault)
  }

  const builderRules = rules.filter((r: AlertRule) => r.query)
  const builderHeader = `${builderRules.length} Alert Rule${
    builderRules.length === 1 ? '' : 's'
  }`

  const getFilteredscripts = () => {
    if (!isSuperAdmin || !showDefault) {
      return rules.filter((r: AlertRule) => r.source === 'user')
    }
    switch (selectedDefault) {
      case DEFAULT_SELECTED_VALUE:
        return rules
      case 'AI':
        return rules.filter((r: AlertRule) => r.source.includes('ai'))
      case 'Group':
        return rules.filter((r: AlertRule) => r.source.includes('alert-group'))
      case 'User':
        return rules.filter((r: AlertRule) => r.source === 'user')
      default:
        return rules
    }
  }

  const tickScripts = getFilteredscripts()

  const scriptsHeader = `${tickScripts.length} TICKscript${
    tickScripts.length === 1 ? '' : 's'
  }`
  const kapacitorLink = `/sources/${source.id}/kapacitors/${kapacitor.id}`

  return (
    <div className="kapacitor-rules">
      <div className="panel">
        <div className="panel-heading">
          <h2 className="panel-title">{builderHeader}</h2>
          <Link
            to={`${kapacitorLink}/alert-rules/new`}
            className="btn btn-sm btn-primary kapacitor-rules__action"
          >
            <span className="icon plus" /> Build Alert Rule
          </Link>
        </div>
        <div className="panel-body">
          <KapacitorRulesTable
            kapacitorLink={kapacitorLink}
            rules={builderRules}
            onDelete={onDelete}
            onChangeRuleStatus={onChangeRuleStatus}
          />
        </div>
      </div>
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2 className="panel-title">{scriptsHeader}</h2>
            {isSuperAdmin && (
              <div className="kapacitor-rules__toggle">
                <SlideToggle
                  active={showDefault}
                  size={ComponentSize.ExtraSmall}
                  onChange={handleOnChangeShowDefault}
                />
              </div>
            )}
          </div>
          <div>
            {isSuperAdmin && (
              <div className="kapacitor-rules__filter">
                <Dropdown
                  onChange={handleDefaultDropdownChange}
                  selectedID={selectedDefault}
                  buttonSize={ComponentSize.Small}
                  widthPixels={90}
                  customClass="dropdown dropdown-sm dropdown-default"
                  status={
                    showDefault
                      ? ComponentStatus.Default
                      : ComponentStatus.Disabled
                  }
                >
                  <Dropdown.Item
                    id={`${DEFAULT_SELECTED_VALUE}`}
                    value={{id: `${DEFAULT_SELECTED_VALUE}`}}
                  >
                    All
                  </Dropdown.Item>
                  <Dropdown.Item id="AI" value={{id: 'AI'}}>
                    AI
                  </Dropdown.Item>
                  <Dropdown.Item id="Group" value={{id: 'Group'}}>
                    Group
                  </Dropdown.Item>
                  <Dropdown.Item id="User" value={{id: 'User'}}>
                    User
                  </Dropdown.Item>
                </Dropdown>
              </div>
            )}

            <Link
              to={`${kapacitorLink}/tickscripts/new`}
              className="btn btn-sm btn-success kapacitor-rules__action"
            >
              <span className="icon plus" /> Write TICKscript
            </Link>
          </div>
        </div>
        <div className="panel-body">
          <TasksTable
            kapacitorLink={kapacitorLink}
            tasks={tickScripts}
            onDelete={onDelete}
            onChangeRuleStatus={onChangeRuleStatus}
          />
        </div>
      </div>
    </div>
  )
}

export default KapacitorRules
