import i18n from 'src/i18n'

const KEYS: Array<[string, any]> = [
  ['ai_chat.activity.summary', {count: 1}],
  ['ai_chat.activity.summary', {count: 3}],
  ['ai_chat.inspector.tool_count', {count: 1}],
  ['ai_chat.inspector.tool_count', {count: 5}],
  ['ai_chat.session.default_title', {number: 4}],
  ['ai_chat.session.title_generating', {title: 'demo'}],
  ['ai_chat.inspector.filter.all', {total: 2}],
  ['ai_chat.tool_card.truncated', {total: '90,000', shown: '50,000'}],
  ['ai_chat.error.send_failed', {status: 500, statusText: 'Boom'}],
  ['ai_chat.subagent.receiving', {task: 'k8s_get_pods'}],
  ['ai_chat.task.step_received', {name: 'exec'}],
  ['ai_chat.timestamp.this_year', {}],
]

describe('ai_chat translations resolve', () => {
  it.each(['ko', 'en'])('in %s', async lang => {
    await i18n.changeLanguage(lang)
    KEYS.forEach(([key, vars]) => {
      const out = i18n.t(key, vars)
      expect(out).not.toBe(key)
      expect(out).not.toMatch(/\{\{/)
    })
  })

  it('picks the English plural forms', async () => {
    await i18n.changeLanguage('en')
    expect(i18n.t('ai_chat.activity.summary', {count: 1})).toBe('1 tool run')
    expect(i18n.t('ai_chat.activity.summary', {count: 3})).toBe('3 tools run')
    await i18n.changeLanguage('ko')
    expect(i18n.t('ai_chat.activity.summary', {count: 3})).toBe('도구 3개 실행')
  })
})
