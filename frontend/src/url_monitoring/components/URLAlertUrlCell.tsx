import React, {useState} from 'react'
import classnames from 'classnames'
import {useTranslation} from 'react-i18next'
import {OuiButtonIcon, OuiPopover} from '@opensearch-project/oui'

interface URLAlertUrlCellProps {
  name: unknown
  urls: string[]
}

const normalizeUrlAlertNames = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(name => String(name).trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()]
  }
  return []
}

const buildUrlAlertNameUrlPairs = (name: unknown, urls: string[]) => {
  const names = normalizeUrlAlertNames(name)
  const count = Math.max(names.length, urls.length, 1)

  return Array.from({length: count}, (_, index) => ({
    name: names[index] ?? '-',
    url: urls[index] ?? '-',
  }))
}

export function URLAlertUrlCell({name, urls}: URLAlertUrlCellProps) {
  const {t} = useTranslation()
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  if (!urls.length) {
    return <span>-</span>
  }

  const [firstName, ...restNames] = normalizeUrlAlertNames(name)
  const pairs = buildUrlAlertNameUrlPairs(name, urls)

  return (
    <div className="url-alert-url-cell">
      <span className="url-alert-url-cell__content">
        <span className="url-alert-url-cell__item">{firstName}</span>
        {restNames.length > 0 && (
          <span className="url-alert-url-cell__more">
            {t('url_alert.and_n_more', '외 {{num}}개', {
              num: restNames.length,
            })}
          </span>
        )}
      </span>
      <span
        className={classnames('url-alert-url-cell__action', {
          'url-alert-url-cell__action--open': isPopoverOpen,
        })}
        onClick={e => e.stopPropagation()}
        title={t('url_alert.click_to_view_urls', 'Click to view URLs')}
      >
        <OuiPopover
          button={
            <OuiButtonIcon
              className="url-alert-url-cell__expand-btn"
              iconType="expandMini"
              size="xs"
              iconSize="s"
              display="fill"
              aria-label="View URLs"
              onClick={e => {
                e.stopPropagation()
                setIsPopoverOpen(open => !open)
              }}
            />
          }
          isOpen={isPopoverOpen}
          closePopover={() => setIsPopoverOpen(false)}
          anchorPosition="downLeft"
          panelClassName="url-alert-url-popover-panel"
          panelPaddingSize="s"
          repositionOnScroll={true}
        >
          <table className="table url-alert-url-popover-table">
            <thead>
              <tr>
                <th className="url-alert-url-popover-table__name">Request</th>
                <th className="url-alert-url-popover-table__url">URL</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((pair, index) => (
                <tr key={`${pair.name}-${pair.url}-${index}`}>
                  <td
                    className="url-alert-url-popover-table__name"
                    title={pair.name}
                  >
                    {pair.name}
                  </td>
                  <td
                    className="url-alert-url-popover-table__url"
                    title={pair.url}
                  >
                    {pair.url}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </OuiPopover>
      </span>
    </div>
  )
}
