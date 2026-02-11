import React, {useState} from 'react'
import {connect} from 'react-redux'
import {Source, Dashboard, CellType, Template, TemplateValue, Me} from 'src/types'
import {Button, ComponentColor, Page} from 'src/reusable_ui'
import FixedModal from 'src/reusable_ui/components/FixedModal/FixedModal'
import TemplateControlBar from 'src/tempVars/components/TemplateControlBar'
import {detectTemplateConflicts} from 'src/server_details/utils/templateConflict'

interface Props {
  source: Source
  me?: Me
  isUsingAuth?: boolean
}

interface SelectedItems {
  dashboards: Dashboard[]
  cellTypes: CellType[]
  templates: Template[]
}

function ServerDetailsPage({source, me, isUsingAuth}: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [localTemplates, setLocalTemplates] = useState<Template[]>([])

  const handleSelectionChange = (items: SelectedItems) => {
    setLocalTemplates(items.templates)
    console.log('Selected Dashboards:', items.dashboards)
    console.log('Selected Cell Types:', items.cellTypes)
    console.log('Merged Templates:', items.templates)
  }

  const handlePickTemplate = (template: Template, value: TemplateValue) => {
    const updated = localTemplates.map(t => {
      if (t.id === template.id) {
        return {
          ...t,
          values: t.values.map(v => ({
            ...v,
            localSelected: v.value === value.value,
          })),
        }
      }
      return t
    })
    setLocalTemplates(updated)
  }

  const handleSaveTemplates = (templates: Template[]) => {
    const templatesWithConflict = detectTemplateConflicts(templates)
    setLocalTemplates(templatesWithConflict)
  }

  return (
    <Page className="server-details-page">
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="Server Details" />
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true}>
          <Button
            text="Import Modal"
            color={ComponentColor.Primary}
            onClick={() => {
              setIsModalOpen(prev => !prev)
            }}
          />
        </Page.Header.Right>
      </Page.Header>
      {localTemplates.length > 0 && (
        <TemplateControlBar
          templates={localTemplates}
          me={me || {role: 'ADMIN', currentOrganization: {name: ''}}}
          isUsingAuth={isUsingAuth || false}
          onSaveTemplates={handleSaveTemplates}
          onPickTemplate={handlePickTemplate}
          source={source}
        />
      )}
      <Page.Contents>
        <FixedModal 
          isOpen={isModalOpen} 
          setIsOpen={setIsModalOpen}
          onSelectionChange={handleSelectionChange}
        />
      </Page.Contents>
    </Page>
  )
}

const mapStateToProps = ({auth: {me, isUsingAuth}}) => ({
  me,
  isUsingAuth,
})

export default connect(mapStateToProps)(ServerDetailsPage)
