// libraries
import React, {FunctionComponent} from 'react'
import _ from 'lodash'

// types
import {OpenStackPage} from 'src/clouds/containers/OpenStackPage'
import {FocusedProject, OpenStackProject} from 'src/clouds/types/openstack'

interface Props {
  project: OpenStackProject
  focusedProject: FocusedProject
  tableOrder: string[]
  onClickTableRow: OpenStackPage['handleClickProjectTableRow']
}

const OpenStackPageProjectTableRow: FunctionComponent<Props> = ({
  project = {} as OpenStackProject,
  focusedProject = null,
  tableOrder = [],
  onClickTableRow,
}) => {
  const cloudResourceLength = tableOrder.length
  const projectRowWiddth = (100 / cloudResourceLength) * 2
  const resourceRowWidth = 100 / cloudResourceLength

  const usageProgressIndacator = ({
    value,
  }: {
    value: string | number | React.ReactText
  }): JSX.Element => {
    if (!value) return
    const numValue = parseInt(value.toString())
    return (
      <div className="UsageIndacator-container">
        <div
          style={{
            width: '100%',
            position: 'relative',
            height: '2px',
            backgroundColor: '#00C9FF',
          }}
          className="UsageIndacator-background"
        >
          <div
            style={{width: `${numValue}%`, background: '#bf3d5e'}}
            className="UsageIndacator UsageIndacator"
          ></div>
        </div>
      </div>
    )
  }

  const getPageTableRow = () => {
    return tableOrder.map(cloudResource => {
      const _cloudResource = cloudResource.replace(/ /g, '')
      const lowwerCaseProjectData = Object.keys(
        project?.projectData.row
      ).reduce((accumulator, key) => {
        accumulator[key.toLowerCase()] = project?.projectData.row[key]
        return accumulator
      }, {})

      const gaugeData = lowwerCaseProjectData[_cloudResource.toLowerCase()]
      const resourceUsuage = gaugeData?.resourceUsuage
      const gaugePosition = gaugeData?.gaugePosition

      return (
        <div
          key={cloudResource}
          className="hosts-table--td"
          style={{
            width: `${resourceRowWidth}%`,
            flexDirection: 'column',
            padding: '0.7% 0.6% 0.6%',
            textAlign: 'center',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '30%',
            }}
          >
            {usageProgressIndacator({value: gaugePosition})}
          </div>
          <div
            style={{
              width: '100%',
              height: '70%',
              textAlign: 'center',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {resourceUsuage}
          </div>
        </div>
      )
    })
  }

  const focusedClasses = (): string => {
    if (project.projectData.projectName === focusedProject)
      return 'hosts-table--tr focused'
    return 'hosts-table--tr'
  }

  return (
    <div
      className={focusedClasses()}
      onClick={onClickTableRow(
        project.projectData.projectName as FocusedProject
      )}
    >
      <div
        className="hosts-table--td"
        style={{width: `${projectRowWiddth}%`, justifyContent: 'center'}}
      >
        {project.projectData.projectName}
      </div>
      {getPageTableRow()}
    </div>
  )
}
export default OpenStackPageProjectTableRow
