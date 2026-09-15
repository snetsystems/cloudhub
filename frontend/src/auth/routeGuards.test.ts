import {ensureRole, isRoleAuthorized} from 'src/auth/routeGuards'
import {ADMIN_ROLE, EDITOR_ROLE} from 'src/auth/Authorized'
import {Me} from 'src/types/auth'

const meWithRole = (role: string): Me => ({role} as Me)

describe('isRoleAuthorized', () => {
  it('clears the required role and everything above it', () => {
    expect(isRoleAuthorized(meWithRole('editor'), true, EDITOR_ROLE)).toBe(true)
    expect(isRoleAuthorized(meWithRole('admin'), true, EDITOR_ROLE)).toBe(true)
    expect(isRoleAuthorized(meWithRole('superadmin'), true, ADMIN_ROLE)).toBe(
      true
    )
  })

  it('turns away anyone below it', () => {
    expect(isRoleAuthorized(meWithRole('editor'), true, ADMIN_ROLE)).toBe(false)
    expect(isRoleAuthorized(meWithRole('viewer'), true, EDITOR_ROLE)).toBe(false)
  })

  it('opens up when the deployment runs without auth', () => {
    expect(isRoleAuthorized(null, false, ADMIN_ROLE)).toBe(true)
  })

  it('stays closed while the auth flag has not arrived', () => {
    expect(isRoleAuthorized(null, undefined, ADMIN_ROLE)).toBe(false)
  })
})

describe('ensureRole', () => {
  const guard = (role: string) =>
    ensureRole(
      () => ({auth: {me: meWithRole(role), isUsingAuth: true}}),
      ADMIN_ROLE,
      'overview'
    )

  it('leaves an authorized user on the page', () => {
    const replace = jest.fn()
    guard('admin')({params: {sourceID: '1'}}, replace)
    expect(replace).not.toHaveBeenCalled()
  })

  it('sends everyone below the bar to the source home page', () => {
    const replace = jest.fn()
    guard('editor')({params: {sourceID: '7'}}, replace)
    expect(replace).toHaveBeenCalledWith('/sources/7/overview')
  })

  it('falls back to the bare home page without a source in the URL', () => {
    const replace = jest.fn()
    guard('viewer')({params: {}}, replace)
    expect(replace).toHaveBeenCalledWith('/overview')
  })
})
