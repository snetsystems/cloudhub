import React, {useState, useMemo, useEffect} from 'react'
import {useTranslation} from 'react-i18next'
import {browserHistory} from 'react-router'
import {connect} from 'react-redux'
import {
  Page,
  Input,
  Button,
  SlideToggle,
  Dropdown,
  ComponentColor,
  ComponentSize,
  Radio,
  ButtonShape,
  IconFont,
  ComponentStatus,
} from 'src/reusable_ui'
import GroupCardView from 'src/admin/components/cloudhub/GroupCardView'
import UserSelectionOverlay from 'src/admin/components/cloudhub/UserSelectionOverlay'
import TableComponent from 'src/device_management/components/TableComponent'
import ConfirmButton from 'src/shared/components/ConfirmButton'
import PageSpinner from 'src/shared/components/PageSpinner'
import {ColumnInfo, User, RecipientMember} from 'src/types'
import {
  getRecipientGroup,
  createRecipientGroup,
  updateRecipientGroup,
  addRecipientGroupMember,
  updateRecipientGroupMember,
  deleteRecipientGroupMember,
  getAlertRecipientMemberPrefsByGroup,
  upsertAlertRecipientMemberPrefsByGroup,
} from 'src/alert_group/apis'
import {AlertRecipientMemberPrefs} from 'src/types'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {notifySuccess, notifyError} from 'src/shared/copy/notifications'

interface Props {
  params: {
    groupId?: string
  }
  notify: any
}

const DropdownItem = Dropdown.Item

export const LEVEL_OPTIONS = [
  {id: 'all', tKey: 'group_management.level_all', defaultText: '전체'},
  {id: 'warning', tKey: 'group_management.level_warning', defaultText: '경고'},
  {
    id: 'critical',
    tKey: 'group_management.level_critical',
    defaultText: '위험',
  },
]

