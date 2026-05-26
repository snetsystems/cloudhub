import React, {PureComponent} from 'react'
import {
  ButtonShape,
  ComponentColor,
  ComponentSize,
  SlideToggle,
  Dropdown,
  DropdownMode,
  DropdownMenuColors,
  Radio,
} from 'src/reusable_ui'
import {UserGroupMember} from 'src/alert_group/types'

interface Props {
  members: UserGroupMember[]
  systemUsers: any[]
  onUpdateMember: (userId: string, userName: string, patch: any) => void
}

interface State {
  viewMode: 'grid' | 'list'
}

const RECEIVE_LEVELS = [
  {text: '전체 (Info, Warning, Critical)', value: 'all'},
  {text: 'Warning 이상', value: 'warning'},
  {text: 'Critical 환경만', value: 'critical'},
]

class UserGroupMemberSettings extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {viewMode: 'grid'}
  }

  private handleToggleEmail = (u: any, member: any) => {
    const enabled = member ? !member.emailEnabled : true
    this.props.onUpdateMember(u.id, u.name, {emailEnabled: enabled, email: u.email})
  }

  private handleEmailLevel = (u: any, level: string) => {
    this.props.onUpdateMember(u.id, u.name, {emailLevel: level, email: u.email})
  }

  private renderGrid = () => {
    const {systemUsers, members} = this.props
    return (
      <div className="user-group-member-grid">
        {systemUsers.map(u => {
          const member = members.find(m => m.userId === u.id) || {
            emailEnabled: false,
            emailLevel: 'all',
          }
          const initials = u.name.substring(0, 2).toUpperCase()
          
          return (
            <div key={u.id} className="member-grid-card">
              <div className="member-card-header">
                <div className="member-avatar">{initials}</div>
                <div className="member-name-wrap">
                  <h4>{u.name}</h4>
                  <div className="member-card-email">{u.email || 'No Email'}</div>
                </div>
              </div>
              
              <div className="member-channel-row">
                <span className="channel-label">Email Notifications</span>
                <div className="member-channel-controls">
                   <SlideToggle
                    active={member.emailEnabled}
                    onChange={() => this.handleToggleEmail(u, member)}
                    size={ComponentSize.ExtraSmall}
                    color={ComponentColor.Primary}
                  />
                  <Dropdown
                    selectedID={member.emailLevel}
                    onChange={(item) => this.handleEmailLevel(u, item.value)}
                    buttonColor={ComponentColor.Default}
                    buttonSize={ComponentSize.ExtraSmall}
                    menuColor={DropdownMenuColors.Onyx}
                    mode={DropdownMode.ActionList}
                    titleText="Level"
                  >
                    {RECEIVE_LEVELS.map(l => (
                      <Dropdown.Item key={l.value} id={l.value} value={l}>
                        {l.text}
                      </Dropdown.Item>
                    ))}
                  </Dropdown>
                </div>
              </div>
              
              <div className="member-channel-row member-channel-row--disabled">
                <span className="channel-label">SMS (Mockup)</span>
                <SlideToggle
                  active={false}
                  onChange={() => {}}
                  size={ComponentSize.ExtraSmall}
                  color={ComponentColor.Secondary}
                  disabled={true}
                />
              </div>

              <div className="member-card-tags">
                 <span className="label label--default member-card-tag--small">#TeamA</span>
                 <span className="label label--default member-card-tag--small">#VIP</span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  private renderList = () => {
    const {systemUsers, members} = this.props
    return (
      <div className="user-group-member-list">
        {systemUsers.map(u => {
          const member = members.find(m => m.userId === u.id) || {
            emailEnabled: false,
            emailLevel: 'all',
          }
          const initials = u.name.substring(0, 2).toUpperCase()
          
          return (
            <div key={u.id} className="member-list-card">
              <div className="member-avatar">{initials}</div>
              <div className="member-list-info">
                <div className="member-list-name">{u.name}</div>
                <div className="member-card-email">{u.email || 'No Email'}</div>
              </div>
              <div className="member-list-channels">
                <div className="member-channel-controls">
                  <span className="member-list-channel-label">Email</span>
                  <SlideToggle
                    active={member.emailEnabled}
                    onChange={() => this.handleToggleEmail(u, member)}
                    size={ComponentSize.ExtraSmall}
                    color={ComponentColor.Primary}
                  />
                  <Dropdown
                    selectedID={member.emailLevel}
                    onChange={(item) => this.handleEmailLevel(u, item.value)}
                    buttonColor={ComponentColor.Default}
                    buttonSize={ComponentSize.ExtraSmall}
                    menuColor={DropdownMenuColors.Onyx}
                    mode={DropdownMode.ActionList}
                  >
                    {RECEIVE_LEVELS.map(l => (
                      <Dropdown.Item key={l.value} id={l.value} value={l}>
                        {l.text}
                      </Dropdown.Item>
                    ))}
                  </Dropdown>
                </div>
                <div className="member-channel-controls--disabled">
                   <span className="member-list-channel-label-sms">SMS</span>
                   <SlideToggle active={false} onChange={()=>{}} size={ComponentSize.ExtraSmall} disabled={true} />
                </div>
              </div>
              <div className="member-list-actions">
                 <span className="label label--default">#TeamA</span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  public render() {
    const {viewMode} = this.state
    
    return (
      <div className="user-group-member-settings-container">
        <div className="user-group-view-toggle">
          <Radio shape={ButtonShape.Default}>
            <Radio.Button
              id="view-mode-grid"
              value="grid"
              active={viewMode === 'grid'}
              onClick={(v) => this.setState({viewMode: v as any})}
            >
              Grid View
            </Radio.Button>
            <Radio.Button
              id="view-mode-list"
              value="list"
              active={viewMode === 'list'}
              onClick={(v) => this.setState({viewMode: v as any})}
            >
              List View
            </Radio.Button>
          </Radio>
        </div>
        
        {viewMode === 'grid' ? this.renderGrid() : this.renderList()}
      </div>
    )
  }
}

export default UserGroupMemberSettings
