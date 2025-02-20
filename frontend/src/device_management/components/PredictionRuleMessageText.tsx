// Libraries
import React, {
  FunctionComponent,
  ChangeEvent,
  useState,
  useCallback,
  useEffect,
} from 'react'

// Components
import RuleMessageStatus from 'src/kapacitor/components/alert_rules/RuleMessageStatus'
import RuleMessageTextArea from 'src/kapacitor/components/alert_rules/RuleMessageTextArea'

// Hooks
import {useMessageValidation} from 'src/kapacitor/components/alert_rules/hooks'

// Helpers
import DefaultDebouncer, {Debouncer} from 'src/shared/utils/debouncer'

// Types
import {TypingStatus} from 'src/types'

interface Props {
  message: string
  updateMessage: (value: string) => void
}

const debouncer: Debouncer = new DefaultDebouncer()

const PredictionRuleMessageText: FunctionComponent<Props> = ({
  message,
  updateMessage,
}) => {
  const [typingStatus, setTypingStatus] = useState(TypingStatus.NotStarted)
  const [value, setValue] = useState(message)
  const validation = useMessageValidation(typingStatus, value)

  useEffect(() => {
    if (typingStatus === TypingStatus.Done) {
      updateMessage(value)
    }
  }, [typingStatus])

  useEffect(() => {
    if (message !== value) {
      setValue(message)
    }
  }, [message])

  const typingDone = useCallback(() => {
    setTypingStatus(TypingStatus.Done)
  }, [setTypingStatus])

  const onKeyUp = () => {
    const waitForEndTypingMs = 500
    debouncer.call(typingDone, waitForEndTypingMs)
  }

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (typingStatus !== TypingStatus.Started) {
      setTypingStatus(TypingStatus.Started)
    }

    setValue(e.target.value)
  }

  return (
    <div className="rule-builder--message">
      <RuleMessageTextArea
        message={value}
        onKeyUp={onKeyUp}
        onChange={onChange}
        validationState={validation.state}
      />
      {message && (
        <RuleMessageStatus
          validationState={validation.state}
          validationText={validation.text}
        />
      )}
    </div>
  )
}

export default PredictionRuleMessageText
