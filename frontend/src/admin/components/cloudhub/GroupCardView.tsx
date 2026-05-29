import React from 'react'
import {useTranslation} from 'react-i18next'
import {
  SlideToggle,
  Dropdown,
  ComponentColor,
  ComponentSize,
  IconFont,
  ComponentStatus,
} from 'src/reusable_ui'
import {RecipientMember} from 'src/types'
import ConfirmButton from 'src/shared/components/ConfirmButton'
import {Input, Button, ButtonShape} from 'src/reusable_ui'

const DropdownItem = Dropdown.Item

export interface LevelOption {
  id: string
  tKey: string
  defaultText: string
}

interface Props {
  isDefault?: boolean
  users: RecipientMember[]
  levelOptions: LevelOption[]
  onToggleAlert: (id: string) => void
  onLevelChange: (id: string, level: string) => void
  onRemoveUser: (id: string) => void
  onUserFieldChange?: (id: string, field: string, value: string) => void
  onSaveUser?: (id: string) => void
  onStartEdit?: (id: string) => void
  onCancelEdit?: (id: string) => void
}

export default function GroupCardView({
  isDefault = false,
  users,
  levelOptions,
  onToggleAlert,
  onLevelChange,
  onRemoveUser,
  onUserFieldChange,
  onSaveUser,
  onStartEdit,
  onCancelEdit,
}: Props) {
  const {t} = useTranslation()

  if (users.length === 0) {
    return (
      <div className="empty-card-view">
        {t('group_management.no_user_data', '등록된 사용자 정보가 없습니다.')}
      </div>
    )
  }

  return (
    <div className="card-view-wrapper">
      {users.map(u => (
        <div key={u.id} className="group-card">
          {/* Avatar and Info Header */}
          <div className="group-card-header">
            <div className="group-card-avatar">
              {u.userName ? u.userName.substring(0, 2).toUpperCase() : '?'}
            </div>
            <div className="group-card-info" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {u.isEditing ? (
                <>
                  <Input
                    value={u.userName}
                    onChange={e => onUserFieldChange && onUserFieldChange(u.id, 'userName', e.target.value)}
                    placeholder={t('group_management.enter_user_name', '사용자명 입력')}
                  />
                  <Input
                    value={u.email}
                    onChange={e => onUserFieldChange && onUserFieldChange(u.id, 'email', e.target.value)}
                    placeholder={t('group_management.enter_email', '이메일 입력')}
                    status={
                      u.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email.trim())
                        ? ComponentStatus.Error
                        : ComponentStatus.Default
                    }
                  />
                </>
              ) : (
                <>
                  <div className="group-card-name">{u.userName}</div>
                  <div className="group-card-email">{u.email}</div>
                </>
              )}
            </div>
            <div className="group-card-remove-action" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {u.isEditing ? (
                <>
                  <Button
                    icon={IconFont.Remove}
                    color={ComponentColor.Default}
                    size={ComponentSize.ExtraSmall}
                    shape={ButtonShape.Square}
                    onClick={() => {
                      if (u.isNew) {
                        onRemoveUser(u.id)
                      } else {
                        onCancelEdit && onCancelEdit(u.id)
                      }
                    }}
                  />
                  <Button
                    icon={IconFont.Checkmark}
                    color={ComponentColor.Success}
                    size={ComponentSize.ExtraSmall}
                    shape={ButtonShape.Square}
                    onClick={() => onSaveUser && onSaveUser(u.id)}
                  />
                </>
              ) : (
                <>
                  {u.isExternal && (
                    <Button
                      icon={IconFont.Pencil}
                      color={ComponentColor.Default}
                      size={ComponentSize.ExtraSmall}
                      shape={ButtonShape.Square}
                      onClick={() => onStartEdit && onStartEdit(u.id)}
                    />
                  )}
                  {(!isDefault || u.isExternal) && (
                    <ConfirmButton
                      icon={IconFont.UserRemove}
                      square={true}
                      confirmText={t('group_management.remove_confirm', '제외하기')}
                      type="btn-danger"
                      size="btn-xs"
                      confirmAction={() => onRemoveUser(u.id)}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Settings Rows */}
          <div className="group-card-settings">
            <div className="group-card-setting-row">
              <span className="group-card-setting-label">
                {t(
                  'group_management.email_notifications',
                  'Email Notifications'
                )}
              </span>
              <div>
                <SlideToggle
                  active={u.alertOn}
                  size={ComponentSize.ExtraSmall}
                  onChange={() => onToggleAlert(u.id)}
                />
              </div>
            </div>

            <div className="group-card-setting-row">
              <span className="group-card-setting-label">
                {t('group_management.alert_level', 'Alert Level')}
              </span>
              <Dropdown
                selectedID={u.level}
                onChange={v => onLevelChange(u.id, v)}
                buttonColor={ComponentColor.Default}
                buttonSize={ComponentSize.ExtraSmall}
              >
                {levelOptions.map(opt => (
                  <DropdownItem id={opt.id} key={opt.id} value={opt.id}>
                    {t(opt.tKey, opt.defaultText)}
                  </DropdownItem>
                ))}
              </Dropdown>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
