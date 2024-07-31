import React from 'react'
import {ModalContentHeaderProps} from 'src/types/prediction'

const ModalContentHeader: React.FC<ModalContentHeaderProps> = ({
  headerContents,
}) => {
  const formatContent = (content: string | number | object): string => {
    if (typeof content === 'object') {
      return `[${(content as any[])
        .map(innerArray => `[${innerArray.join(', ')}]`)
        .join(', \n')}]`
    }
    return String(content)
  }

  return (
    <div>
      {headerContents.map((item, index) => (
        <div key={index}>
          <span style={{whiteSpace: 'pre-wrap'}} className="span-header">
            {`${item.title}:\n${formatContent(item.content)}`}
          </span>
          <br />
        </div>
      ))}
    </div>
  )
}

export default ModalContentHeader
