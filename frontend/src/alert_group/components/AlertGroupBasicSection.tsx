// frontend/src/alert_group/components/AlertGroupBasicSection.tsx
import React, {ChangeEvent, PureComponent} from 'react'
import _ from 'lodash'
import ReactTooltip from 'react-tooltip'
import {
  Radio,
  Button,
  ButtonShape,
  ComponentColor,
  ComponentSize,
  ComponentStatus,
  MultiSelectDropdown,
  DropdownMode,
  DropdownMenuColors,
  SlideToggle,
  Dropdown,
  IconFont,
} from 'src/reusable_ui'
import CodeData from 'src/kapacitor/components/CodeData'
import {RULE_MESSAGE_TEMPLATES} from 'src/kapacitor/constants'
import {RemoteDataState} from 'src/types'
import {
  AlertGroupRule,
  AlertKapacitor,
  UserGroup,
  UserGroupMember,
} from 'src/alert_group/types'
import {getUserGroups} from 'src/alert_group/apis'

interface AlertGroupBasicSectionProps {
  rule: AlertGroupRule
  kapacitors: AlertKapacitor[]
  organizationId: string
  me: any
  onUpdateRule: (patch: Partial<AlertGroupRule>) => void
  onOpenTestModal: () => void
  isTestingSend: boolean
}

interface AlertGroupBasicSectionState {
  receiveMode: 'all' | 'specific'
  userGroups: UserGroup[]
  userGroupsLoad: RemoteDataState
}

class AlertGroupBasicSectionView extends PureComponent<
  AlertGroupBasicSectionProps,
  AlertGroupBasicSectionState
