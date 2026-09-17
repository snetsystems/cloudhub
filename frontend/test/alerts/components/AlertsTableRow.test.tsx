import React from 'react'
import AlertsTableRow from 'src/alerts/components/AlertsTableRow'
import {Link} from 'react-router'

import {shallow} from 'enzyme'

// Types
import {TimeZones} from 'src/types'

const alertsTableRowProps = {
  sourceID: '3',
  name: 'No Dog Can Be',
  level: 'OK',
  time: Date.now().toString(),
  host: 'Ada Island',
  value: '1337',
  timeZone: TimeZones.UTC,
}

const setup = (override = {}) => {
  const props = {
    ...alertsTableRowProps,
    ...override,
  }
  const wrapper = shallow(<AlertsTableRow {...props} />)
  return {
    props,
    wrapper,
  }
}

describe('Components.Shared.ProvidersTableRowNew', () => {
  it('should render all valid data with the passed in data', () => {
    const time = Date.now().toString()

    const {wrapper} = setup({time})

    const nameCell = wrapper.find({'data-test': 'nameCell'})
    const levelCell = wrapper.find({'data-test': 'levelCell'})
    const timeCell = wrapper.find({'data-test': 'timeCell'})
    const hostCell = wrapper.find({'data-test': 'hostCell'})
    const valueCell = wrapper.find({'data-test': 'valueCell'})

    expect(nameCell.text()).toBe('No Dog Can Be')
    expect(levelCell.text()).toBe('')
    expect(timeCell.text()).toBe(new Date(Number(time)).toISOString())
    expect(hostCell.find(Link).exists()).toBe(true)
    expect(valueCell.text()).toBe('1337')
  })

  it('should render any invalid data as an mdash', () => {
    const props = {
      sourceID: '3',
      name: null,
      level: null,
      time: null,
      host: null,
      value: null,
    }
    const {wrapper} = setup(props)

    const nameCell = wrapper.find({'data-test': 'nameCell'})
    const levelCell = wrapper.find({'data-test': 'levelCell'})
    const timeCell = wrapper.find({'data-test': 'timeCell'})
    const hostCell = wrapper.find({'data-test': 'hostCell'})
    const valueCell = wrapper.find({'data-test': 'valueCell'})

    expect(nameCell.text()).toBe('–')
    expect(levelCell.text()).toBe('–')
    expect(timeCell.text()).toBe('–')
    expect(hostCell.find(Link).exists()).toBe(false)
    expect(valueCell.text()).toBe('–')
  })

  it('should link a server source to its host details page', () => {
    const {wrapper} = setup()

    const link = wrapper.find({'data-test': 'hostCell'}).find(Link)

    expect(link.prop('to')).toBe(
      '/sources/3/server-monitoring/server-list/Ada Island'
    )
  })

  it('should link an anomaly prediction source with its trigger', () => {
    const {wrapper} = setup({triggerType: 'anomaly_predict'})

    const link = wrapper.find({'data-test': 'hostCell'}).find(Link)

    expect(link.prop('to')).toBe(
      '/sources/3/server-monitoring/server-list/Ada Island' +
        '?trigger=anomaly_predict&app=snmp_nx_all'
    )
  })

  it('should link a network device source by its management ip', () => {
    // The cell reads "<port> @ <ip>" but HostPage resolves devices by
    // agent_host, so the link must carry the bare ip.
    const {wrapper} = setup({
      host: 'Ethernet1/5 @ 10.20.3.252',
      alertDomain: 'network-device',
      agentHost: '10.20.3.252',
    })

    const link = wrapper.find({'data-test': 'hostCell'}).find(Link)

    expect(link.prop('to')).toBe(
      '/sources/3/server-monitoring/server-list/10.20.3.252?app=snmp_nx_all'
    )
    // the cell still reads as the port, only the destination uses the ip
    expect(link.prop('title')).toBe('Ethernet1/5 @ 10.20.3.252')
  })
})
