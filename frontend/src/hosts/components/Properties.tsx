import React, {PureComponent} from 'react'

import {Input} from 'src/reusable_ui'
import {TableBody, TableBodyRowItem} from 'src/addon/128t/reusable/layout'
import InputClickToEdit from 'src/shared/components/InputClickToEdit'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {ITNodeInfo} from 'src/hosts/containers/InventoryTopology'

interface Props {
  focusedNode?: ITNodeInfo
}

class Properties extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {focusedNode} = this.props
    const {id, name, label, href} = focusedNode
    return (
      <FancyScrollbar>
        <TableBody>
          <>
            <div className="hosts-table--tr">
              <div
                className={'hosts-table--th align--start'}
                style={{width: '80px'}}
              >
                ID
              </div>
              <TableBodyRowItem
                title={
                  <InputClickToEdit
                    value={id}
                    wrapperClass="fancytable--td properties-table--name"
                    onChange={() => {}}
                    onBlur={() => {}}
                    tabIndex={0}
                    placeholder="insert node name"
                  />
                }
                width={`calc(100% - ${'80px'})`}
                className={'align--start'}
              />
            </div>
            <div className="hosts-table--tr">
              <div
                className={'hosts-table--th align--start'}
                style={{width: '80px'}}
              >
                Name
              </div>
              <TableBodyRowItem
                title={
                  <InputClickToEdit
                    value={name}
                    wrapperClass="fancytable--td properties-table--name"
                    onChange={() => {}}
                    onBlur={() => {}}
                    tabIndex={0}
                    placeholder="insert node name"
                  />
                }
                width={`calc(100% - ${'80px'})`}
                className={'align--start'}
              />
            </div>
            <div className="hosts-table--tr">
              <div
                className={'hosts-table--th align--start'}
                style={{width: '80px'}}
              >
                Label
              </div>
              <TableBodyRowItem
                title={
                  <InputClickToEdit
                    value={label}
                    wrapperClass="fancytable--td properties-table--name"
                    onChange={() => {}}
                    onBlur={() => {}}
                    tabIndex={0}
                    placeholder="insert node label"
                  />
                }
                width={`calc(100% - ${'80px'})`}
                className={'align--start'}
              />
            </div>
            <div className="hosts-table--tr">
              <div
                className={'hosts-table--th align--start'}
                style={{width: '80px'}}
              >
                Link
              </div>
              <TableBodyRowItem
                title={
                  <InputClickToEdit
                    value={href}
                    wrapperClass="fancytable--td properties-table--name"
                    onChange={() => {}}
                    onBlur={() => {}}
                    tabIndex={0}
                    placeholder="insert hyper link"
                  />
                }
                width={`calc(100% - ${'80px'})`}
                className={'align--start'}
              />
            </div>
          </>
        </TableBody>
      </FancyScrollbar>
    )
  }
}

export default Properties