> {
  constructor(props: AlertGroupBasicSectionProps) {
    super(props)
    const userGroupIds = props.rule.userGroupIds || []

    this.state = {
      receiveMode: userGroupIds.length > 0 ? 'specific' : 'all',
      userGroups: [],
      userGroupsLoad: RemoteDataState.NotStarted,
    }
  }

  public componentDidMount(): void {
    this.loadUserGroups()
  }

  private loadUserGroups = async (): Promise<void> => {
    this.setState({userGroupsLoad: RemoteDataState.Loading})
    try {
      const userGroups = await getUserGroups()
      this.setState({userGroups, userGroupsLoad: RemoteDataState.Done})
    } catch {
      this.setState({userGroupsLoad: RemoteDataState.Error})
    }
  }

  private handleToggleActive = (): void => {
    this.props.onUpdateRule({active: !this.props.rule.active})
  }

  private handleKapacitorChange = (item: AlertKapacitor): void => {
    this.props.onUpdateRule({kapacitorId: item.id})
  }

  private handleMessageChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    this.props.onUpdateRule({message: e.target.value})
  }

  private handleClickMessageTemplate = (template: string) => (): void => {
    const currentMessage = this.props.rule.message || ''
    const nextMessage = currentMessage
      ? `${currentMessage} ${template}`
      : template
    this.props.onUpdateRule({message: nextMessage})
  }

  private handleReceiveModeChange = (mode: 'all' | 'specific'): void => {
    this.setState({receiveMode: mode})
    if (mode === 'all') {
      this.props.onUpdateRule({userGroupIds: []})
    }
  }

  private handleUserGroupDropdownChange = (selectedIDs: string[]): void => {
    this.props.onUpdateRule({userGroupIds: selectedIDs})
  }

  private getMatchedMembers(): UserGroupMember[] {
    const {rule} = this.props
    const {userGroups, receiveMode} = this.state
    const userGroupIds = rule.userGroupIds || []

    let matchedGroups: UserGroup[] = []

    if (receiveMode === 'all') {
      matchedGroups = userGroups
    } else {
      const selected = new Set(userGroupIds)
      matchedGroups = userGroups.filter(ug => ug.id && selected.has(ug.id))
    }

    const members: UserGroupMember[] = []
    matchedGroups.forEach(ug => {
      if (ug.members) {
        members.push(...ug.members)
      }
    })

    // Remove duplicates based on user ID
    return _.uniqBy(members, 'userId')
  }

  private renderMatchedUserPanel(): JSX.Element {
    const {userGroupsLoad, receiveMode} = this.state

    if (userGroupsLoad === RemoteDataState.Loading) {
      return (
        <span className="alert-group-empty-text">
          수신자 목록을 계산하는 중…
        </span>
      )
    }

    if (userGroupsLoad === RemoteDataState.Error) {
      return (
        <span className="alert-group-empty-text">
          대상 그룹 정보를 불러오지 못했습니다.
        </span>
      )
    }

    const matchedMembers = this.getMatchedMembers()

    if (matchedMembers.length === 0) {
      return (
        <span className="alert-group-empty-text">
          {receiveMode === 'all'
            ? '수신 가능한 대상 그룹이 없습니다.'
            : '선택한 수신 그룹이 없거나 멤버가 없습니다.'}
        </span>
      )
    }

    return (
      <div className="alert-group-receive-user-list">
        {matchedMembers.map(m => (
          <div key={m.userId} className="alert-group-receive-user-list--row">
            <span className="alert-group-receive-user-list--name">
              {m.userName}
            </span>
            <span className="alert-group-receive-user-list--email">
              {m.email || '—'} (이메일: {m.emailLevel})
            </span>
          </div>
        ))}
      </div>
    )
  }

  public render() {
    const {rule, kapacitors, onOpenTestModal, isTestingSend} = this.props
    const {receiveMode, userGroups} = this.state

    return (
      <div className="rule-section">
        <h3 className="rule-section--heading">③ 기본 정보 및 수신 설정</h3>
        <div className="rule-section--body">
          <div className="rule-section--row rule-section--row-first">
            <p>이벤트 활성화</p>
            <SlideToggle
              active={rule.active}
              onChange={this.handleToggleActive}
              size={ComponentSize.ExtraSmall}
              color={ComponentColor.Primary}
            />
          </div>

          <div className="rule-section--row">
            <p>Kapacitor</p>
            {kapacitors.length > 0 ? (
              <Dropdown
                selectedID={rule.kapacitorId || ''}
                onChange={this.handleKapacitorChange}
                buttonColor={ComponentColor.Default}
                buttonSize={ComponentSize.Small}
                menuColor={DropdownMenuColors.Onyx}
                titleText="Kapacitor 선택"
                mode={DropdownMode.ActionList}
              >
                {kapacitors.map(k => (
                  <Dropdown.Item key={k.id} id={k.id} value={k}>
                    {`${k.name} @ ${k.url}`}
                  </Dropdown.Item>
                ))}
              </Dropdown>
            ) : (
              <span className="alert-group-empty-text">
                등록된 Alert Kapacitor가 없습니다.
              </span>
            )}
          </div>

          <div className="rule-section--row rule-section--row-receive-block rule-section--border-top">
            <div className="rule-section--row-handler-label" title="수신 대상">
              <span className={`icon ${IconFont.Group}`} aria-hidden />
              <p className="rule-section--row-handler-title">이 규칙의 수신</p>
            </div>
            <div className="alert-group-receive-panel-card">
              <div className="alert-group-receive-panel-card__fields">
                <div className="alert-group-receive-panel-card__field">
                  <span className="alert-group-receive-panel-card__label">
                    수신 방식
                  </span>
                  <div className="alert-group-receive-panel-card__control">
                    <Radio shape={ButtonShape.Default}>
                      <Radio.Button
                        id="receive-mode-all"
                        value="all"
                        active={receiveMode === 'all'}
                        onClick={this.handleReceiveModeChange}
                      >
                        전체 수신
                      </Radio.Button>
                      <Radio.Button
                        id="receive-mode-groups"
                        value="specific"
                        active={receiveMode === 'specific'}
                        onClick={this.handleReceiveModeChange}
                      >
                        그룹 선택 수신
                      </Radio.Button>
                    </Radio>
                  </div>
                </div>
                {receiveMode === 'specific' && (
                  <div className="alert-group-receive-panel-card__field">
                    <span className="alert-group-receive-panel-card__label">
                      수신 그룹
                    </span>
                    <div className="alert-group-receive-panel-card__control">
                      {userGroups.length > 0 ? (
                        <MultiSelectDropdown
                          selectedIDs={rule.userGroupIds || []}
                          onChange={this.handleUserGroupDropdownChange}
                          buttonColor={ComponentColor.Default}
                          buttonSize={ComponentSize.Small}
                          menuColor={DropdownMenuColors.Onyx}
                          emptyText="그룹 선택"
                        >
                          {userGroups.map(ug => (
                            <MultiSelectDropdown.Item
                              key={ug.id!}
                              id={ug.id!}
                              value={ug}
                            >
                              {ug.name}
                            </MultiSelectDropdown.Item>
                          ))}
                        </MultiSelectDropdown>
                      ) : (
                        <div className="alert-group-tags-empty-hint">
                          등록된 수신 그룹이 없습니다. 먼저 수신 그룹을
                          생성해주세요.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="alert-group-receive-panel-card__preview">
                <div className="alert-group-receive-user-header">
                  <p className="alert-group-receive-user-title">
                    수신 사용자 미리보기
                    <span className="alert-group-receive-user-count">
                      ({this.getMatchedMembers().length})
                    </span>
                  </p>
                  <p className="alert-group-receive-user-hint">
                    {receiveMode === 'all'
                      ? '모든 대상 그룹이 알림을 받게 됩니다.'
                      : '선택한 수신 그룹의 멤버에게 알림이 전달됩니다.'}
                  </p>
                </div>
                {this.renderMatchedUserPanel()}
              </div>
            </div>
          </div>

          <div className="rule-section--row rule-section--border-top">
            <div className="rule-section--row-label-wrap">
              <p className="rule-section--row-label">알림 메시지</p>
            </div>
          </div>

          <div className="rule-section--row">
            <p>메시지 본문</p>
            <div className="rule-builder--message" style={{width: '100%'}}>
              <textarea
                value={rule.message || ''}
                onChange={this.handleMessageChange}
                spellCheck={false}
                className="form-control input-sm monotype"
                placeholder='Example: {{ .ID }} is {{ .Level }} value: {{ index .Fields "value" }}'
              />
            </div>
          </div>
          <div className="rule-section--row rule-section--row-last">
            <p>Templates:</p>
            {_.map(RULE_MESSAGE_TEMPLATES, (template, key) => {
              return (
                <CodeData
                  key={key}
                  template={template}
                  onClickTemplate={this.handleClickMessageTemplate(
                    template.label
                  )}
                />
              )
            })}
            <ReactTooltip
              effect="solid"
              html={true}
              class="influx-tooltip kapacitor-tooltip"
            />
          </div>

          <div className="rule-section--row rule-section--row-test-send">
            <p>수신 테스트</p>
            <div className="alert-group-test-send-block">
              <Button
                text={isTestingSend ? '발송 중...' : '수신 테스트'}
                icon={IconFont.Bell}
                onClick={onOpenTestModal}
                color={ComponentColor.Success}
                size={ComponentSize.Small}
                status={
                  !rule.kapacitorId || isTestingSend
                    ? ComponentStatus.Disabled
                    : ComponentStatus.Default
                }
              />
              <span className="alert-group-test-send-block__hint">
                수신 테스트를 누르면 팝업에서 테스트 제목/메시지와 수신 대상을
                입력해 발송 여부를 확인할 수 있습니다.
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default AlertGroupBasicSectionView
