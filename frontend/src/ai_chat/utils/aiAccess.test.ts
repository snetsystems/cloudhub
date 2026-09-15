import {
  ensureAiAuthorized,
  isAiChatVisible,
  isAiRoleAuthorized,
} from 'src/ai_chat/utils/aiAccess'
import {Me} from 'src/types/auth'

const meWithRole = (role: string): Me => ({role} as Me)

describe('who the AI features are open to', () => {
  it('lets admins and superadmins through', () => {
    expect(isAiRoleAuthorized(meWithRole('admin'), true)).toBe(true)
    expect(isAiRoleAuthorized(meWithRole('superadmin'), true)).toBe(true)
  })

  it('turns every role below admin away', () => {
    expect(isAiRoleAuthorized(meWithRole('editor'), true)).toBe(false)
    expect(isAiRoleAuthorized(meWithRole('viewer'), true)).toBe(false)
    expect(isAiRoleAuthorized(meWithRole('member'), true)).toBe(false)
  })

  it('opens up when the deployment runs without auth', () => {
    expect(isAiRoleAuthorized(null, false)).toBe(true)
  })

  it('stays closed while the auth flag has not arrived', () => {
    // Fail closed, so a viewer never sees the menu flash by mid-load.
    expect(isAiRoleAuthorized(null, undefined)).toBe(false)
  })
})

describe('the org menu switch on top of the role', () => {
  it('hides AI from an admin whose org turned the menu off', () => {
    expect(isAiChatVisible(meWithRole('admin'), true, {'ai-chat': false})).toBe(
      false
    )
  })

  it('shows AI to an admin when the menu is on or unset', () => {
    expect(isAiChatVisible(meWithRole('admin'), true, {'ai-chat': true})).toBe(
      true
    )
    expect(isAiChatVisible(meWithRole('admin'), true, {})).toBe(true)
  })

  it('does not let the menu being on rescue a viewer', () => {
    expect(isAiChatVisible(meWithRole('viewer'), true, {'ai-chat': true})).toBe(
      false
    )
  })
})

describe('the AI route guard', () => {
  const guard = (role: string) =>
    ensureAiAuthorized(
      () => ({auth: {me: meWithRole(role), isUsingAuth: true}}),
      'overview'
    )

  it('leaves an admin on the page', () => {
    const replace = jest.fn()
    guard('admin')({params: {sourceID: '1'}}, replace)
    expect(replace).not.toHaveBeenCalled()
  })

  it('sends a viewer back to the source home page', () => {
    const replace = jest.fn()
    guard('viewer')({params: {sourceID: '7'}}, replace)
    expect(replace).toHaveBeenCalledWith('/sources/7/overview')
  })

  it('falls back to the bare home page without a source in the URL', () => {
    const replace = jest.fn()
    guard('viewer')({params: {}}, replace)
    expect(replace).toHaveBeenCalledWith('/overview')
  })
})
