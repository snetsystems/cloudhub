import React from 'react'

import {OpticsSeverity} from 'src/device_management/constants/opticsThreshold'

/**
 * A status chip, coloured by severity rather than by status.
 *
 * Four tones for many statuses: the chip says what to do about the port, and
 * the word inside it says why. `none` is left uncoloured so a shut port, an
 * empty cage or an unused port reads as neither good nor bad. The optics cell
 * and the switch ports cell share it, so a port never reads two ways.
 *
 * No icon: the tone and the word already carry the severity, and a tick or a
 * cross beside them only says it a third time.
 */
const SeverityBadge: React.FC<{
  label: string
  severity: OpticsSeverity
}> = ({label, severity}) => (
  <span className={`severity--badge severity--badge-${severity}`}>{label}</span>
)

export default SeverityBadge
