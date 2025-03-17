import React, {useEffect, useLayoutEffect, useRef, useState} from 'react'
import * as d3 from 'd3'

// Components
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import NVidiaDataMonitoringTooltip from 'src/gpu_monitoring/components/NVidiaDataMonitoringTooltip'

// Constants
import {
  GAP_BETWEEN_GPU_LABEL_AND_GPU_NODE,
  PCIE_GENERATION_SPEED,
  REPEATING_LINEAR_GRADIENT_STYLE,
  BYTES_PER_GB,
  GPU_MONITORING_TOOLTIP_OFFSET_X,
  FILTERED_HOST_BORDER,
  GPU_MONITORING_TOOLTIP_WIDTH,
  GPU_MONITORING_CRITICAL_VALUE,
  DEFAULT_UNIT_SEGMENT,
} from 'src/gpu_monitoring/constants'

// Types
import {
  FilteredHostForGPUMonitoring,
  NVidiaSmiMonitoringTooltipNode,
  HostsForGPUSmiData,
  HostsForGPUSmiMIGData,
  MigProfile,
} from 'src/types'

// Utils
import {
  calculateTemperaturePercent,
  colorScaleForGPUMonitoring,
} from 'src/gpu_monitoring/utils'

// MockData
import {hostsForGPUSmiMockingData} from 'src/gpu_monitoring/mocks/gpu-smi-mockdata'
import {hostsForGPUSmiMIGMockingData} from 'src/gpu_monitoring/mocks/gpu-smi-mig-mockdata'
import {migProfilesMockData} from 'src/gpu_monitoring/mocks/gpu-mig-profile-mockdata'

interface Props {
  isMockActive: boolean
  hostsForGPUSmiData: HostsForGPUSmiData
  hostsForGPUSmiMIGData: HostsForGPUSmiMIGData
  filteredHostForGPUMonitoring: FilteredHostForGPUMonitoring
  minionHostnameMapping: Record<string, string>
  migProfilesState: Record<string, MigProfile[]>
  onHostnameNodeClick: (hostname: string, gpuIndex: number) => void
  onGPUIndexNodeClick: (hostname: string, gpuIndex: number) => void
}

