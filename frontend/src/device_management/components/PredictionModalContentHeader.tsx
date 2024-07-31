import React, {useState} from 'react'
import classnames from 'classnames'
import {ModalContentHeaderProps} from 'src/types/prediction'

const styleClassnames = isActive => {
  return classnames('expandable-sectional', {
    'expandable-sectional-expand': isActive,
  })
}
const RenderItem = ({label, contents}: {label: string; contents: any}) => {
  return (
    <div
      className={'section-item'}
      style={{flex: 1, width: '100%', maxWidth: '100%', flexDirection: 'row'}}
    >
      <div
        className={'util-label'}
        style={{flex: 1, textAlign: 'left', paddingRight: '20px'}}
      >
        {label}
      </div>
      <div
        className={'section-item-contents'}
        style={{flex: 6, whiteSpace: 'pre-wrap'}}
      >
        {contents}
      </div>
    </div>
  )
}

const ModalContentHeader: React.FC<ModalContentHeaderProps> = ({
  title,
  headerContents,
}) => {
  const [isActive, SetActive] = useState(true)
  const formatContent = (content: string | number | object): string => {
    if (typeof content === 'object') {
      return `[${(content as any[])
        .map(innerArray => `[${innerArray.join(', ')}]`)
        .join(', \n')}]`
    }

    return String(content)
  }

  const handleToggleActive = () => {
    SetActive(!isActive)
  }

  return (
    <div>
      <div className={'tab-pannel-contents'}>
        <div className={styleClassnames(isActive)}>
          <span
            className={classnames('expandable-sectional-button icon', {
              'caret-down': isActive,
              'caret-right': !isActive,
            })}
            onClick={handleToggleActive}
          />
          <div className={'expandable-sectional-title'}>{title}</div>
        </div>
        {isActive && headerContents.length > 0 ? (
          <div className={'section-wrap'} style={{flexDirection: 'column'}}>
            {headerContents.map(({title, content}, index) => (
              <RenderItem
                key={`${title}_${index}`}
                label={title}
                contents={formatContent(content)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default ModalContentHeader
