import React, {PureComponent} from 'react'
import classnames from 'classnames'
import {Input, InputType} from 'src/reusable_ui'
import {ALERT_TEMPLATES} from 'src/alert_group/types'

interface Props {
  selectedTemplateId: string
  onSelectTemplate: (templateId: string) => void
}

interface State {
  searchTerm: string
}

class AlertGroupTemplateSidebar extends PureComponent<Props, State> {
  public state: State = {
    searchTerm: '',
  }

  private handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({searchTerm: e.target.value})
  }

  public render() {
    const {selectedTemplateId, onSelectTemplate} = this.props
    const {searchTerm} = this.state

    const filteredTemplates = ALERT_TEMPLATES.filter(t =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
      <div className="alert-group-sidebar">
        <div className="alert-group-sidebar--header">
          <div className="alert-group-sidebar--title">이벤트 설정</div>
          <div className="alert-group-sidebar--search">
            <Input
              type={InputType.Text}
              placeholder="검색"
              value={searchTerm}
              onChange={this.handleSearchChange}
              spellCheck={false}
            />
          </div>
        </div>

        <div className="alert-group-sidebar--menu">
          <div
            className={classnames('alert-group-sidebar--item', {
              active: selectedTemplateId === 'custom',
            })}
            onClick={() => onSelectTemplate('custom')}
          >
            새로 만들기
          </div>
          
          <div className="alert-group-sidebar--section-title">빠른 설정</div>
          
          {filteredTemplates.map(template => (
            <div
              key={template.id}
              className={classnames('alert-group-sidebar--item', {
                active: selectedTemplateId === template.id,
              })}
              onClick={() => onSelectTemplate(template.id)}
            >
              {template.name}
            </div>
          ))}
        </div>
      </div>
    )
  }
}

export default AlertGroupTemplateSidebar
