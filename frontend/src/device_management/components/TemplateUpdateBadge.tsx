import React from 'react'
import {useTranslation} from 'react-i18next'

import {TemplateUpdate} from 'src/device_management/utils/useFixedCellTemplateUpdate'

interface Props {
  update: TemplateUpdate | null
  isApplying: boolean
  onApply: () => void
}

/** "v1.0.0 → v1.1.0 [Update]" beside the table's top-left controls. */
const TemplateUpdateBadge: React.FC<Props> = ({
  update,
  isApplying,
  onApply,
}) => {
  const {t} = useTranslation()

  if (!update) {
    return null
  }
  return (
    <div className="optics-template-update">
      <span className="optics-template-update--version">
        v{update.from} → v{update.to}
      </span>
      <button
        type="button"
        className="btn btn-xs btn-primary"
        disabled={isApplying}
        onClick={onApply}
      >
        {isApplying
          ? t('button.saving', 'Saving...')
          : t('optics.template_update', 'Update')}
      </button>
    </div>
  )
}

export default TemplateUpdateBadge