function GroupDetailPage({params, notify}: Props) {
  const {t} = useTranslation()
  const groupId = params.groupId

  const [groupName, setGroupName] = useState('')

  const [isDefault, setIsDefault] = useState(false)

  const [viewMode, setViewMode] = useState<'card' | 'list'>('list')

  const [users, setUsers] = useState<RecipientMember[]>([])

  const [originalMembers, setOriginalMembers] = useState<any[]>([])

  const [isLoading, setIsLoading] = useState(true)

  const [isUserOverlayVisible, setIsUserOverlayVisible] = useState(false)

  const [groupNameError, setGroupNameError] = useState(false)

  useEffect(() => {
    const fetchGroupData = async () => {
      setIsLoading(true)
      try {
        if (groupId && groupId !== 'new') {
          const group = await getRecipientGroup(groupId)
          setGroupName(group.name || '')
          setIsDefault(group.isDefault || false)
          const members = group.members || []
          setOriginalMembers(members)

          const prefs = await getAlertRecipientMemberPrefsByGroup(groupId)
          const prefsMap = new Map(
            prefs.map(p => [p.recipientGroupMemberId, p])
          )

          const mappedUsers = members.map(m => {
            const p = prefsMap.get(m.id)
            return {
              id: m.id,
              userName: m.userName,
              email: m.email || '',
              alertOn: p ? p.emailEnabled : false,
              level: p ? p.emailLevel : 'all',
              isExternal: m.isExternal,
              originalPrefs: p,
            }
          })
          setUsers(mappedUsers)
        } else {
          setUsers([])
        }
      } catch (error) {
        console.error('Failed to fetch group details', error)
        notify(
          notifyError(
            t(
              'group_management.fetch_failed',
              '그룹 상세 정보를 불러오는데 실패했습니다.'
            )
          )
        )
      } finally {
        setIsLoading(false)
      }
    }

    fetchGroupData()
  }, [groupId])

  const handleLevelChange = (userId, newLevel) => {
    setUsers(users.map(u => (u.id === userId ? {...u, level: newLevel} : u)))
  }

  const handleToggleAlert = userId => {
    setUsers(
      users.map(u => (u.id === userId ? {...u, alertOn: !u.alertOn} : u))
    )
  }

  const handleRemoveUser = (userId: string) => {
    setUsers(users.filter(u => u.id !== userId))
  }

  const handleUserFieldChange = (
    userId: string,
    field: string,
    value: string
  ) => {
    setUsers(users.map(u => (u.id === userId ? {...u, [field]: value} : u)))
  }

  const handleStartEditUser = (userId: string) => {
    setUsers(
      users.map(u =>
        u.id === userId
          ? {
              ...u,
              isEditing: true,
            }
          : u
      )
    )
  }

  const handleCancelEditUser = (userId: string) => {
    const orig = originalMembers.find(m => m.id === userId)
    setUsers(
      users.map(u => {
        if (u.id === userId) {
          return {
            ...u,
            userName: orig ? orig.userName : u.userName,
            email: orig ? orig.email : u.email,
            isEditing: false,
          }
        }
        return u
      })
    )
  }

  const handleSaveExternalUser = (userId: string) => {
    const user = users.find(u => u.id === userId)
    if (!user?.userName.trim() || !user?.email.trim()) {
      notify(
        notifyError(
          t(
            'group_management.enter_all_fields',
            '사용자명과 이메일을 모두 입력해주세요.'
          )
        )
      )
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(user.email.trim())) {
      notify(
        notifyError(
          t(
            'group_management.invalid_email_format',
            '올바른 이메일 형식이 아닙니다.'
          )
        )
      )
      return
    }

    const enteredEmail = user.email.trim().toLowerCase()
    const isEmailDuplicate = users.some(
      u => u.id !== userId && u.email.trim().toLowerCase() === enteredEmail
    )
    if (isEmailDuplicate) {
      notify(
        notifyError(
          t(
            'group_management.duplicate_email',
            '이미 등록된 이메일 주소입니다.'
          )
        )
      )
      return
    }

    setUsers(
      users.map(u =>
        u.id === userId
          ? {
              ...u,
              isEditing: false,
              isNew: true,
            }
          : u
      )
    )
  }

  const columns: ColumnInfo[] = useMemo(
    () => [
      {
        name: t('group_management.alert', '알림'),
        key: 'alertOn',
        options: {
          thead: {
            style: {width: '5%'},
          },
        },
        render: (_val, row) => (
          <SlideToggle
            active={row.alertOn}
            size={ComponentSize.ExtraSmall}
            onChange={() => handleToggleAlert(row.id)}
          />
        ),
      },
      {
        name: t('group_management.user_name', '사용자명'),
        key: 'userName',
        options: {
          thead: {
            style: {width: '35%'},
          },
        },
        render: (_val, row) =>
          row.isEditing ? (
            <div className="table-input-wrapper">
              <Input
                value={row.userName}
                onChange={e =>
                  handleUserFieldChange(row.id, 'userName', e.target.value)
                }
                placeholder={t(
                  'group_management.enter_user_name',
                  '사용자명 입력'
                )}
                size={ComponentSize.Small}
              />
            </div>
          ) : (
            row.userName
          ),
      },
      {
        name: t('group_management.email_option', '이메일'),
        key: 'email',
        options: {
          thead: {
            style: {width: '40%'},
          },
        },
        render: (_val, row) =>
          row.isEditing ? (
            <div className="table-input-wrapper">
              <Input
                value={row.email}
                onChange={e =>
                  handleUserFieldChange(row.id, 'email', e.target.value)
                }
                placeholder={t('group_management.enter_email', '이메일 입력')}
                size={ComponentSize.Small}
                status={
                  row.email.trim() &&
                  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())
                    ? ComponentStatus.Error
                    : ComponentStatus.Default
                }
              />
            </div>
          ) : (
            row.email
          ),
      },
      {
        name: t('group_management.alert_level', '알림 레벨'),
        key: 'level',
        options: {
          thead: {
            style: {width: '10%'},
          },
        },
        render: (_val, row) => (
          <Dropdown
            selectedID={row.level}
            onChange={v => handleLevelChange(row.id, v)}
            buttonColor={ComponentColor.Default}
            buttonSize={ComponentSize.ExtraSmall}
          >
            {LEVEL_OPTIONS.map(opt => (
              <DropdownItem id={opt.id} key={opt.id} value={opt.id}>
                {t(opt.tKey, opt.defaultText)}
              </DropdownItem>
            ))}
          </Dropdown>
        ),
      },
      {
        name: '',
        key: 'actions',
        options: {
          thead: {
            style: {width: '10%'},
          },
        },
        render: (_val, row) =>
          row.isEditing ? (
            <div className="list-view-edit-action">
              <Button
                icon={IconFont.Remove}
                color={ComponentColor.Default}
                size={ComponentSize.ExtraSmall}
                shape={ButtonShape.Square}
                onClick={() =>
                  row.isNew
                    ? handleRemoveUser(row.id)
                    : handleCancelEditUser(row.id)
                }
              />
              <Button
                icon={IconFont.Checkmark}
                color={ComponentColor.Success}
                size={ComponentSize.ExtraSmall}
                shape={ButtonShape.Square}
                onClick={() => handleSaveExternalUser(row.id)}
              />
            </div>
          ) : (
            <div className="list-view-remove-action">
              {row.isExternal && (
                <Button
                  icon={IconFont.Pencil}
                  color={ComponentColor.Default}
                  size={ComponentSize.ExtraSmall}
                  shape={ButtonShape.Square}
                  onClick={() => handleStartEditUser(row.id)}
                />
              )}
              {(!isDefault || row.isExternal) && (
                <ConfirmButton
                  icon={IconFont.UserRemove}
                  square={true}
                  confirmText={t('group_management.remove_confirm', '제외하기')}
                  type="btn-danger"
                  size="btn-xs"
                  confirmAction={() => handleRemoveUser(row.id)}
                />
              )}
            </div>
          ),
      },
    ],
    [users, t]
  )

  const viewModeRadio = (
    <Radio shape={ButtonShape.Default}>
      <Radio.Button
        id="group-view-mode-list"
        titleText={t('group_management.list_view', 'List View')}
        value="list"
        active={viewMode === 'list'}
        onClick={() => setViewMode('list')}
      >
        {t('group_management.list_view', 'List View')}
      </Radio.Button>
      <Radio.Button
        id="group-view-mode-card"
        titleText={t('group_management.card_view', 'Card View')}
        value="card"
        active={viewMode === 'card'}
        onClick={() => setViewMode('card')}
      >
        {t('group_management.card_view', 'Card View')}
      </Radio.Button>
    </Radio>
  )

  if (isLoading) {
    return <PageSpinner />
  }

  const handleAddExternalUser = () => {
    const hasEmptyExternalUser = users.some(
      u => u.isExternal && u.isEditing && !u.userName.trim() && !u.email.trim()
    )
    if (hasEmptyExternalUser) {
      notify(
        notifyError(
          t(
            'group_management.fill_existing_external_user',
            '이미 추가 중인 외부 사용자가 있습니다. 먼저 정보를 입력해주세요.'
          )
        )
      )
      return
    }

    const newExternalUser: RecipientMember = {
      id: `ext_${Date.now()}`,
      userName: '',
      email: '',
      alertOn: true,
      level: 'all',
      isNew: true,
      isExternal: true,
      isEditing: true,
    }
    setUsers([newExternalUser, ...users])
  }

  const actionButtons = (
    <>
      <Button
        text={t('group_management.add_external_user', '외부 사용자 추가')}
        icon={IconFont.Plus}
        color={ComponentColor.Default}
        size={ComponentSize.Small}
        onClick={handleAddExternalUser}
      />
      <Button
        text={t('group_management.add_user', '사용자 추가')}
        icon={IconFont.Plus}
        color={ComponentColor.Primary}
        size={ComponentSize.Small}
        onClick={() => setIsUserOverlayVisible(true)}
      />
    </>
  )

  const handleConfirmUserSelection = (selectedUsers: User[]) => {
    const usersWithEmail = selectedUsers.filter(u => (u as any).email)
    const usersWithoutEmail = selectedUsers.filter(u => !(u as any).email)

    if (usersWithoutEmail.length > 0) {
      notify(
        notifyError(
          t(
            'group_management.user_email_missing',
            '이메일은 필수 값입니다. 사용자 관리 화면에서 이메일을 입력해 주세요.'
          )
        )
      )
    }

    if (usersWithEmail.length === 0) {
      setIsUserOverlayVisible(false)
      return
    }

    const newDummyUsers = usersWithEmail.map(u => ({
      id: u.id,
      userId: u.id,
      userName: u.name,
      email: (u as any).email || '',
      alertOn: true,
      level: 'all',
      isNew: true,
    }))
    setUsers(prev => [...prev, ...newDummyUsers])
    setIsUserOverlayVisible(false)
  }

  const handleSave = async () => {
    if (!groupName.trim()) {
      setGroupNameError(true)
      return
    }
    setIsLoading(true)
    try {
      let currentGroupId = groupId
      if (!currentGroupId || currentGroupId === 'new') {
        const newGroup = await createRecipientGroup(groupName)
        currentGroupId = newGroup.id
      } else {
        await updateRecipientGroup(currentGroupId, groupName)
      }

      if (groupId && groupId !== 'new') {
        const currentUserIds = new Set(
          users.filter(u => !u.isNew).map(u => u.id)
        )
        const removedMembers = originalMembers.filter(
          m => !currentUserIds.has(m.id)
        )
        await Promise.all(
          removedMembers.map(m =>
            deleteRecipientGroupMember(currentGroupId, m.id)
          )
        )
      }

      const finalPrefs: AlertRecipientMemberPrefs[] = []

      for (const u of users) {
        if (u.isEditing) {
          continue
        }
        let memberId = u.id
        if (u.isNew) {
          const newMember = await addRecipientGroupMember(
            currentGroupId,
            {
              userId: u.userId || u.id,
              userName: u.userName,
              email: u.email,
              phoneNumber: '',
              isExternal: !!u.isExternal,
            }
          )
          memberId = newMember.id
        } else {
          const orig = originalMembers.find(m => m.id === u.id)
          const nameChanged = orig && orig.userName !== u.userName
          const emailChanged = orig && orig.email !== u.email
          if (nameChanged || emailChanged) {
            await updateRecipientGroupMember(currentGroupId, u.id, {
              userName: u.userName,
              email: u.email,
            })
          }
        }

        finalPrefs.push({
          ...(u.originalPrefs || {
            smsEnabled: false,
            smsLevel: 'all',
            notifyWeekdays: '1,2,3,4,5,6,7',
            notifyStartHm: '00:00',
            notifyEndHm: '23:59',
            escalationSeconds: 0,
            recipientGroupMemberId: '',
          }),
          recipientGroupMemberId: memberId,
          emailEnabled: u.alertOn,
          emailLevel: u.level,
        })
      }

      await upsertAlertRecipientMemberPrefsByGroup(
        currentGroupId,
        finalPrefs
      )

      notify(
        notifySuccess(
          t(
            'group_management.save_success',
            '그룹 설정을 저장했습니다.'
          )
        )
      )
      browserHistory.goBack()
    } catch (error) {
      console.error('Failed to save group details', error)
      notify(
        notifyError(
          t(
            'group_management.save_failed',
            '그룹 설정 저장에 실패했습니다.'
          )
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Title
            title={
              !groupId || groupId === 'new'
                ? t('group_management.add_new_group', '새 그룹 추가')
                : t('group_management.edit_group_settings', '그룹 설정 수정')
            }
          />
        </Page.Header.Left>
        <Page.Header.Right>
          <Button
            text={t('button.cancel', '취소')}
            color={ComponentColor.Default}
            size={ComponentSize.Small}
            onClick={() => browserHistory.goBack()}
          />
          <Button
            text={t('button.save', '저장')}
            color={ComponentColor.Primary}
            size={ComponentSize.Small}
            onClick={handleSave}
          />
        </Page.Header.Right>
      </Page.Header>
      <Page.Contents fullWidth={true}>
        <div className="group-detail-page">
          <div className="panel panel-solid">
            <div className="panel-heading">
              <div className="table-top left">
                <h2 className="panel-title">
                  {t('group_management.basic_info_policy', '기본 정보 및 정책')}
                </h2>
              </div>
              <div className="table-top right"></div>
            </div>
            <div className="panel-body">
              <div className="input-group">
                <label>
                  {t('group_management.target_group_name', '대상 그룹명')}
                  <span className="required-asterisk">*</span>
                </label>
                <div className="input-wrapper">
                  <Input
                    value={groupName}
                    onChange={e => {
                      setGroupName(e.target.value)
                      if (e.target.value.trim()) {
                        setGroupNameError(false)
                      }
                    }}
                    status={
                      groupNameError
                        ? ComponentStatus.Error
                        : ComponentStatus.Default
                    }
                    placeholder={t(
                      'group_management.enter_group_name',
                      '그룹명을 입력하세요'
                    )}
                  />
                  {groupNameError && (
                    <span className="input-error-msg">
                      {t(
                        'group_management.group_name_required',
                        '반드시 입력해야 합니다.'
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {viewMode === 'list' ? (
            <TableComponent
              tableTitle={t(
                'group_management.user_receipt_settings',
                '사용자별 수신 상세설정'
              )}
              topLeftRender={viewModeRadio}
              toprightRender={
                <div className="action-buttons-wrapper">{actionButtons}</div>
              }
              columns={columns}
              data={users}
              isSearchDisplay={false}
              isMultiSelect={false}
              options={{
                tbodyRow: {
                  className: 'group-detail-table-row',
                },
              }}
            />
          ) : (
            <div className="panel panel-solid">
              <div className="panel-heading">
                <div className="table-top left">
                  <h2 className="panel-title">
                    {t(
                      'group_management.user_receipt_settings',
                      '사용자별 수신 상세설정'
                    )}
                  </h2>
                  {viewModeRadio}
                </div>
                <div className="table-top right table-top-right-wrapper">
                  {actionButtons}
                </div>
              </div>
              <div className="panel-body card-view-body">
                <GroupCardView
                  isDefault={isDefault}
                  users={users}
                  levelOptions={LEVEL_OPTIONS}
                  onToggleAlert={handleToggleAlert}
                  onLevelChange={handleLevelChange}
                  onRemoveUser={handleRemoveUser}
                  onUserFieldChange={handleUserFieldChange}
                  onSaveUser={handleSaveExternalUser}
                  onStartEdit={handleStartEditUser}
                  onCancelEdit={handleCancelEditUser}
                />
              </div>
            </div>
          )}
        </div>
      </Page.Contents>
      <UserSelectionOverlay
        visible={isUserOverlayVisible}
        onDismiss={() => setIsUserOverlayVisible(false)}
        onConfirm={handleConfirmUserSelection}
        alreadyAddedUserIds={users.map(u => u.id)}
      />
    </Page>
  )
}

const mapDispatchToProps = {
  notify: notifyAction,
}

export default connect(null, mapDispatchToProps)(GroupDetailPage)
