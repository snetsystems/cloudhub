import React, {FunctionComponent} from 'react'
import _ from 'lodash'

import Dropdown from 'src/shared/components/Dropdown'

import {Template, TemplateValue, TemplateValueType, Me} from 'src/types'

import {isUserAuthorized, SUPERADMIN_ROLE} from 'src/auth/Authorized'

interface Props {
  template: Template
  me: Me
  isUsingAuth: boolean
  onPickValue: (v: TemplateValue) => void
}

const TemplateDropdown: FunctionComponent<Props> = props => {
  const {template, me, isUsingAuth, onPickValue} = props

  let dropdownItems = []

  if (isUserAuthorized(me.role, SUPERADMIN_ROLE) || !isUsingAuth) {
    dropdownItems = template.values.map(value => {
      if (value.type === TemplateValueType.Map) {
        return {...value, text: value.key}
      }
      return {...value, text: value.value}
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
        return {...value, text: value.value}
      })
    }
  }

  const localSelectedItem = dropdownItems.find(item => item.localSelected) ||
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