const GPUMonitoringTreeMap: React.FC<Props> = ({
  isMockActive,
  filteredHostForGPUMonitoring,
  hostsForGPUSmiData,
  hostsForGPUSmiMIGData,
  minionHostnameMapping,
  migProfilesState,
  onHostnameNodeClick,
  onGPUIndexNodeClick,
}) => {
  const parentRef = useRef<HTMLDivElement>(null)
  const childrenRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [isMouseOn, setIsMouseOn] = useState(false)
  const [
    tooltipNode,
    setTooltipNode,
  ] = useState<NVidiaSmiMonitoringTooltipNode>({
    name: '',
    rows: [
      {title: 'GPU Memory', value: -1},
      {title: 'GPU Temp (°C)', value: -1},
      {title: 'GPU Memory Temp (°C)', value: -1},
      {title: 'Pwr Consumption', value: -1},
      {title: 'PCIe Traffic', value: -1},
    ],
  })
  const [tooltipPosition, setTooltipPosition] = useState({x: 0, y: 0})
  const [adjustedTooltipPosition, setAdjustedTooltipPosition] = useState({
    x: 0,
    y: 0,
  })

  const mergeData = (realData: any, mockData: any) => {
    const merged = {...realData}

    Object.keys(mockData).forEach(key => {
      if (merged[key]) {
        merged[key] = merged[key].concat(mockData[key])
      } else {
        merged[key] = mockData[key]
      }
    })
    return merged
  }

  const mergeMigProfilesData = (realData: any, mockData: any) => {
    const merged = {...realData}

    Object.keys(mockData).forEach(key => {
      if (merged[key]) {
        merged[key] = merged[key].concat(mockData[key])
      } else {
        merged[key] = mockData[key]
      }
    })
    return merged
  }

  const [finalGPUSmiData, setFinalGPUSmiData] = useState<HostsForGPUSmiData>(
    isMockActive
      ? mergeData(hostsForGPUSmiData, hostsForGPUSmiMockingData)
      : hostsForGPUSmiData
  )
  const [
    finalGPUSmiMIGData,
    setFinalGPUSmiMIGData,
  ] = useState<HostsForGPUSmiMIGData>(
    isMockActive
      ? mergeData(hostsForGPUSmiMIGData, hostsForGPUSmiMIGMockingData)
      : hostsForGPUSmiMIGData
  )

  const [finalMigProfilesData, setFinalMigProfilesData] = useState<
    Record<string, MigProfile[]>
  >(
    isMockActive
      ? mergeMigProfilesData(migProfilesState, migProfilesMockData)
      : migProfilesState
  )

  useLayoutEffect(() => {
    if (isMouseOn && parentRef.current) {
      const parentRect = parentRef.current.getBoundingClientRect()
      let tooltipW = GPU_MONITORING_TOOLTIP_WIDTH
      let tooltipH = 0

      if (childrenRef.current) {
        tooltipW = childrenRef.current.offsetWidth
        tooltipH = childrenRef.current.offsetHeight
      }

      const offsetX = GPU_MONITORING_TOOLTIP_OFFSET_X / 2
      const offsetY = 15
      let posX = tooltipPosition.x + offsetX
      let posY = tooltipPosition.y + offsetY

      if (posX + tooltipW > parentRect.width) {
        posX = parentRect.width - tooltipW - 5
      }

      if (posX < 5) {
        posX = 5
      }

      if (posY + tooltipH > parentRect.height) {
        posY = parentRect.height - tooltipH - 5
      }
      if (posY < 5) {
        posY = 5
      }

      setAdjustedTooltipPosition({x: posX, y: posY})
    }
  }, [tooltipPosition, isMouseOn])

  useEffect(() => {
    const computedSmiData = isMockActive
      ? mergeData(hostsForGPUSmiData, hostsForGPUSmiMockingData)
      : hostsForGPUSmiData

    setFinalGPUSmiData(computedSmiData)

    const computedSmiMIGData = isMockActive
      ? mergeData(hostsForGPUSmiMIGData, hostsForGPUSmiMIGMockingData)
      : hostsForGPUSmiMIGData

    setFinalGPUSmiMIGData(computedSmiMIGData)

    const computedMigProfiles = isMockActive
      ? mergeMigProfilesData(migProfilesState, migProfilesMockData)
      : migProfilesState

    setFinalMigProfilesData(computedMigProfiles)
  }, [
    isMockActive,
    hostsForGPUSmiData,
    hostsForGPUSmiMIGData,
    migProfilesState,
  ])

  useEffect(() => {
    if (!containerRef.current) return

    d3.select(containerRef.current).selectAll('*').remove()

    const hostnames = Object.keys(finalGPUSmiData)
    const hosts = hostnames.map(name => createHostData(name))
    const hostContainer = d3
      .select(containerRef.current)
      .append('div')
      .attr('id', 'treemap-host-container')

    const hostItems = hostContainer
      .selectAll('.treemap-host-item')
      .data(hosts)
      .enter()
      .append('div')
      .attr('class', 'treemap-host-item')
      .style('border', (d: any) =>
        filteredHostForGPUMonitoring &&
        d.originalHostname === filteredHostForGPUMonitoring.hostname
          ? FILTERED_HOST_BORDER
          : null
      )

    hostItems
      .append('div')
      .attr('class', 'treemap-hostname')
      .attr('title', (d: any) => d.name)
      .text((d: any) => d.name)
      .on('click', function (d: any) {
        if (d3.event && typeof d3.event.stopPropagation === 'function') {
          d3.event.stopPropagation()
        }
        onHostnameNodeClick(d.originalHostname, -1)
      })

    hostItems.each(function (hostData: any) {
      const currentHost = d3.select(this)
      const gpuContainer = currentHost
        .append('div')
        .attr('class', 'treemap-gpu-container')

      hostData.children.forEach((gpuData: any) => {
        const gpuDiv = gpuContainer
          .append('div')
          .attr('class', 'treemap-gpu-node')
          .style('border', () => {
            if (
              filteredHostForGPUMonitoring &&
              hostData.originalHostname ===
                filteredHostForGPUMonitoring.hostname &&
              gpuData.gpuIndex === filteredHostForGPUMonitoring.gpuIndex
            ) {
              return FILTERED_HOST_BORDER
            }
            return null
          })
          .on('click', function () {
            if (d3.event && typeof d3.event.stopPropagation === 'function') {
              d3.event.stopPropagation()
            }
            onGPUIndexNodeClick(hostData.originalHostname, gpuData.gpuIndex)
          })

        const currentGPUSmiData =
          gpuData.gpuSmi ||
          (finalGPUSmiData[hostData.originalHostname] || []).find(
            (item: any) => item.gpuIndex === gpuData.gpuIndex
          )
        if (currentGPUSmiData) {
          let memoryUsagePercent = 0
          if (
            currentGPUSmiData.migMode &&
            currentGPUSmiData.migMode.toLowerCase() === 'enabled'
          ) {
            if (currentGPUSmiData.gpuMemoryTotal > 0) {
              memoryUsagePercent =
                (currentGPUSmiData.gpuMemoryUsed /
                  currentGPUSmiData.gpuMemoryTotal) *
                100
            } else {
              memoryUsagePercent = 0
            }
          } else if (currentGPUSmiData.gpuMemoryUtilization !== undefined) {
            memoryUsagePercent = currentGPUSmiData.gpuMemoryUtilization
          }
          const gpuTemperaturePercent = calculateTemperaturePercent(
            currentGPUSmiData.gpuTemperature,
            currentGPUSmiData.gpuTemperatureMaxThreshold
          )
          const gpuMemTemperaturePercent = calculateTemperaturePercent(
            currentGPUSmiData.gpuMemoryTemperature,
            currentGPUSmiData.gpuMemoryTemperatureMaxThreshold
          )
          let gpuPowerUsagePercent = 0
          if (currentGPUSmiData.gpuCurrentPowerLimit > 0) {
            gpuPowerUsagePercent =
              (currentGPUSmiData.gpuPowerDraw /
                currentGPUSmiData.gpuCurrentPowerLimit) *
              100
          } else {
            gpuPowerUsagePercent = 0
          }
          let combinedTxRxData = 0
          if (
            currentGPUSmiData.pcieLinkCurrentGeneration != -1 &&
            currentGPUSmiData.pcieLinkCurrentWidth != -1 &&
            currentGPUSmiData.pcieLinkTx != -1 &&
            currentGPUSmiData.pcieLinkRx != -1
          ) {
            const pcieGeneration = currentGPUSmiData.pcieLinkCurrentGeneration
            const pcieWidth = currentGPUSmiData.pcieLinkCurrentWidth
            const maxSpeedMBps = PCIE_GENERATION_SPEED[pcieGeneration] || 0
            if (maxSpeedMBps > 0 && pcieWidth > 0) {
              const totalMaxBandwidth = maxSpeedMBps * pcieWidth
              const totalMaxBandwidthBytes = totalMaxBandwidth * 1e6
              combinedTxRxData =
                ((currentGPUSmiData.pcieLinkTx + currentGPUSmiData.pcieLinkRx) /
                  totalMaxBandwidthBytes) *
                100
            }
          }
          const gpuUtilization = currentGPUSmiData.gpuUtilization

          const finalUsageRatio = Math.max(
            memoryUsagePercent,
            gpuTemperaturePercent,
            gpuMemTemperaturePercent,
            gpuPowerUsagePercent,
            combinedTxRxData,
            gpuUtilization
          )
          const dynamicColor = colorScaleForGPUMonitoring(finalUsageRatio)
          gpuDiv.style('background', dynamicColor)

          const innerContainer = gpuDiv
            .append('div')
            .attr('class', 'treemap-inner-container')
          if (finalUsageRatio >= GPU_MONITORING_CRITICAL_VALUE) {
            innerContainer.classed('gpu-monitoring-tooltip--blink', true)
          }

          gpuDiv
            .on('mouseenter', function () {
              if (!parentRef.current) return
              const parentRect = parentRef.current.getBoundingClientRect()
              const tempPosition = {
                x: d3.event.clientX - parentRect.left,
                y: d3.event.clientY - parentRect.top,
              }
              const trimmedHostName = hostData.name.split(':')[0].trim()
              const tooltipRows = [
                {title: 'GPU Memory', value: memoryUsagePercent},
                {title: 'GPU Temp (°C)', value: gpuTemperaturePercent},
                {
                  title: 'GPU Memory Temp (°C)',
                  value: gpuMemTemperaturePercent,
                },
                {title: 'Pwr Consumption', value: gpuPowerUsagePercent},
                {title: 'PCIe Traffic', value: combinedTxRxData},
              ]
              if (
                currentGPUSmiData.migMode &&
                currentGPUSmiData.migMode.toLowerCase() === 'disabled'
              ) {
                tooltipRows.unshift({
                  title: 'GPU Utilization',
                  value: gpuUtilization,
                })
              }
              setTooltipNode({
                name: `${trimmedHostName} (GPU ${gpuData.gpuIndex})`,
                rows: tooltipRows,
              })
              setTooltipPosition(tempPosition)
              setIsMouseOn(true)
            })
            .on('mouseleave', function () {
              setIsMouseOn(false)
            })
        }

        gpuDiv
          .append('div')
          .attr('class', 'treemap-gpu-label')
          .text(`# ${gpuData.gpuIndex}`)

        if (gpuData.children) {
          const innerContainer = gpuDiv.select('.treemap-inner-container')
          const rect = (innerContainer.node() as HTMLElement).getBoundingClientRect()
          const treemapWidth = rect.width
          const treemapHeight = rect.height

          const localRoot = d3
            .hierarchy(gpuData, (d: any) => d.children)
            .sum((d: any) => (d.value ? d.value : 0))

          const localTreemap = d3
            .treemap()
            .tile(customTileMethod)
            .size([treemapWidth, treemapHeight])
            .paddingInner(1)
          localTreemap(localRoot)

          innerContainer
            .selectAll('.treemap-node')
            .data(localRoot.descendants().filter((d: any) => d.depth === 2))
            .enter()
            .append('div')
            .attr('class', 'treemap-node')
            .classed('ci-node', (d: any) => d.parent.data.name === 'CI Row')
            .style('left', function (d: any) {
              const siblings = d.parent.children
              const index = siblings.indexOf(d)
              const allocatedLeft = siblings
                .slice(0, index)
                .reduce(
                  (acc: number, sibling: any) =>
                    acc + (sibling.data.value / d.parent.data.value) * 100,
                  0
                )
              return allocatedLeft + '%'
            })
            .style(
              'top',
              (d: any) => d.y0 + GAP_BETWEEN_GPU_LABEL_AND_GPU_NODE + 'px'
            )
            .style(
              'width',
              (d: any) => (d.data.value / d.parent.data.value) * 100 + '%'
            )
            .style('background', (d: any) => {
              const usage = computeGiCiUsage(d)
              return d.data.unused
                ? REPEATING_LINEAR_GRADIENT_STYLE
                : colorScaleForGPUMonitoring(usage)
            })
            .classed('gpu-monitoring-tooltip--blink', (d: any) => {
              return computeGiCiUsage(d) >= GPU_MONITORING_CRITICAL_VALUE
            })
            .on('mouseenter', function (d: any) {
              if (d.data.unused) return
              if (!parentRef.current) return
              const parentRect = parentRef.current.getBoundingClientRect()
              const tempPosition = {
                x: d3.event.clientX - parentRect.left,
                y: d3.event.clientY - parentRect.top,
              }
              let tooltipRows = []

              if (d.data.ci !== undefined) {
                const fbUsage = d.data.frameBufferTotalGB
                  ? (d.data.used / d.data.frameBufferTotalGB) * 100
                  : 0
                const bar1Usage = d.data.bar1MemoryTotalGB
                  ? (d.data.bar1MemoryUsedGB / d.data.bar1MemoryTotalGB) * 100
                  : 0

                tooltipRows = [
                  {
                    title: 'Frame Buffer Memory',
                    value: fbUsage,
                  },
                  {
                    title: 'Bar1 Memory',
                    value: bar1Usage,
                  },
                ]
              } else if (d.data.gi !== undefined && d.data.ci === undefined) {
                const fbUsage = d.data.frameBufferTotalGB
                  ? (d.data.frameBufferUsedGB / d.data.frameBufferTotalGB) * 100
                  : 0
                const bar1Usage = d.data.bar1MemoryTotalGB
                  ? (d.data.bar1MemoryUsedGB / d.data.bar1MemoryTotalGB) * 100
                  : 0

                tooltipRows = [
                  {
                    title: 'Frame Buffer Memory',
                    value: fbUsage,
                  },
                  {
                    title: 'Bar1 Memory',
                    value: bar1Usage,
                  },
                ]
              }

              const trimmedHostName = hostData.name.split(':')[0].trim()
              setTooltipNode({
                name: `${trimmedHostName} (${d.data.name})`,
                rows: tooltipRows,
              })
              setTooltipPosition(tempPosition)
              setIsMouseOn(true)
            })
            .on('mouseleave', function (d: any) {
              if (d.data.unused) return
              setIsMouseOn(false)
            })
        }
      })
    })
  }, [
    finalGPUSmiData,
    finalGPUSmiMIGData,
    finalMigProfilesData,
    minionHostnameMapping,
    filteredHostForGPUMonitoring,
  ])

  const computeGiCiUsage = (d: any): number => {
    if (d.data.unused) return 0
    if (d.data.ci !== undefined) {
      const fbUsage = d.data.frameBufferTotalGB
        ? (d.data.used / d.data.frameBufferTotalGB) * 100
        : 0
      const bar1Usage = d.data.bar1MemoryTotalGB
        ? (d.data.bar1MemoryUsedGB / d.data.bar1MemoryTotalGB) * 100
        : 0

      return Math.max(fbUsage, bar1Usage)
    } else if (d.data.gi !== undefined && d.data.ci === undefined) {
      const fbUsage = d.data.frameBufferTotalGB
        ? (d.data.frameBufferUsedGB / d.data.frameBufferTotalGB) * 100
        : 0
      const bar1Usage = d.data.bar1MemoryTotalGB
        ? (d.data.bar1MemoryUsedGB / d.data.bar1MemoryTotalGB) * 100
        : 0

      return Math.max(fbUsage, bar1Usage)
    } else if (
      d.data.used !== undefined &&
      d.data.total !== undefined &&
      d.data.total > 0
    ) {
      return (d.data.used / d.data.total) * 100
    }
    return 0
  }

  const createHostData = (hostname: string) => {
    const displayHostname = minionHostnameMapping[hostname] || hostname
    const hostData: any = {
      name: displayHostname,
      originalHostname: hostname,
      children: [],
    }
    const hostGpuData = finalGPUSmiData[hostname] || []

    hostGpuData.forEach(gpuInfo => {
      const gpuIndex = gpuInfo.gpuIndex
      const gpuRows = (finalGPUSmiMIGData[hostname] || []).filter(
        d => d.gpuIndex === gpuIndex
      )
      const isMigDisabled =
        gpuInfo.migMode && gpuInfo.migMode.toLowerCase() === 'disabled'

      if (!isMigDisabled) {
        if (gpuRows.length > 0) {
          const applicableProfiles = finalMigProfilesData[hostname] || []
          const unitSegment =
            applicableProfiles.length > 0
              ? d3.min(applicableProfiles, (d: any) => d.memGiB)
              : DEFAULT_UNIT_SEGMENT
          const totalSegments = Math.floor(gpuInfo.gpuMemoryTotal / unitSegment)
          const giMap: Record<string, any[]> = {}

          gpuRows.forEach((row: any) => {
            const gi = row.gi
            if (!giMap[gi]) giMap[gi] = []
            giMap[gi].push(row)
          })

          let totalAllocatedSegments = 0
          const giNodes: any[] = []
          const ciNodes: any[] = []

          Object.keys(giMap)
            .sort((a, b) => +a - +b)
            .forEach(giKey => {
              const rows = giMap[giKey]
              let frameBufferTotalGB = rows[0].fbTotal / BYTES_PER_GB
              let bar1MemoryTotalGB = rows[0].bar1Total / BYTES_PER_GB
              const allocated =
                Math.floor((frameBufferTotalGB + unitSegment) / unitSegment) *
                unitSegment
              const segmentsForGi = Math.max(
                1,
                Math.floor(allocated / unitSegment)
              )

              totalAllocatedSegments += segmentsForGi

              let frameBufferUsedGB = 0
              let bar1MemoryUsedGB = 0

              if (rows.length > 1) {
                const expectedCiCountForGi = segmentsForGi
                const eachCiValue = allocated / expectedCiCountForGi
                let normalizedFBUsed = 0
                let normalizedBar1Used = 0

                rows.forEach((row: any) => {
                  const rowFbTotalGB = row.fbTotal / BYTES_PER_GB
                  const rowBar1TotalGB = row.bar1Total / BYTES_PER_GB
                  const rowFbUsedGB = row.fbUsed / BYTES_PER_GB
                  const rowBar1UsedGB = row.bar1Used / BYTES_PER_GB

                  normalizedFBUsed += rowFbTotalGB
                    ? (rowFbUsedGB / rowFbTotalGB) * eachCiValue
                    : 0
                  normalizedBar1Used += rowBar1TotalGB
                    ? (rowBar1UsedGB / rowBar1TotalGB) * eachCiValue
                    : 0
                })
                frameBufferUsedGB = normalizedFBUsed
                bar1MemoryUsedGB = normalizedBar1Used
                frameBufferTotalGB = allocated
                bar1MemoryTotalGB = allocated
              } else {
                const row = rows[0]
                frameBufferUsedGB = row.fbUsed / BYTES_PER_GB
                bar1MemoryUsedGB = row.bar1Used / BYTES_PER_GB
              }

              giNodes.push({
                name: `GI ${giKey}`,
                value: allocated,
                gi: +giKey,
                frameBufferTotalGB,
                frameBufferUsedGB,
                bar1MemoryTotalGB,
                bar1MemoryUsedGB,
                mapping: rows.length === 1 ? '1:1' : '1:many',
              })

              if (rows.length === 1) {
                const row = rows[0]
                ciNodes.push({
                  name: `CI ${row.ci}`,
                  value: allocated,
                  ci: row.ci,
                  gi: +giKey,
                  gpuIndex,
                  used: row.fbUsed / BYTES_PER_GB,
                  frameBufferTotalGB: row.fbTotal / BYTES_PER_GB,
                  bar1MemoryUsedGB: row.bar1Used / BYTES_PER_GB,
                  bar1MemoryTotalGB: row.bar1Total / BYTES_PER_GB,
                  mapping: '1:1',
                })
              } else {
                const expectedCiCountForGi = segmentsForGi
                const eachCiValue = allocated / expectedCiCountForGi

                rows.forEach((row: any) => {
                  ciNodes.push({
                    name: `CI ${row.ci}`,
                    value: eachCiValue,
                    ci: row.ci,
                    gi: +giKey,
                    gpuIndex,
                    used: row.fbUsed / BYTES_PER_GB,
                    frameBufferTotalGB: row.fbTotal / BYTES_PER_GB,
                    bar1MemoryUsedGB: row.bar1Used / BYTES_PER_GB,
                    bar1MemoryTotalGB: row.bar1Total / BYTES_PER_GB,
                    mapping: '1:many',
                  })
                })
                if (rows.length < expectedCiCountForGi) {
                  const missing = expectedCiCountForGi - rows.length
                  for (let i = 0; i < missing; i++) {
                    ciNodes.push({
                      name: 'Unused',
                      value: eachCiValue,
                      unused: true,
                      mapping: '1:many',
                    })
                  }
                }
              }
            })

          const leftoverSegments = totalSegments - totalAllocatedSegments
          if (leftoverSegments > 0) {
            for (let i = 0; i < leftoverSegments; i++) {
              giNodes.push({
                name: 'Unused',
                value: unitSegment,
                unused: true,
              })
            }
            for (let i = 0; i < leftoverSegments; i++) {
              ciNodes.push({
                name: 'Unused',
                value: unitSegment,
                unused: true,
                mapping: 'unused',
              })
            }
          }

          const rowTotalValue = giNodes.reduce(
            (acc: number, node) => acc + node.value,
            0
          )
          hostData.children.push({
            name: `GPU ${gpuIndex} (Compute: ${gpuInfo.gpuMemoryTotal}GB, Unit: ${unitSegment}GB)`,
            gpuIndex,
            computeTotal: gpuInfo.gpuMemoryTotal,
            unused: false,
            unitSegment,
            totalSegments,
            value: rowTotalValue * 2,
            children: [
              {name: 'GI Row', value: rowTotalValue, children: giNodes},
              {name: 'CI Row', value: rowTotalValue, children: ciNodes},
            ],
          })
        }
      } else {
        const totalMem = gpuInfo.gpuMemoryTotal
        hostData.children.push({
          name: `GPU ${gpuIndex} (MIG Disabled, Compute: ${totalMem}GB)`,
          gpuIndex,
          unused: true,
          gpuSmi: gpuInfo,
          value: totalMem * 2,
        })
      }
    })
    return hostData
  }

  const customTileMethod = (
    node: any,
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ) => {
    if (node.depth === 0 && node.children && node.children.length === 2) {
      const mid = y0 + (y1 - y0) / 2
      node.children[0].x0 = x0
      node.children[0].y0 = y0
      node.children[0].x1 = x1
      node.children[0].y1 = mid
      node.children[1].x0 = x0
      node.children[1].y0 = mid
      node.children[1].x1 = x1
      node.children[1].y1 = y1
      node.children.forEach((child: any) => {
        if (child.children) {
          d3.treemapDice(child, child.x0, child.y0, child.x1, child.y1)
        }
      })
    } else {
      return d3.treemapDice(node, x0, y0, x1, y1)
    }
  }

  const renderTooltip = (tooltip: NVidiaSmiMonitoringTooltipNode) => {
    const pos = adjustedTooltipPosition

    return (
      <div
        className={`gpu-monitoring-tooltip ${isMouseOn ? 'active' : 'hidden'}`}
        ref={childrenRef}
        style={{top: `${pos.y}px`, left: `${pos.x}px`}}
      >
        <NVidiaDataMonitoringTooltip
          name={tooltip.name}
          rows={tooltip.rows}
          isSelected={true}
        />
      </div>
    )
  }

  return (
    <div
      style={{height: 'calc(100% - 45px)', position: 'relative'}}
      ref={parentRef}
      id="gpu-monitoring-treemap"
    >
      <FancyScrollbar style={{height: '100%'}} autoHide={true}>
        <div>
          <div ref={containerRef} />
        </div>
      </FancyScrollbar>
      {renderTooltip(tooltipNode)}
    </div>
  )
}

export default GPUMonitoringTreeMap
