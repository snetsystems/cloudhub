// frontend/src/alert_group/components/AlertGroupTestModal.tsx
import React, {useCallback, useEffect, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {
  Button,
  ComponentColor,
  ComponentSize,
  ComponentStatus,
  IconFont,
  OverlayTechnology,
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
  Form,
  Input,
  InputType,
  MultiSelectDropdown,
  DropdownMenuColors,
  SlideToggle,
} from 'src/reusable_ui'
import {
  AlertGroupRule,
  AlertRuleEventHandler,
  UserGroup,
  Notification,
  NotificationFunc,
} from 'src/types'
import {testDraftAlertGroupNotification} from 'src/alert_group/apis'
import {notifyError, notifySuccess} from 'src/shared/copy/notifications'

interface Props {
  visible: boolean
  rule: AlertGroupRule
  userGroups: UserGroup[]
  userEmail?: string
  notify: (message: Notification | NotificationFunc) => void
  onClose: () => void
  onTestingSendChange?: (isSending: boolean) => void
}

const parseTestRecipients = (value: string): string[] =>
  value
    .split(/[\s,]+/)
    .map(recipient => recipient.trim())
    .filter(Boolean)

const getRequestErrorMessage = (error: any, fallback: string): string =>
  error?.data?.message || error?.message || fallback

const getEmailHandler = (
  rule: AlertGroupRule
): AlertRuleEventHandler | undefined =>
  (rule.eventHandlers || []).find(handler => handler.type === 'email')

const getTestRecipientGroupIds = (rule: AlertGroupRule): string[] => {
  const emailHandler = getEmailHandler(rule)
  if (emailHandler) {
    return [...(emailHandler.recipientGroupIds || [])]
  }
  return [...(rule.recipientGroupIds || [])]
}

const getTestEmailBody = (rule: AlertGroupRule): string => {
  const body = getEmailHandler(rule)?.configJson?.body
  return typeof body === 'string' ? body.trim() : ''
}

const AlertGroupTestModal: React.FC<Props> = ({
  visible,
  rule,
  userGroups,
  userEmail,
  notify,
  onClose,
  onTestingSendChange,
}) => {
  const {t} = useTranslation()
  const [testRecipients, setTestRecipients] = useState('')
  const [testIncludeSelf, setTestIncludeSelf] = useState(false)
  const [testUserGroupIds, setTestUserGroupIds] = useState<string[]>([])
  const [isTestingSend, setIsTestingSend] = useState(false)

  const setTestingSend = useCallback(
    (isSending: boolean): void => {
      setIsTestingSend(isSending)
      onTestingSendChange?.(isSending)
    },
    [onTestingSendChange]
  )

  useEffect(() => {
    if (visible) {
      setTestRecipients('')
      setTestIncludeSelf(false)
      setTestingSend(false)
      setTestUserGroupIds(getTestRecipientGroupIds(rule))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const handleRecipientsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      setTestRecipients(e.target.value)
    },
    []
  )

  const handleIncludeSelfChange = useCallback((): void => {
    setTestIncludeSelf(prev => !prev)
  }, [])

  const handleUserGroupIdsChange = useCallback((selectedIDs: string[]): void => {
    setTestUserGroupIds(selectedIDs)
  }, [])

  const handleSend = useCallback(async (): Promise<void> => {
    const recipients = parseTestRecipients(testRecipients)
    const title = (rule.message || '').trim()
    const message = getTestEmailBody(rule)

    if (!title) {
      notify(
        notifyError(
          t('alert_group_rule.noti_enter_mail_title', '메일 타이틀을 입력해주세요.')
        )
      )
      return
    }
    if (!message) {
      notify(
        notifyError(
          t(
            'alert_group_rule.noti_enter_email_body',
            '이메일 메시지 본문을 입력해주세요.'
          )
        )
      )
      return
    }
    if (
      testUserGroupIds.length === 0 &&
      recipients.length === 0 &&
      !testIncludeSelf
    ) {
      notify(
        notifyError(
          t(
            'alert_group_rule.noti_select_test_recipient',
            '테스트 수신 대상을 선택해주세요.'
          )
        )
      )
      return
    }

    setTestingSend(true)

    try {
      const result = await testDraftAlertGroupNotification({
        kapacitorId: rule.kapacitorId,
        recipientGroupIds: testUserGroupIds,
        recipients,
        includeSelf: testIncludeSelf,
        title,
        message,
      })

      notify(
        notifySuccess(
          t(
            'alert_group_rule.noti_test_sent_count',
            '{{count}}건의 테스트 알림을 전송했습니다.',
            {count: result.sentCount}
          )
        )
      )
      setTestingSend(false)
      onClose()
    } catch (e) {
      notify(
        notifyError(
          getRequestErrorMessage(
            e,
            t('alert_group_rule.noti_test_send_fail', '테스트 발송에 실패했습니다.')
          )
        )
      )
      setTestingSend(false)
    }
  }, [
    testRecipients,
    rule,
    testUserGroupIds,
    testIncludeSelf,
    notify,
    t,
    onClose,
    setTestingSend,
  ])

  return (
    <OverlayTechnology visible={visible}>
      <OverlayContainer maxWidth={480}>
        <OverlayHeading
          title={t('alert_group_rule.test_modal.title', '수신 테스트')}
        />
        <OverlayBody>
          <Form>
            <Form.Element
              label={t('alert_group_rule.test_modal.send_to_me', '내 이메일에 발송')}
            >
              <div className="alert-group-test-modal-email-row">
                <SlideToggle
                  active={testIncludeSelf}
                  onChange={handleIncludeSelfChange}
                  size={ComponentSize.ExtraSmall}
                  color={ComponentColor.Primary}
                  disabled={!userEmail}
                />
                <span className="alert-group-test-modal-email-text">
                  {userEmail
                    ? userEmail
                    : t(
                        'alert_group_rule.test_modal.no_email_warning',
                        '로그인 사용자의 이메일이 없어 사용할 수 없습니다.'
                      )}
                </span>
              </div>
            </Form.Element>
            <Form.Element
              label={t(
                'alert_group_rule.test_modal.select_groups',
                '수신 그룹 선택 (선택)'
              )}
            >
              {userGroups.length > 0 ? (
                <MultiSelectDropdown
                  selectedIDs={testUserGroupIds}
                  onChange={handleUserGroupIdsChange}
                  buttonColor={ComponentColor.Default}
                  buttonSize={ComponentSize.Small}
                  menuColor={DropdownMenuColors.Onyx}
                  emptyText={t(
                    'alert_group_rule.test_modal.no_group_selected',
                    '그룹 선택 안 함'
                  )}
                >
                  {userGroups.map(ug => (
                    <MultiSelectDropdown.Item key={ug.id!} id={ug.id!} value={ug}>
                      {ug.name}
                    </MultiSelectDropdown.Item>
                  ))}
                </MultiSelectDropdown>
              ) : (
                <p className="alert-group-test-modal-hint">
                  {t(
                    'alert_group_rule.test_modal.no_groups_registered',
                    '등록된 수신 그룹이 없습니다.'
                  )}
                </p>
              )}
            </Form.Element>
            <Form.Element
              label={t(
                'alert_group_rule.test_modal.direct_recipients',
                '수신자 직접 입력 (선택)'
              )}
            >
              <Input
                value={testRecipients}
                onChange={handleRecipientsChange}
                type={InputType.Text}
                placeholder={t(
                  'alert_group_rule.test_modal.recipients_placeholder',
                  '여러 명은 쉼표로 구분'
                )}
              />
            </Form.Element>
            <Form.Footer>
              <Button
                text={
                  isTestingSend
                    ? t('alert_group_rule.test_modal.sending', '발송 중...')
                    : t('alert_group_rule.test_modal.send_test_btn', '수신 테스트')
                }
                icon={IconFont.Bell}
                onClick={handleSend}
                color={ComponentColor.Success}
                status={
                  isTestingSend
                    ? ComponentStatus.Disabled
                    : ComponentStatus.Default
                }
              />
              <Button
                text={t('button.cancel', '취소')}
                onClick={onClose}
                color={ComponentColor.Default}
              />
            </Form.Footer>
          </Form>
        </OverlayBody>
      </OverlayContainer>
    </OverlayTechnology>
  )
}

export default AlertGroupTestModal
