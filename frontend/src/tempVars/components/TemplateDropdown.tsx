import React, {FunctionComponent} from 'react'
import _ from 'lodash'

import Dropdown from 'src/shared/components/Dropdown'

// import {Template, TemplateValue, TemplateValueType, Me} from 'src/types'
import {Template, TemplateValue, TemplateValueType, Me} from 'src/types'

import {isUserAuthorized, SUPERADMIN_ROLE} from 'src/auth/Authorized'

interface Props {
  template: Template
  me: Me
  isUsingAuth: boolean
  onPickValue: (v: TemplateValue) => void
}

const TemplateDropdown: FunctionComponent<Props> = props => {
  //const {template, me, isUsingAuth, onPickValue} = props
  let {template, me, isUsingAuth, onPickValue} = props

  let dropdownItems = []

  if (isUserAuthorized(me.role, SUPERADMIN_ROLE) || !isUsingAuth) {
    dropdownItems = template.values.map(value => {
      if (value.type === TemplateValueType.Map) {
        return {...value, text: value.key}
      }
      return {
        ...value,
        text: value.value === 'allTagValues' ? 'All' : value.value,
      }
    })
  } else {
    if (template.type === 'databases') {
      dropdownItems = _.filter(template.values, value => {
        return value.value === me.currentOrganization.name
      }).map(m => {
        return {...m, text: m.value}
      })
    } else {
      dropdownItems = template.values.map(value => {
        if (value.type === TemplateValueType.Map) {
          return {...value, text: value.key}
        }
        return {
          ...value,
          text: value.value === 'allTagValues' ? 'All' : value.value,
        }
      })
    }
  }

  if (template.options?.isAllEnabled === true) {
    const hasAll = dropdownItems.some(item => item.value === 'allTagValues')
    if (!hasAll) {
      const allValue: TemplateValue = {
        type: TemplateValueType.TagValue,
        value: 'allTagValues',
        selected: false,
        localSelected: false,
      }
      dropdownItems = [{...allValue, text: 'All'}, ...dropdownItems]
    }
  }

  const localSelectedItem = dropdownItems.find(
    item => item.localSelected && item.value !== 'allTagValues'
  ) ||
    dropdownItems.find(item => item.localSelected) ||
    dropdownItems.find(item => item.value !== 'allTagValues') ||
    dropdownItems[0] || {text: '(No values)'}
  return (
    <Dropdown
      items={dropdownItems}
      buttonSize="btn-xs"
      menuClass="dropdown-astronaut"
      useAutoComplete={true}
      selected={localSelectedItem.text}
      onChoose={onPickValue}
    />
  )
}

export default TemplateDropdown
