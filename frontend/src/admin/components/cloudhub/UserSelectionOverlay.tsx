import React, {useMemo, useState, useEffect} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {useTranslation} from 'react-i18next'
import {
  OverlayTechnology,
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
  Button,
  ComponentColor,
  ComponentSize,
  ComponentStatus,
} from 'src/reusable_ui'
import TableComponent from 'src/device_management/components/TableComponent'
import * as adminCloudHubActionCreators from 'src/admin/actions/cloudhub'
import {User, Organization, Links, ColumnInfo} from 'src/types'

interface Props {
  visible: boolean
  onDismiss: () => void
  onConfirm: (users: User[]) => void
  alreadyAddedUserIds: string[]

  // From Redux
  users: User[]
  currentOrganization?: Organization
  links: Links
  actionsAdmin: {
    loadUsersAsync: (link: string) => void
  }
}

function UserSelectionOverlay({
  visible,
  onDismiss,
  onConfirm,
  alreadyAddedUserIds,
  users,
  currentOrganization,
  links,
  actionsAdmin,
}: Props) {
  const {t} = useTranslation()
  const [checkedArray, setCheckedArray] = useState<string[]>([])

  useEffect(() => {
    if (visible && users.length === 0 && links.users) {
      actionsAdmin.loadUsersAsync(links.users)
    }
  }, [visible, users.length, links.users, actionsAdmin])

  useEffect(() => {
    if (!visible) {
      setCheckedArray([])
    }
  }, [visible])

  const availableUsers = useMemo(() => {
    if (!currentOrganization) return []
    return users.filter(user => {
      // Check if user is in current org
      const inOrg = user.roles?.some(
        role => role.organization === currentOrganization.id
      )
      if (!inOrg) return false
      // Check if user is already added
      return !alreadyAddedUserIds.includes(user.id)
    })
  }, [users, currentOrganization, alreadyAddedUserIds])

  const columns: ColumnInfo[] = useMemo(
    () => [
      {
        name: '',
        key: 'id',
        options: {
          checkbox: true,
          thead: {
            style: {width: '10%'},
          },
        },
      },
      {
        name: t('group_management.user_name', 'Username'),
        key: 'name',
      },
      {
        name: t('group_management.email', 'Email'),
        key: 'email',
      },
    ],
    [t]
  )

  const handleConfirm = () => {
    const selectedUsers = availableUsers.filter(u =>
      checkedArray.includes(u.id)
    )
    onConfirm(selectedUsers)
  }

  return (
    <OverlayTechnology visible={visible}>
      <OverlayContainer maxWidth={600}>
        <OverlayHeading
          title={t('group_management.add_user', '사용자 추가')}
          onDismiss={onDismiss}
        />
        <OverlayBody>
          <TableComponent
            data={availableUsers}
            columns={columns}
            checkedArray={checkedArray}
            setCheckedArray={setCheckedArray}
            isMultiSelect={true}
            isSearchDisplay={true}
            searchPlaceholder={t(
              'group_management.search_user',
              '사용자 검색...'
            )}
            options={{
              noDataMessage: t(
                'group_management.no_user_to_add',
                '추가할 사용자가 없습니다.'
              ),
            }}
          />
          <div className="user-selection-overlay-footer">
            <Button
              text={t('button.cancel', '취소')}
              color={ComponentColor.Default}
              size={ComponentSize.Small}
              onClick={onDismiss}
            />
            <Button
              text={t('button.add', '추가')}
              color={ComponentColor.Primary}
              size={ComponentSize.Small}
              onClick={handleConfirm}
              status={
                checkedArray.length === 0
                  ? ComponentStatus.Disabled
                  : ComponentStatus.Default
              }
            />
          </div>
        </OverlayBody>
      </OverlayContainer>
    </OverlayTechnology>
  )
}

const mapStateToProps = (state: any) => ({
  users: state.adminCloudHub.users,
  currentOrganization: state.auth.me?.currentOrganization,
  links: state.links,
})

const mapDispatchToProps = (dispatch: any) => ({
  actionsAdmin: bindActionCreators(adminCloudHubActionCreators, dispatch),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(UserSelectionOverlay)
