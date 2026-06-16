import React from 'react'

export const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'K', 'M', 'G', 'T', 'P']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export const renderStat = (
  label: string,
  val: number | string | null,
  isBytes = true
) => {
  if (val === null) return null
  return (
    <div className="alert-column--stat-row">
      <span>{label}</span>
      <div className="alert-column--stat-value-container">
        <span className="alert-column--stat-value">
          {isBytes && typeof val === 'number' ? formatBytes(val) : val}
        </span>
      </div>
    </div>
  )
}
