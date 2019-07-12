import reducer from 'src/admin/reducers/cmp'

import {loadUsers} from 'src/admin/actions/cmp'
let state

const users = [
  {
    id: '666',
    name: 'bob@billietta.com',
    roles: [
      {
        name: 'admin',
        organization: '0',
      },
      {
        name: 'member',
        organization: '667',
      },
    ],
    provider: 'github',
    scheme: 'oauth2',
    superAdmin: true,
    links: {
      self: '/cmp/v1/users/666',
    },
    organizations: [
      {
        id: '0',
        name: 'Default',
      },
      {
        id: '667',
        name: 'Engineering',
        defaultRole: 'member',
      },
    ],
  },
  {
    id: '831',
    name: 'billybob@gmail.com',
    roles: [
      {
        name: 'member',
        organization: '0',
      },
      {
        name: 'viewer',
        organization: '667',
      },
      {
        name: 'editor',
        organization: '1236',
      },
    ],
    provider: 'github',
    scheme: 'oauth2',
    superAdmin: false,
    links: {
      self: '/cmp/v1/users/831',
    },
    organizations: [
      {
        id: '0',
        name: 'Default',
      },
      {
        id: '667',
        name: 'Engineering',
        defaultRole: 'member',
      },
      {
        id: '1236',
        name: 'PsyOps',
        defaultRole: 'editor',
      },
    ],
  },
  {
    id: '720',
    name: 'shorty@gmail.com',
    roles: [
      {
        name: 'admin',
        organization: '667',
      },
      {
        name: 'viewer',
        organization: '1236',
      },
    ],
    provider: 'github',
    scheme: 'oauth2',
    superAdmin: false,
    links: {
      self: '/cmp/v1/users/720',
    },
    organizations: [
      {
        id: '667',
        name: 'Engineering',
        defaultRole: 'member',
      },
      {
        id: '1236',
        name: 'PsyOps',
        defaultRole: 'editor',
      },
    ],
  },
  {
    id: '271',
    name: 'shawn.ofthe.dead@altavista.yop',
    roles: [],
    provider: 'github',
    scheme: 'oauth2',
    superAdmin: false,
    links: {
      self: '/cmp/v1/users/271',
    },
    organizations: [],
  },
]

describe('Admin.SCMP.Reducers', () => {
  it('it can load all users', () => {
    const actual = reducer(state, loadUsers({users}))
    const expected = {
      users,
    }

    expect(actual.users).toEqual(expected.users)
  })
})
