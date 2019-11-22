import React, { PureComponent } from 'react'
import { AGENT_TABLE_SIZING } from 'src/hosts/constants/tableSizing'

import { Minion } from 'src/types'

interface Props {
	key: Readonly<Props>
	minions: Minion
	// ip: string
	// host: string
	// status: string
	// currentUrl: string
	// onClickTableRow: () => void
	onClickModal: ({ }) => object
	handleWheelKeyCommand: () => void
	focusedHost: string
}

class AgentMinionsTableRow extends PureComponent<Props> {
	constructor(props) {
		super(props)
	}

	public focusedClasses = (host: string): string => {
		const { focusedHost } = this.props
		if (host === focusedHost) {
			return 'hosts-table--tr focused'
		}
		return 'hosts-table--tr'
	}

	public isAcceptIndicator = (isAccept) => {
		if (isAccept === 'true') {
			return (
				<div
					style={{
						color: '#4ed8a0',
					}}
				>
					Accepted
				</div>
			)
		}

		return (
			<div
				style={{
					color: '#e85b1c',
				}}
			>
				unAccept
			</div>
		)
	}

	public isStatusIndicator = (status) => {
		if (status === 'Accept') {
			return (
				<div
					style={{
						color: '#4ed8a0',
					}}
				>
					Accepted
				</div>
			)
		} else if (status === 'UnAccept') {
			return (
				<div
					style={{
						color: '#e85b1c',
					}}
				>
					UnAccept
				</div>
			)
		} else if (status === 'ReJect') {
			return (
				<div
					style={{
						color: '#e85b1c',
					}}
				>
					ReJect
				</div>
			)
		}
	}

	render() {
		console.log('rowRender')
		return this.TableRowEachPage
	}

	private get TableRowEachPage() {
		const { key, minions, onClickTableRow, onClickModal, handleWheelKeyCommand } = this.props

		const { osVersion, os, ip, host, status } = minions
		const { StatusWidth, HostWidth, IPWidth } = AGENT_TABLE_SIZING

		return (
			<div className={this.focusedClasses(host)} onClick={onClickTableRow(host)}>
				<div className="hosts-table--td" style={{ width: HostWidth }}>
					{host}
				</div>

				<div className="hosts-table--td" style={{ width: IPWidth }}>
					{os}
				</div>

				<div className="hosts-table--td" style={{ width: IPWidth }}>
					{osVersion}
				</div>

				<div className="hosts-table--td" style={{ width: IPWidth }}>
					{ip}
				</div>
				<div className="hosts-table--td" style={{ width: StatusWidth }}>
					{this.isStatusIndicator(status)}
				</div>
				<div className="hosts-table--td" id={`table-row--select${key}`} style={{ width: StatusWidth }}>
					{onClickModal({
						name: '=',
						host,
						status,
						_this: this,
						handleWheelKeyCommand,
						key,
					})}
				</div>
			</div>
		)
	}
}

export default AgentMinionsTableRow
