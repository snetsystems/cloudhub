import {TFunction} from 'react-i18next'

export const getOccurrenceTooltip = (t: TFunction): string => {
  const mSym = t('alert_group_rule.tooltip.minute_symbol')

  // Helper to format the trend column: "⏱️  X[mSym] : Y% [🔴/🟢 Tag]"
  const trend = (
    min: number,
    val: number,
    status: 'exceeded' | 'normal' | 'resolved' | 'exceeding',
    count?: number
  ) => {
    let tag = ''
    if (status === 'exceeded') {
      tag = `🔴 ${t('alert_group_rule.tooltip.min_exceeded', {count})}`
    } else if (status === 'normal') {
      tag = `🟢 ${t('alert_group_rule.tooltip.min_normal')}`
    } else if (status === 'resolved') {
      tag = `🟢 ${t('alert_group_rule.tooltip.min_resolved')}`
    } else if (status === 'exceeding') {
      tag = `🔴 ${t('alert_group_rule.tooltip.min_exceeding_persist')}`
    }
    return `⏱️  ${min}${mSym} : ${val}% [${tag}]`
  }

  return `<table style="border-collapse: collapse; width: 100%; font-size: 11px; font-family: sans-serif; color: #fff; background-color: #222; border: 1px solid #444; border-radius: 4px;">
  <thead>
    <tr style="border-bottom: 2px solid #444; background-color: #2c2c2c;">
      <th style="padding: 8px 16px; border-right: 1px solid #444; text-align: left; font-weight: bold; white-space: nowrap; color: #fff; min-width: 220px;">[⏱️ ${t(
        'alert_group_rule.tooltip.timeline_trend'
      )}]</th>
      <th style="padding: 8px 16px; border-right: 1px solid #444; text-align: left; font-weight: bold; white-space: nowrap; color: #fff; min-width: 220px;">[${t(
        'alert_group_rule.tooltip.cond_a'
      )}]</th>
      <th style="padding: 8px 16px; text-align: left; font-weight: bold; white-space: nowrap; color: #fff; min-width: 240px;">[${t(
        'alert_group_rule.tooltip.cond_b'
      )}]</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom: 1px solid #333;">
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap;">${trend(
        1,
        85,
        'exceeded',
        1
      )}</td>
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap; color: #aaa;">⏳ ${t(
        'alert_group_rule.tooltip.waiting_accumulated',
        {count: 1}
      )}</td>
      <td style="padding: 8px 16px; white-space: nowrap; color: #aaa;">⏳ ${t(
        'alert_group_rule.tooltip.waiting_consecutive',
        {count: 1}
      )}</td>
    </tr>
    <tr style="border-bottom: 1px solid #333;">
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap;">${trend(
        2,
        70,
        'normal'
      )}</td>
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap; color: #aaa;">⏳ ${t(
        'alert_group_rule.tooltip.waiting_accumulated',
        {count: 1}
      )}</td>
      <td style="padding: 8px 16px; white-space: nowrap; color: #aaa;">🔄 ${t(
        'alert_group_rule.tooltip.reset_consecutive'
      )}</td>
    </tr>
    <tr style="border-bottom: 1px solid #333;">
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap;">${trend(
        3,
        88,
        'exceeded',
        2
      )}</td>
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap; color: #aaa;">⏳ ${t(
        'alert_group_rule.tooltip.waiting_accumulated',
        {count: 2}
      )}</td>
      <td style="padding: 8px 16px; white-space: nowrap; color: #aaa;">⏳ ${t(
        'alert_group_rule.tooltip.waiting_consecutive',
        {count: 1}
      )}</td>
    </tr>
    <tr style="border-bottom: 1px solid #333;">
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap;">${trend(
        4,
        91,
        'exceeded',
        3
      )}</td>
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap; font-weight: bold; color: #f5a623;">📢 ${t(
        'alert_group_rule.tooltip.first_alert_minutes',
        {minutes: '1,3,4'}
      )}</td>
      <td style="padding: 8px 16px; white-space: nowrap; color: #aaa;">⏳ ${t(
        'alert_group_rule.tooltip.waiting_consecutive',
        {count: 2}
      )}</td>
    </tr>
    <tr style="border-bottom: 1px solid #444; background-color: #2c2c2c;">
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap;">${trend(
        5,
        82,
        'exceeded',
        4
      )}</td>
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap; color: #888;">🔇 ${t(
        'alert_group_rule.tooltip.muted_already_alerted'
      )}</td>
      <td style="padding: 8px 16px; white-space: nowrap; font-weight: bold; color: #f5a623;">📢 ${t(
        'alert_group_rule.tooltip.first_alert_consecutive',
        {minutes: '3,4,5'}
      )}</td>
    </tr>
    <tr style="border-bottom: 1px solid #333;">
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap;">${trend(
        6,
        65,
        'normal'
      )}</td>
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap; color: #888;">🔇 ${t(
        'alert_group_rule.tooltip.muted_alerted_state'
      )}</td>
      <td style="padding: 8px 16px; white-space: nowrap; font-weight: bold; color: #2ecc71;">🟢 ${t(
        'alert_group_rule.tooltip.recovery_sent'
      )}</td>
    </tr>
    <tr style="border-bottom: 1px solid #333;">
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap;">${trend(
        7,
        60,
        'normal'
      )}</td>
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap; color: #888;">🔇 ${t(
        'alert_group_rule.tooltip.muted_alerted_state'
      )}</td>
      <td style="padding: 8px 16px; white-space: nowrap; color: #aaa;">⏳ ${t(
        'alert_group_rule.tooltip.keeping_normal'
      )}</td>
    </tr>
    <tr style="border-bottom: 1px solid #333;">
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap;">${trend(
        8,
        72,
        'resolved'
      )}</td>
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap; font-weight: bold; color: #2ecc71;">🟢 ${t(
        'alert_group_rule.tooltip.recovery_sent'
      )}</td>
      <td style="padding: 8px 16px; white-space: nowrap; color: #aaa;">⏳ ${t(
        'alert_group_rule.tooltip.keeping_normal'
      )}</td>
    </tr>
    <tr style="border-bottom: 1px solid #333;">
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap;">${trend(
        9,
        84,
        'exceeded',
        1
      )}</td>
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap; color: #aaa;">⏳ ${t(
        'alert_group_rule.tooltip.waiting_accumulated',
        {count: 2}
      )}</td>
      <td style="padding: 8px 16px; white-space: nowrap; color: #aaa;">⏳ ${t(
        'alert_group_rule.tooltip.waiting_consecutive',
        {count: 1}
      )}</td>
    </tr>
    <tr style="border-bottom: 1px solid #333;">
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap;">${trend(
        10,
        89,
        'exceeded',
        2
      )}</td>
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap; color: #aaa;">⏳ ${t(
        'alert_group_rule.tooltip.waiting_accumulated',
        {count: 2}
      )}</td>
      <td style="padding: 8px 16px; white-space: nowrap; color: #aaa;">⏳ ${t(
        'alert_group_rule.tooltip.waiting_consecutive',
        {count: 2}
      )}</td>
    </tr>
    <tr style="border-bottom: 1px solid #444; background-color: #2c2c2c;">
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap;">${trend(
        11,
        81,
        'exceeded',
        3
      )}</td>
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap; font-weight: bold; color: #f5a623;">📢 ${t(
        'alert_group_rule.tooltip.alert_minutes',
        {minutes: '9,10,11'}
      )}</td>
      <td style="padding: 8px 16px; white-space: nowrap; font-weight: bold; color: #f5a623;">📢 ${t(
        'alert_group_rule.tooltip.alert_consecutive',
        {minutes: '9,10,11'}
      )}</td>
    </tr>
    <tr style="border-bottom: 1px solid #333;">
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap;">${trend(
        12,
        83,
        'exceeding'
      )}</td>
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap; color: #888;">🔇 ${t(
        'alert_group_rule.tooltip.muted_alerted_state'
      )}</td>
      <td style="padding: 8px 16px; white-space: nowrap; color: #888;">🔇 ${t(
        'alert_group_rule.tooltip.muted_alerted_state'
      )}</td>
    </tr>
    <tr style="border-bottom: 1px solid #333;">
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap;">${trend(
        13,
        85,
        'exceeding'
      )}</td>
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap; color: #888;">🔇 ${t(
        'alert_group_rule.tooltip.muted_alerted_state'
      )}</td>
      <td style="padding: 8px 16px; color: #888;">🔇 ${t(
        'alert_group_rule.tooltip.muted_alerted_state'
      )}</td>
    </tr>
    <tr style="border-bottom: 1px solid #333;">
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap;">${trend(
        14,
        82,
        'exceeding'
      )}</td>
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap; color: #888;">🔇 ${t(
        'alert_group_rule.tooltip.muted_alerted_state'
      )}</td>
      <td style="padding: 8px 16px; color: #888;">🔇 ${t(
        'alert_group_rule.tooltip.muted_alerted_state'
      )}</td>
    </tr>
    <tr>
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap;">${trend(
        15,
        86,
        'exceeding'
      )}</td>
      <td style="padding: 8px 16px; border-right: 1px solid #333; white-space: nowrap; color: #888;">🔇 ${t(
        'alert_group_rule.tooltip.muted_alerted_state'
      )}</td>
      <td style="padding: 8px 16px; white-space: nowrap; font-weight: bold; color: #f5a623;">🔔 ${t(
        'alert_group_rule.tooltip.remind_after_alert',
        {minute: 5}
      )}</td>
    </tr>
  </tbody>
</table>`
}
