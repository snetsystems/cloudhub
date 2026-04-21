import React from 'react'
import {AlignType, ColumnInfo, DataTableObject} from 'src/types'
import {
  BACKGROUND_TYPE_MODES,
  CHART_TYPE_MODES,
} from 'src/types/statisticalgraph'
import {LINE_COLORS_I} from 'src/shared/constants/graphColorPalettes'
import TableGaugeCell from 'src/dashboards/components/TableGaugeCell'
import _ from 'lodash'

export const alertStatusColumns = (): ColumnInfo[] => {
  return [
    {
      key: 'cpu',
      name: 'CPU',
      align: AlignType.LEFT,
      options: {
        thead: {align: AlignType.LEFT, style: {width: '27%'}},
      },
      render: (value: any, rowData: DataTableObject) => {
        if (!rowData) return null

        const cpuUsage = rowData.cpu_usage_total ?? null
        const cpuUser = rowData.cpu_usage_user ?? null
        const cpuSys = rowData.cpu_usage_system ?? null
        const queueLength = rowData.queue_length ?? null

        const gaugeOptsPercent = {
          min: 0,
          max: 100,
          colors: LINE_COLORS_I,
          chartType: CHART_TYPE_MODES.SEGMENTED,
          backgroundType: BACKGROUND_TYPE_MODES.GRADIENT,
          isPercent: true,
          isShowValues: true,
          isGauge: true,
          decimalPlaces: 1,
        }

        return (
          <div className="alert-column--container">
            {cpuUsage !== null && (
              <div>
                <div className="alert-column--header">CPU Usage</div>
                <TableGaugeCell options={gaugeOptsPercent} value={cpuUsage} />
              </div>
            )}
            {cpuUser !== null && (
              <div>
                <div className="alert-column--header">CPU User</div>
                <TableGaugeCell options={gaugeOptsPercent} value={cpuUser} />
              </div>
            )}
            {cpuSys !== null && (
              <div>
                <div className="alert-column--header">CPU System</div>
                <TableGaugeCell options={gaugeOptsPercent} value={cpuSys} />
              </div>
            )}
            {queueLength !== null && (
              <div className="alert-column--stat-row">
                <span>queue_length</span>
                <span className="alert-column--stat-value">
                  {Number(queueLength).toFixed(0)}
                </span>
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'memory',
      name: 'Memory Used %',
      align: AlignType.LEFT,
      options: {
        thead: {align: AlignType.LEFT, style: {width: '27%'}},
      },
      render: (value: any, rowData: DataTableObject) => {
        if (!rowData) return null

        const memUsedPercent = rowData.mem_used_percent ?? null
        const memUsed = rowData.mem_used ?? null
        const memFree = rowData.mem_free ?? null
        const memCached = rowData.mem_cached ?? null

        const pagefaults = rowData.mem_pagefaults ?? null
        const poolPaged = rowData.mem_pool_paged ?? null
        const poolNonpaged = rowData.mem_pool_nonpaged ?? null

        const swapUsedPercent = rowData.swap_used_percent ?? null
        const swapUsed = rowData.swap_used ?? null

        const gaugeOptsPercent = {
          min: 0,
          max: 100,
          colors: LINE_COLORS_I,
          chartType: CHART_TYPE_MODES.SEGMENTED,
          backgroundType: BACKGROUND_TYPE_MODES.GRADIENT,
          isPercent: true,
          isShowValues: true,
          isGauge: true,
          decimalPlaces: 1,
        }

        const formatBytes = (bytes: number) => {
          if (bytes === 0) return '0 B'
          const k = 1024
          const sizes = ['B', 'K', 'M', 'G', 'T', 'P']
          const i = Math.floor(Math.log(bytes) / Math.log(k))
          return (
            parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
          )
        }

        const renderStat = (
          label: string,
          val: number | null,
          isBytes = true
        ) => {
          if (val === null) return null
          return (
            <div className="alert-column--stat-row">
              <span>{label}</span>
              <span className="alert-column--stat-value">
                {isBytes ? formatBytes(val) : val}
              </span>
            </div>
          )
        }

        return (
          <div className="alert-column--container">
            {memUsedPercent !== null && (
              <div>
                <div className="alert-column--header">Memory Usage (%)</div>
                <TableGaugeCell
                  options={gaugeOptsPercent}
                  value={memUsedPercent}
                />
              </div>
            )}

            <div className="alert-column--stat-group">
              {renderStat('Used Size', memUsed)}
              {renderStat('Free', memFree)}
              {renderStat('Cached', memCached)}
              {renderStat('Pagefaults', pagefaults, false)}
              {renderStat('Pool Paged', poolPaged)}
              {renderStat('Pool Non-paged', poolNonpaged)}
            </div>

            {swapUsedPercent !== null && (
              <div>
                <div className="alert-column--header">Swap Used %</div>
                <TableGaugeCell
                  options={gaugeOptsPercent}
                  value={swapUsedPercent}
                />
                {renderStat('Swap Used', swapUsed)}
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'disk',
      name: '디스크',
      align: AlignType.LEFT,
      options: {
        thead: {align: AlignType.LEFT, style: {width: '27%'}},
      },
      render: (value: any, rowData: DataTableObject) => {
        if (!rowData) return null

        const disks =
          (rowData.disks as Array<{path: string; usage: number}>) || []

        const gaugeOptsPercent = {
          min: 0,
          max: 100,
          colors: LINE_COLORS_I,
          chartType: CHART_TYPE_MODES.SEGMENTED,
          backgroundType: BACKGROUND_TYPE_MODES.GRADIENT,
          isPercent: true,
          isShowValues: true,
          isGauge: true,
          decimalPlaces: 0,
        }

        return (
          <div className="alert-column--container">
            {disks.length === 0 && (
              <span className="alert-status-modal--empty-state">N/A</span>
            )}
            {disks.map((d, i) => (
              <div key={i} className="alert-column--disk-item">
                <div className="gauge-wrapper">
                  <TableGaugeCell options={gaugeOptsPercent} value={d.usage} />
                </div>
                <span className="alert-column--disk-path">{d.path}</span>
              </div>
            ))}
          </div>
        )
      },
    },
    {
      key: 'network',
      name: '네트워크',
      align: AlignType.LEFT,
      options: {
        thead: {align: AlignType.LEFT, style: {width: '19%'}},
      },
      render: (value: any, rowData: DataTableObject) => {
        if (!rowData) return null

        const networks =
          (rowData.networks as Array<{interface: string; traffic: number}>) ||
          []

        const formatTraffic = (bps: number) => {
          if (bps === 0) return '0 B'
          const k = 1000
          const sizes = ['B', 'K', 'M', 'G', 'T']
          const i = Math.floor(Math.log(bps) / Math.log(k))
          return parseFloat((bps / Math.pow(k, i)).toFixed(1)) + sizes[i]
        }

        return (
          <div className="alert-column--container">
            {networks.length === 0 && (
              <span className="alert-status-modal--empty-state">N/A</span>
            )}
            {networks.map((n, i) => (
              <div key={i} className="alert-column--net-item">
                <span className="alert-column--net-iface">{n.interface}</span>
                <span className="alert-column--net-traffic">
                  {formatTraffic(n.traffic)}
                </span>
              </div>
            ))}
          </div>
        )
      },
    },
  ]
}
