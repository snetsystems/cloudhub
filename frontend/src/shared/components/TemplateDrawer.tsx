import React, {FunctionComponent, MouseEvent} from 'react'
import classnames from 'classnames'

import {ClickOutside} from 'src/shared/components/ClickOutside'

import {Template} from 'src/types'

interface TempVar {
  tempVar: string
}

interface Props {
  templates: Template[]
  selected: TempVar
  onMouseOverTempVar: (
    template: Template
  ) => (e: MouseEvent<HTMLDivElement>) => void
  onClickTempVar: (
    template: Template
  ) => (e: MouseEvent<HTMLDivElement>) => void
  onClickOutside: () => void
}
const TemplateDrawer: FunctionComponent<Props> = ({
  templates,
  selected,
  onMouseOverTempVar,
  onClickTempVar,
  onClickOutside,
}) => (
  <ClickOutside onClickOutside={onClickOutside}>
    <div className="template-drawer">
      {templates.map(t => (
        <div
          className={classnames('template-drawer--item', {
            'template-drawer--selected': t.tempVar === selected.tempVar,
          })}
          onMouseOver={onMouseOverTempVar(t)}
          onMouseDown={onClickTempVar(t)}
          key={t.tempVar}
        >
          {' '}
          {t.tempVar}{' '}
        </div>
      ))}
    </div>
  </ClickOutside>
)

export default TemplateDrawer
