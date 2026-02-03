import React, {PureComponent} from 'react'
import ReactTooltip from 'react-tooltip'

import {ErrorHandling} from 'src/shared/decorators/errors'
import TemplatePreviewList from 'src/tempVars/components/TemplatePreviewList'
import SlideToggle from 'src/reusable_ui/components/slide_toggle/SlideToggle'
import {ComponentSize, ComponentColor} from 'src/reusable_ui/types'
import QuestionMarkTooltip from 'src/shared/components/QuestionMarkTooltip'

import {
  RemoteDataState,
  TemplateValue,
  TemplateType,
  TemplateValueType,
} from 'src/types'

interface Props {
  items: TemplateValue[]
  loadingStatus: RemoteDataState
  onUpdateDefaultTemplateValue: (item: TemplateValue) => void
  templateType?: TemplateType
  onUpdateAllOption?: (isAllEnabled: boolean) => void
  isAllEnabled?: boolean
}

interface State {
  isAllEnabled: boolean
}

@ErrorHandling
class TemplateMetaQueryPreview extends PureComponent<Props, State> {
  private tooltipIconRef: HTMLDivElement | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      isAllEnabled: props.isAllEnabled || false,
    }
  }

  public componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevProps.isAllEnabled !== this.props.isAllEnabled) {
      this.setState({
        isAllEnabled: this.props.isAllEnabled || false,
      })
    }

    if (prevState.isAllEnabled !== this.state.isAllEnabled) {
      this.showTooltipAutomatically()
    }
  }

  public render() {
    const {
      items,
      loadingStatus,
      onUpdateDefaultTemplateValue,
      templateType,
    } = this.props
    const {isAllEnabled} = this.state

    if (loadingStatus === RemoteDataState.NotStarted) {
      return null
    }

    if (loadingStatus === RemoteDataState.Loading) {
      return (
        <div className="form-group col-xs-12 temp-builder--results">
          <p className="temp-builder--validation loading">
            Loading Meta Query preview...
          </p>
        </div>
      )
    }

    if (loadingStatus === RemoteDataState.Error) {
      return (
        <div className="form-group col-xs-12 temp-builder--results">
          <p className="temp-builder--validation error">
            Meta Query failed to execute
          </p>
        </div>
      )
    }

    if (items.length === 0) {
      return (
        <div className="form-group col-xs-12 temp-builder--results">
          <p className="temp-builder--validation warning">
            Meta Query is syntactically correct but returned no results
          </p>
        </div>
      )
    }

    const pluralizer = items.length === 1 ? '' : 's'
    const isTagValues = templateType === TemplateType.TagValues

    const displayItems = this.getDisplayItems(items, isAllEnabled, isTagValues)
    return (
      <div className="form-group col-xs-12 temp-builder--results">
        <p
          className="temp-builder--validation"
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '8px',
            minHeight: '24px',
          }}
        >
          {isTagValues && (
            <span style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <SlideToggle
                active={isAllEnabled}
                onChange={this.handleToggleAll}
                size={ComponentSize.ExtraSmall}
                color={ComponentColor.Primary}
              />
              <label style={{margin: 0}}>
                {isAllEnabled ? 'Remove "All" Option' : 'Add "All" Option'}
              </label>
              <div ref={ref => (this.tooltipIconRef = ref)}>
                <QuestionMarkTooltip
                  tipID="all-option-tooltip"
                  tipContent={
                    isAllEnabled
                      ? '<h1>All Option Usage:</h1><p>When using All Option, you must use regular expressions.</p><p>You <strong>must include a space</strong> after <code>=~</code>.</p><h1>Examples:</h1><p><strong>Single Query:</strong><br/><code>"host" =~ /^hostName1$/</code></p><p><strong>Compound Query:</strong><br/><code>"host" =~ /^hostName1|hostName2$/</code></p><p><strong>All Query:</strong><br/><code>"host" =~ /.*/</code></p>'
                      : '<h1>Regular Query Usage:</h1><p>When <strong>not</strong> using the All Option, you must specify exact values or explicit patterns.</p><p>You can use an exact match (<code>=</code>), a negative match (<code>!=</code>).</p><h1>Examples:</h1><p><strong>Single Exact Query:</strong><br/><code>"host" = "hostName1"</code></p><p><strong>Single Negative Query:</strong><br/><code>"host" != "hostName1"</code></p><p><strong>Compound Regex Query:</strong><br/><code>WHERE ("host" = "hostName1" OR "host" = "hostName2")</code></p>'
                  }
                  customClass="all-option-tooltip"
                  clickToClose={true}
                />
              </div>
            </span>
          )}

          <span
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            Meta Query returned{' '}
            <strong style={{color: '#9394ff'}}>{items.length}</strong> value
            {pluralizer}
          </span>
        </p>

        <TemplatePreviewList
          items={displayItems}
          onUpdateDefaultTemplateValue={onUpdateDefaultTemplateValue}
        />
      </div>
    )
  }

  private getDisplayItems = (
    items: TemplateValue[],
    isAllEnabled: boolean,
    isTagValues: boolean
  ): TemplateValue[] => {
    if (!isTagValues || !isAllEnabled) {
      return items
    }

    const hasAll = items.some(item => item.value === 'allTagValues')

    if (hasAll) {
      return items
    }

    const allValue: TemplateValue = {
      value: 'allTagValues',
      type: TemplateValueType.TagValue,
      selected: false,
      localSelected: false,
    }

    return [allValue, ...items]
  }

  private handleToggleAll = (): void => {
    const {onUpdateAllOption} = this.props
    const newState = !this.state.isAllEnabled

    this.setState(prevState => ({
      isAllEnabled: !prevState.isAllEnabled,
    }))

    if (onUpdateAllOption) {
      onUpdateAllOption(newState)
    }
  }

  private showTooltipAutomatically = (): void => {
    setTimeout(() => {
      if (this.tooltipIconRef) {
        const iconElement = this.tooltipIconRef.querySelector(
          '.question-mark-tooltip--icon'
        ) as HTMLElement
        
        if (iconElement) {
          ReactTooltip.show(iconElement)
        }
      }
    }, 100)
  }
}

export default TemplateMetaQueryPreview
