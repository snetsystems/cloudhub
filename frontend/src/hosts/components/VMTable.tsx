import React from 'react'
import {
  CellName,
  HeadingBar,
  PanelHeader,
  Panel,
  PanelBody,
  Table,
  TableHeader,
  TableBody,
  TableBodyRowItem,
} from 'src/addon/128t/reusable/layout'
import {ProgressDisplay} from 'src/shared/components/ProgressDisplay'

interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
}

const VMTable = (props: Props): JSX.Element => {
  const {isEditable, cellTextColor, cellBackgroundColor} = props
  const Header = (): JSX.Element => {
    return (
      <>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '20%'}}
        >
          Host
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '20%'}}
        >
          CPU
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '20%'}}
        >
          Memory
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '20%'}}
        >
          Storage
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '6.6%'}}
        >
          VM
        </div>

        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '6.6%'}}
        >
          Model
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '6.6%'}}
        >
          Processor
        </div>
      </>
    )
  }

  const Body = (): JSX.Element => {
    return (
      <div className="hosts-table--tr">
        <TableBodyRowItem
          title={
            <div
              onClick={() => {
                console.log('host click')
              }}
            >
              192.168.34.26
            </div>
          }
          width={'20%'}
          className={'align--center'}
        />
        <TableBodyRowItem
          title={
            <ProgressDisplay
              unit={'CPU'}
              use={80}
              available={800}
              total={880}
            />
          }
          width={'20%'}
          className={'align--center'}
        />
        <TableBodyRowItem
          title={
            <ProgressDisplay
              unit={'Memory'}
              use={12000}
              available={12000}
              total={24000}
            />
          }
          width={'20%'}
          className={'align--center'}
        />
        <TableBodyRowItem
          title={
            <ProgressDisplay
              unit={'Storage'}
              use={78000}
              available={10000}
              total={88000}
            />
          }
          width={'20%'}
          className={'align--center'}
        />
        <TableBodyRowItem title={'5'} width={'6.6%'} className={'align--end'} />
        <TableBodyRowItem
          title={'Dell inc. PowerEdge R710'}
          width={'6.6%'}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={'intel(R) Xenon(R) CPU E5749 @ 2.53 GHz'}
          width={'6.6%'}
          className={'align--end'}
        />
      </div>
    )
  }

  return (
    <Panel>
      <PanelHeader isEditable={isEditable}>
        <CellName
          cellTextColor={cellTextColor}
          cellBackgroundColor={cellBackgroundColor}
          value={[]}
          name={'Virtual Machine'}
          sizeVisible={false}
        />
        <HeadingBar
          isEditable={isEditable}
          cellBackgroundColor={cellBackgroundColor}
        />
      </PanelHeader>
      <PanelBody>
        <Table>
          <TableHeader>
            <Header />
          </TableHeader>
          <TableBody>
            <Body />
          </TableBody>
        </Table>
      </PanelBody>
    </Panel>
  )
}

export default VMTable
