import React, { PureComponent } from 'react';

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer';
import AgentTable from 'src/agent_admin/components/AgentTable';
import AgentConsole from 'src/agent_admin/components/AgentConsole';

//const
import { HANDLE_HORIZONTAL } from 'src/shared/constants';

interface State {
	minions: Readonly<[]>;
	proportions: number[];
}

class AgentLog extends PureComponent<State> {
	constructor(props) {
		super(props);
		this.state = {
			minionLog: 'not load log',
			proportions: [ 0.43, 0.57 ]
		};
	}

	public onClickTableRowCall() {
		return console.log('row Called', this);
	}

	public onClickActionCall() {
		return console.log('action Called', this);
	}

	render() {
		return (
			<div className="panel panel-solid">
				<Threesizer
					orientation={HANDLE_HORIZONTAL}
					divisions={this.horizontalDivisions}
					onResize={this.handleResize}
				/>
			</div>
		);
	}

	private handleResize = (proportions: number[]) => {
		this.setState({ proportions });
	};

	private renderAgentPageTop = () => {
		// const {parentUrl} = this.props
		const { currentUrl, minions } = this.props;
		return (
			<AgentTable
				currentUrl={currentUrl}
				minions={minions}
				onClickTableRow={this.onClickTableRowCall}
				onClickAction={this.onClickActionCall}
			/>
		);
	};

	private renderAgentPageBottom = () => {
		const { minionLog } = this.state;
		return <AgentConsole res={minionLog} />;
	};

	private get horizontalDivisions() {
		const { proportions } = this.state;
		const [ topSize, bottomSize ] = proportions;

		return [
			{
				name: '',
				handleDisplay: 'none',
				headerButtons: [],
				menuOptions: [],
				render: this.renderAgentPageTop,
				headerOrientation: HANDLE_HORIZONTAL,
				size: topSize
			},
			{
				name: '',
				handlePixels: 8,
				headerButtons: [],
				menuOptions: [],
				render: this.renderAgentPageBottom,
				headerOrientation: HANDLE_HORIZONTAL,
				size: bottomSize
			}
		];
	}
}

export default AgentLog;
