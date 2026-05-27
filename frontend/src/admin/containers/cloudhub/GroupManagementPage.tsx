import React, {useMemo, useState, useEffect} from 'react'
import {withRouter} from 'react-router'
import {useTranslation} from 'react-i18next'
import {
  Button,
  ComponentColor,
  ComponentSize,
  ButtonShape,
  IconFont,
} from 'src/reusable_ui'
import ConfirmButton from 'src/shared/components/ConfirmButton'
import TableComponent from 'src/device_management/components/TableComponent'
import {ColumnInfo, Organization, NotificationAction} from 'src/types'
import {connect} from 'react-redux'
import {getRecipientGroups, deleteRecipientGroup} from 'src/alert_group/apis'
import {RecipientGroup} from 'src/alert_group/types'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {notifySuccess, notifyError} from 'src/shared/copy/notifications'

interface Props {
  meCurrentOrganization: Organization
  router: any
  params: {
    sourceID: string
  }
  notify?: NotificationAction
}

interface GroupRowData {
  groupId?: string
  groupName: string
  memberCount?: number
  emailTargets?: number
  isDefault?: boolean
  isNew?: boolean
}

function GroupsPage({router, params, notify}: Props) {
  const {t} = useTranslation()
  const [data, setData] = useState<GroupRowData[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const groups = await getRecipientGroups()
      const formattedData = groups.map((group: RecipientGroup) => ({
        groupId: group.id,
        groupName: group.name,
        memberCount: group.members?.length || 0,
        emailTargets: 0,
        isDefault: group.isDefault,
      }))
      setData(formattedData)
    } catch (error) {
      console.error('Failed to fetch recipient groups', error)
      notify(
        notifyError(
          t(
            'group_management.fetch_failed',
            '그룹 목록을 불러오는데 실패했습니다.'
          )
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await deleteRecipientGroup(groupId)
      notify(
        notifySuccess(
          t('group_management.delete_success', '그룹을 삭제했습니다.')
        )
      )
      fetchData()
    } catch (error) {
      console.error('Failed to delete recipient group', error)
      notify(
        notifyError(
          t('group_management.delete_failed', '그룹 삭제에 실패했습니다.')
        )
      )
    }
  }

  const navigateToDetail = (group: GroupRowData) => {
    const pathId = group?.isNew ? 'new' : group?.groupId
    router.push({
      pathname: `/sources/${params.sourceID}/group-management/detail/${pathId}`,
    })
  }

  const columns: ColumnInfo[] = useMemo(
    () => [
      {
        name: t('group_management.group_name', '그룹명'),
        key: 'groupName',
        options: {
          thead: {
            style: {width: '25%'},
          },
        },
      },
      {
        name: t('group_management.member_count', '인원'),
        key: 'memberCount',
        options: {
          thead: {
            style: {width: '50%'},
          },
        },
      },
      {
        name: t('group_management.actions', '설정'),
        key: 'actions',
        options: {
          thead: {
            style: {width: '15%'},
          },
        },
        render: (_value, rowData) => (
          <div className="group-action-btn-container">
            <Button
              icon={IconFont.Pencil}
              shape={ButtonShape.Square}
              color={ComponentColor.Primary}
              size={ComponentSize.ExtraSmall}
              onClick={() => navigateToDetail(rowData)}
              customClass="group-action-btn"
            />
            {rowData.isDefault ? (
              <ConfirmButton
                icon={IconFont.Trash}
                square={true}
                confirmText={t('group_management.delete_confirm', '삭제하기')}
                type="btn-danger"
                size="btn-xs"
                confirmAction={() =>
                  notify(
                    notifyError(
                      t(
                        'group_management.delete_default_error',
                        '기본 그룹은 지울 수 없습니다'
                      )
                    )
                  )
                }
                customClass="group-action-btn"
              />
            ) : (
              <ConfirmButton
                icon={IconFont.Trash}
                square={true}
                confirmText={t('group_management.delete_confirm', '삭제하기')}
                type="btn-danger"
                size="btn-xs"
                confirmAction={() => handleDeleteGroup(rowData.groupId)}
                customClass="group-action-btn"
              />
            )}
          </div>
        ),
      },
    ],
    [t]
  )

  return (
    <TableComponent
      bodyClassName="group-management"
      columns={columns}
      data={data}
      isLoading={isLoading}
      isSearchDisplay={true}
      searchPlaceholder={t('group_management.search_placeholder', '검색...')}
      isMultiSelect={false}
      options={{
        tbodyRow: {
          className: 'group-management-table-row',
        },
      }}
      topLeftRender={
        <div className="panel-title">
          {`${t('group_management.group_list', '그룹 목록')} : ${data.length}`}
        </div>
      }
      toprightRender={
        <div>
          <Button
            text={t('button.new_group', '새 그룹')}
            color={ComponentColor.Primary}
            size={ComponentSize.Small}
            onClick={() =>
              navigateToDetail({isNew: true, groupName: 'New Group'})
            }
          />
        </div>
      }
    />
  )
}

const mstp = state => {
  const {
    auth: {me},
  } = state
  return {me}
}

const mapDispatchToProps = {
  notify: notifyAction,
}

export default connect(mstp, mapDispatchToProps)(withRouter(GroupsPage))
