import React, {useMemo} from 'react'
import {withRouter} from 'react-router'
import {useTranslation} from 'react-i18next'
import {
  Page,
  Button,
  ComponentColor,
  ComponentSize,
  ButtonShape,
  IconFont,
} from 'src/reusable_ui'
import ConfirmButton from 'src/shared/components/ConfirmButton'
import TableComponent from 'src/device_management/components/TableComponent'
import {ColumnInfo, Organization} from 'src/types'
import {connect} from 'react-redux'

interface Props {
  meCurrentOrganization: Organization
  router: any
  params: {
    sourceID: string
  }
}

function GroupsPage({router, params}: Props) {
  const {t} = useTranslation()

  const navigateToDetail = (group: any) => {
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
        option: {
          thead: {
            style: {width: '25%'},
          },
        },
      },
      {
        name: t('group_management.member_count', '인원'),
        key: 'memberCount',
        option: {
          thead: {
            style: {width: '25%'},
          },
        },
      },
      {
        name: t('group_management.email_targets', '설정된 이메일 대상'),
        key: 'emailTargets',
        option: {
          thead: {
            style: {width: '35%'},
          },
        },
      },
      {
        name: t('group_management.actions', '설정'),
        key: 'actions',
        option: {
          thead: {
            style: {width: '15%'},
          },
        },
        render: (_value, _rowData) => (
          <div className="group-action-btn-container">
            <Button
              icon={IconFont.Pencil}
              shape={ButtonShape.Square}
              color={ComponentColor.Primary}
              size={ComponentSize.ExtraSmall}
              onClick={() => navigateToDetail(_rowData)}
              customClass="group-action-btn"
            />
            <ConfirmButton
              icon={IconFont.Trash}
              square={true}
              confirmText={t('group_management.delete_confirm', '삭제하기')}
              type="btn-danger"
              size="btn-xs"
              confirmAction={() => {}}
              customClass="group-action-btn"
            />
          </div>
        ),
      },
    ],
    [t]
  )

  const data = useMemo(
    () => [
      // 예시 데이터 (Dummy data for testing layout)
      {
        groupId: '1',
        groupName: 'Admin Group',
        memberCount: 5,
        emailTargets: 4,
      },
      {
        groupId: '2',
        groupName: 'User Group',
        memberCount: 120,
        emailTargets: 110,
      },
    ],
    []
  )

  return (
    <TableComponent
      columns={columns}
      data={data}
      isSearchDisplay={true}
      searchPlaceholder={t('group_management.search_placeholder', '검색...')}
      isMultiSelect={false}
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

export default connect(mstp, null)(withRouter(GroupsPage))
