import React, {Component} from 'react'
import classnames from 'classnames'
import chroma from 'chroma-js'
import {isCellUntitled} from 'src/dashboards/utils/cellGetters'
import {DEFAULT_CELL_BG_COLOR} from 'src/dashboards/constants'
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  isEditable: boolean
  cellName: string
  makeSpaceForCellNote: boolean
  cellBackgroundColor: string
  cellTextColor: string
  /**
   * When given, the name turns into a click-to-edit field. Cells that own their
   * header (rendered through the cell registry) use this because they bypass
   * LayoutCell and so never reach the cell editor overlay.
   */
  onRename?: (name: string) => void
}

interface State {
  isEditing: boolean
  draft: string
}

@ErrorHandling
class LayoutCellHeader extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {isEditing: false, draft: props.cellName}
  }

  public render() {
    return (
      <div className={this.headingClass}>
        {this.cellName}
        {this.headingBar}
      </div>
    )
  }

  private get isRenamable(): boolean {
    const {isEditable, onRename} = this.props

    return isEditable && !!onRename
  }

  private get headingClass(): string {
    const {isEditable} = this.props

    return classnames('dash-graph--heading', {
      'dash-graph--draggable': isEditable,
      'dash-graph--heading-draggable': isEditable,
    })
  }

  private get cellName(): JSX.Element {
    const {
      cellName,
      makeSpaceForCellNote,
      cellTextColor,
      cellBackgroundColor,
    } = this.props

    const className = classnames('dash-graph--name', {
      'dash-graph--name__default': isCellUntitled(cellName),
      'dash-graph--name__note': makeSpaceForCellNote,
      'dash-graph--name__renamable': this.isRenamable,
    })

    let nameStyle = {}

    if (cellBackgroundColor !== DEFAULT_CELL_BG_COLOR) {
      nameStyle = {
        color: cellTextColor,
      }
    }

    if (this.state.isEditing) {
      return (
        <input
          className="dash-graph--name-input"
          style={nameStyle}
          value={this.state.draft}
          size={Math.max(this.state.draft.length + 2, 12)}
          autoFocus={true}
          onChange={this.handleChange}
          onBlur={this.handleCommit}
          onKeyDown={this.handleKeyDown}
          // The heading is the grid's drag handle; without this a click to
          // place the caret starts dragging the cell instead.
          onMouseDown={this.stopPropagation}
          onClick={this.stopPropagation}
        />
      )
    }

    return (
      <span
        className={className}
        style={nameStyle}
        onClick={this.isRenamable ? this.handleStartEditing : undefined}
        title={this.isRenamable ? 'Click to rename' : undefined}
      >
        {cellName}
      </span>
    )
  }

  private stopPropagation = (
    event: React.MouseEvent<HTMLElement>
  ): void => {
    event.stopPropagation()
  }

  private handleStartEditing = (
    event: React.MouseEvent<HTMLElement>
  ): void => {
    event.stopPropagation()
    this.setState({isEditing: true, draft: this.props.cellName})
  }

  private handleChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    this.setState({draft: event.target.value})
  }

  private handleCommit = (): void => {
    const {cellName, onRename} = this.props
    const name = this.state.draft.trim()

    this.setState({isEditing: false})

    // An empty name would leave the cell with no handle to grab it by.
    if (!name || name === cellName) {
      return
    }

    onRename(name)
  }

  private handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ): void => {
    if (event.key === 'Enter') {
      this.handleCommit()
      return
    }
    if (event.key === 'Escape') {
      this.setState({isEditing: false, draft: this.props.cellName})
    }
  }

  private get headingBar(): JSX.Element {
    const {isEditable, cellBackgroundColor} = this.props

    if (isEditable) {
      let barStyle

      if (cellBackgroundColor !== DEFAULT_CELL_BG_COLOR) {
        barStyle = {
          backgroundColor: chroma(cellBackgroundColor).brighten(),
        }
      }

      return (
        <>
          <div className="dash-graph--heading-bar" style={barStyle} />
          <div className="dash-graph--heading-dragger" />
        </>
      )
    }
  }
}

export default LayoutCellHeader
