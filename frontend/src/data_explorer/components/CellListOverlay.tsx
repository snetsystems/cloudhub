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
import {deleteLibraryCell} from 'src/dashboards/apis'
import {
  notifyLibraryCellDeleted,
  notifyLibraryCellDeleteFailed,
} from 'src/shared/copy/notifications'
import {LibraryCell} from 'src/types/dashboards'
import {Notification} from 'src/types'

interface Props {
  onCancel: () => void
  onEditItem: (item: LibraryCell) => void
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
                <FancyScrollbar
                  autoHeight={true}
                  minHeight={100}
                  maxHeight="70vh"
                  className="cell-list-overlay-scrollbar"
                >
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

  private handleDeleteItem = async (item: LibraryCell) => {
    const {notify} = this.props
    try {
      await deleteLibraryCell(item.id)
      notify(notifyLibraryCellDeleted(item.name))
    } catch {
      notify(notifyLibraryCellDeleteFailed(item.name))
      throw new Error('delete library cell failed')
    }
  }
}

export default CellListOverlay
