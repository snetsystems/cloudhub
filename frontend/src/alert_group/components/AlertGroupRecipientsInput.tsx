import React, {ChangeEvent, PureComponent} from 'react'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const validateRecipient = (raw: string): boolean => EMAIL_RE.test(raw.trim())

export const parseRecipientsText = (text: string): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of text.split(/[\n,]/)) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

interface Props {
  recipients: string[]
  onChange: (next: string[]) => void
}

interface State {
  draft: string
  invalidEntries: string[]
}

export default class AlertGroupRecipientsInput extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      draft: (props.recipients || []).join('\n'),
      invalidEntries: [],
    }
  }

  public componentDidUpdate(prevProps: Props): void {
    if (prevProps.recipients !== this.props.recipients) {
      const next = (this.props.recipients || []).join('\n')
      if (next !== this.state.draft) {
        this.setState({draft: next})
      }
    }
  }

  public render(): JSX.Element {
    const {draft, invalidEntries} = this.state
    return (
      <div className="alert-group-recipients-input">
        <label className="form-label">직접 입력 수신자</label>
        <textarea
          className="form-control"
          value={draft}
          rows={4}
          placeholder="admin@example.com&#10;oncall@example.com"
          onChange={this.handleChange}
          onBlur={this.handleBlur}
        />
        <p className="form-help">
          한 줄에 하나 또는 콤마로 구분. 직접 입력한 수신자는 모든 레벨(Info/Warning/Critical) 알림을 받습니다.
        </p>
        {invalidEntries.length > 0 && (
          <p className="form-error">
            잘못된 이메일 형식: {invalidEntries.join(', ')}
          </p>
        )}
      </div>
    )
  }

  private handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    this.setState({draft: e.target.value})
  }

  private handleBlur = (): void => {
    const parsed = parseRecipientsText(this.state.draft)
    const invalid = parsed.filter(p => !validateRecipient(p))
    const valid = parsed.filter(validateRecipient)
    this.setState({invalidEntries: invalid})
    this.props.onChange(valid)
  }
}
