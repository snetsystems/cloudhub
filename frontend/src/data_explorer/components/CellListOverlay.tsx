import React, {PureComponent} from 'react'

import {
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
  Form,
  Button,
} from 'src/reusable_ui'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

import CellList from 'src/server_details/components/CellList'
import {deleteDashboardItem} from 'src/dashboards/apis'
import {
  notifyDashboardItemDeleted,
  notifyDashboardItemDeleteFailed,
} from 'src/shared/copy/notifications'
import {DashboardItem} from 'src/types/dashboards'
import {Notification} from 'src/types'

interface Props {
  onCancel: () => void
  onEditItem: (item: DashboardItem) => void
  notify: (message: Notification) => void
  selectedItemId?: string
}

class CellListOverlay extends PureComponent<Props> {
  public render() {
    const {onCancel, onEditItem, selectedItemId} = this.props

    return (
      <OverlayContainer>
        <OverlayHeading title="Cell List" onDismiss={onCancel} />
        <OverlayBody>
          <Form>
            <Form.Element>
              <div className="cell-list-overlay-container">
                <FancyScrollbar autoHeight={false}>
                  <CellList
                    mode="manage"
                    selectedItemId={selectedItemId}
                    onEditItem={onEditItem}
                    onDeleteItem={this.handleDeleteItem}
                  />
                </FancyScrollbar>
              </div>
            </Form.Element>
            <Form.Footer>
              <Button text="Close" onClick={onCancel} />
            </Form.Footer>
          </Form>
        </OverlayBody>
      </OverlayContainer>
    )
  }

  private handleDeleteItem = async (item: DashboardItem) => {
    const {notify} = this.props
    try {
      await deleteDashboardItem(item.id)
      notify(notifyDashboardItemDeleted(item.name))
    } catch {
      notify(notifyDashboardItemDeleteFailed(item.name))
      throw new Error('delete dashboard item failed')
    }
  }
}

export default CellListOverlay
