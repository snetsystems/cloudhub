import React from 'react'
import {useTranslation} from 'react-i18next'
import {
  SlideToggle,
  Dropdown,
  ComponentColor,
  ComponentSize,
  IconFont,
} from 'src/reusable_ui'
import {DummyUser} from 'src/admin/containers/cloudhub/GroupDetailPage'
import ConfirmButton from 'src/shared/components/ConfirmButton'

const DropdownItem = Dropdown.Item

export interface LevelOption {
  id: string
  tKey: string
  defaultText: string
}

interface Props {
  users: DummyUser[]
  levelOptions: LevelOption[]
  onToggleAlert: (id: string) => void
  onLevelChange: (id: string, level: string) => void
  onRemoveUser: (id: string) => void
}

export default function GroupCardView({
  users,
  levelOptions,
  onToggleAlert,
  onLevelChange,
  onRemoveUser,
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
              {u.userName.substring(0, 2).toUpperCase()}
            </div>
            <div className="group-card-info">
              <div className="group-card-name">{u.userName}</div>
              <div className="group-card-email">{u.email}</div>
            </div>
            <div className="group-card-remove-action">
              <ConfirmButton
                icon={IconFont.UserRemove}
                square={true}
                confirmText={t('group_management.remove_confirm', '제외하기')}
                type="btn-danger"
                size="btn-xs"
                confirmAction={() => onRemoveUser(u.id)}
              />
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
