// frontend/src/alert_group/components/AlertGroupBasicSection.tsx
import React, {ChangeEvent, PureComponent} from 'react'
import _ from 'lodash'
import ReactTooltip from 'react-tooltip'
import {withTranslation, WithTranslation} from 'react-i18next'
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

interface AlertGroupBasicSectionProps extends WithTranslation {
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
    const recipientGroupIds = props.rule.recipientGroupIds || []

    this.state = {
      receiveMode: recipientGroupIds.length > 0 ? 'specific' : 'all',
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
      this.props.onUpdateRule({recipientGroupIds: []})
    }
  }

  private handleUserGroupDropdownChange = (selectedIDs: string[]): void => {
    this.props.onUpdateRule({recipientGroupIds: selectedIDs})
  }

  private getMatchedMembers(): UserGroupMember[] {
    const {rule} = this.props
    const {userGroups, receiveMode} = this.state
    const recipientGroupIds = rule.recipientGroupIds || []

    let matchedGroups: UserGroup[] = []

    if (receiveMode === 'all') {
      matchedGroups = userGroups
    } else {
      const selected = new Set(recipientGroupIds)
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
    const {t} = this.props

    if (userGroupsLoad === RemoteDataState.Loading) {
      return (
        <span className="alert-group-empty-text">
          {t('alert_group_basic.calculating_recipients')}
        </span>
      )
    }

    if (userGroupsLoad === RemoteDataState.Error) {
      return (
        <span className="alert-group-empty-text">
          {t('alert_group_basic.failed_to_load_groups')}
        </span>
      )
    }

    const matchedMembers = this.getMatchedMembers()

    if (matchedMembers.length === 0) {
      return (
        <span className="alert-group-empty-text">
          {receiveMode === 'all'
            ? t('alert_group_basic.no_receivable_groups')
            : t('alert_group_basic.no_selected_groups_or_members')}
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
              {m.email || '—'} ({t('group_management.email')}: {m.emailLevel})
            </span>
          </div>
        ))}
      </div>
    )
  }

  public render() {
    const {rule, kapacitors, onOpenTestModal, isTestingSend, t} = this.props
    const {receiveMode, userGroups} = this.state

    return (
      <div className="rule-section">
        <h3 className="rule-section--heading">
          {t('alert_group_basic.basic_info_receipt_settings')}
        </h3>
        <div className="rule-section--body">
          <div className="rule-section--row rule-section--row-first">
            <p>{t('alert_group_basic.enable_event')}</p>
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
                titleText={t('alert_group_basic.select_kapacitor')}
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
                {t('alert_group_basic.no_registered_kapacitor')}
              </span>
            )}
          </div>
          <div className="rule-section--row rule-section--row-receive-block rule-section--border-top">
            <div
              className="rule-section--row-handler-label"
              title={t('alert_group_basic.receipt_target')}
            >
              <span className={`icon ${IconFont.Group}`} aria-hidden />
              <p className="rule-section--row-handler-title">
                {t('alert_group_basic.receipt_of_this_rule')}
              </p>
            </div>
            <div className="alert-group-receive-panel-card">
              <div className="alert-group-receive-panel-card__fields">
                <div className="alert-group-receive-panel-card__field">
                  <span className="alert-group-receive-panel-card__label">
                    {t('alert_group_basic.receipt_mode')}
                  </span>
                  <div className="alert-group-receive-panel-card__control">
                    <Radio shape={ButtonShape.Default}>
                      <Radio.Button
                        id="receive-mode-all"
                        value="all"
                        active={receiveMode === 'all'}
                        onClick={this.handleReceiveModeChange}
                      >
                        {t('alert_group_basic.receive_all')}
                      </Radio.Button>
                      <Radio.Button
                        id="receive-mode-groups"
                        value="specific"
                        active={receiveMode === 'specific'}
                        onClick={this.handleReceiveModeChange}
                      >
                        {t('alert_group_basic.receive_specific_groups')}
                      </Radio.Button>
                    </Radio>
                  </div>
                </div>
                {receiveMode === 'specific' && (
                  <div className="alert-group-receive-panel-card__field">
                    <span className="alert-group-receive-panel-card__label">
                      {t('alert_group_basic.receipt_groups')}
                    </span>
                    <div className="alert-group-receive-panel-card__control">
                      {userGroups.length > 0 ? (
                        <MultiSelectDropdown
                          selectedIDs={rule.recipientGroupIds || []}
                          onChange={this.handleUserGroupDropdownChange}
                          buttonColor={ComponentColor.Default}
                          buttonSize={ComponentSize.Small}
                          menuColor={DropdownMenuColors.Onyx}
                          emptyText={t('alert_group_basic.select_group')}
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
                          {t('alert_group_basic.no_registered_receipt_groups')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="alert-group-receive-panel-card__preview">
                <div className="alert-group-receive-user-header">
                  <p className="alert-group-receive-user-title">
                    {t('alert_group_basic.receipt_users_preview')}
                    <span className="alert-group-receive-user-count">
                      ({this.getMatchedMembers().length})
                    </span>
                  </p>
                  <p className="alert-group-receive-user-hint">
                    {receiveMode === 'all'
                      ? t('alert_group_basic.all_groups_will_receive')
                      : t('alert_group_basic.selected_groups_will_receive')}
                  </p>
                </div>
                {this.renderMatchedUserPanel()}
              </div>
            </div>
          </div>

          <div className="rule-section--row rule-section--border-top">
            <div className="rule-section--row-label-wrap">
              <p className="rule-section--row-label">
                {t('alert_group_basic.alert_message')}
              </p>
            </div>
          </div>

          <div className="rule-section--row">
            <p>{t('alert_group_basic.message_body')}</p>
            <div className="rule-builder--message rule-builder--message-full">
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
            <p>{t('alert_group_basic.test_receipt')}</p>
            <div className="alert-group-test-send-block">
              <Button
                text={
                  isTestingSend
                    ? t('alert_group_basic.sending')
                    : t('alert_group_basic.test_receipt')
                }
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
                {t('alert_group_basic.test_receipt_hint')}
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default withTranslation()(AlertGroupBasicSectionView)
