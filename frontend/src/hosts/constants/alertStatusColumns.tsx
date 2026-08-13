import React from 'react'
import {AlignType, ColumnInfo, DataTableObject} from 'src/types'
import {
  BACKGROUND_TYPE_MODES,
  CHART_TYPE_MODES,
  FORMAT_OPTIONS,
} from 'src/types/statisticalgraph'
import {LINE_COLORS_I} from 'src/shared/constants/graphColorPalettes'
import TableGaugeCell from 'src/dashboards/components/TableGaugeCell'
import _ from 'lodash'

import {renderStat} from 'src/hosts/utils/alertStatusUtils'

export const alertStatusColumns = (): ColumnInfo[] => {
  return [
    {
      key: 'cpu',
      name: 'CPU',
      align: AlignType.LEFT,
      options: {
        thead: {align: AlignType.LEFT, style: {width: '26%'}},
      },
      render: (_value: any, rowData: DataTableObject) => {
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
            {queueLength !== null &&
              renderStat('queue_length', Number(queueLength).toFixed(0), false)}
          </div>
        )
      },
    },
    {
      key: 'memory',
      name: 'Memory Used',
      align: AlignType.LEFT,
      options: {
        thead: {align: AlignType.LEFT, style: {width: '26%'}},
      },
      render: (_value: any, rowData: DataTableObject) => {
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

        return (
          <div className="alert-column--container">
            {memUsedPercent !== null && (
              <div>
                <div className="alert-column--header">Memory Usage</div>
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
                <div className="alert-column--header">Swap Used</div>
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
      name: 'Disk',
      align: AlignType.LEFT,
      options: {
        thead: {align: AlignType.LEFT, style: {width: '26%'}},
      },
      render: (_value: any, rowData: DataTableObject) => {
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

        const diskIo = rowData.diskIo as
          | {device: string; usage: number}
          | null
          | undefined

        return (
          <div className="alert-column--container">
            {disks.length === 0 && !diskIo && (
              <span className="alert-status-modal--empty-state">N/A</span>
            )}
            {disks.length > 0 && (
              <div>
                <div className="alert-column--header">Disk Usage</div>
                <TableGaugeCell
                  options={gaugeOptsPercent}
                  value={disks[0].usage}
                />
                <span className="alert-column--disk-path" title={disks[0].path}>
                  {disks[0].path}
                </span>
              </div>
            )}
            {diskIo && (
              <div>
                <div className="alert-column--header">Disk I/O (Max)</div>
                <TableGaugeCell
                  options={gaugeOptsPercent}
                  value={diskIo.usage}
                />
                <span className="alert-column--disk-path" title={diskIo.device}>
                  {diskIo.device}
                </span>
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'network',
      name: 'Network',
      align: AlignType.LEFT,
      options: {
        thead: {align: AlignType.LEFT, style: {width: '22%'}},
      },
      render: (_value: any, rowData: DataTableObject) => {
        if (!rowData) return null

        const networks =
          (rowData.networks as Array<{interface: string; traffic: number}>) ||
          []

        const gaugeOptsNetwork = {
          min: 0,
          max: 1000000000,
          colors: LINE_COLORS_I,
          chartType: CHART_TYPE_MODES.CONTINUOUS,
          isPercent: false,
          isShowValues: true,
          isGauge: true,
          valueFormat: FORMAT_OPTIONS.KMB,
          decimalPlaces: 1,
        }

        return (
          <div className="alert-column--container">
            {networks.length === 0 && (
              <span className="alert-status-modal--empty-state">N/A</span>
            )}
            {networks.map((n, i) => (
              <div key={i}>
                <div className="alert-column--header">{n.interface}</div>
                <TableGaugeCell options={gaugeOptsNetwork} value={n.traffic} />
              </div>
            ))}
          </div>
        )
      },
    },
  ]
}
