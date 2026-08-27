import {getAiChatSkills} from './openclawSkills'
import {getSkillInventory, getSkills} from 'src/openclaw_skills/apis'

jest.mock('src/openclaw_skills/apis', () => ({
  getSkillInventory: jest.fn(),
  getSkills: jest.fn(),
}))

const inventoryMock = getSkillInventory as jest.Mock
const skillsMock = getSkills as jest.Mock

describe('the chat slash menu skill list', () => {
  beforeEach(() => {
    inventoryMock.mockReset()
    skillsMock.mockReset()
  })

  it('offers what the Gateway holds, reading its fields defensively', async () => {
    inventoryMock.mockResolvedValue({
      agentId: 'agent-1',
      skills: [
        {name: 'run-poc', description: 'PoC 검증', category: 'Test'},
        {name: 'audit-logs'},
      ],
    })
    skillsMock.mockResolvedValue([])

    expect(await getAiChatSkills()).toEqual([
      {
        name: 'audit-logs',
        command: '/audit-logs',
        description: '',
        category: 'Skill',
      },
      {
        name: 'run-poc',
        command: '/run-poc',
        description: 'PoC 검증',
        category: 'Test',
      },
    ])
  })

  it('falls back to the approved records when the Gateway cannot be asked', async () => {
    inventoryMock.mockRejectedValue({status: 502})
    skillsMock.mockResolvedValue([
      {name: 'published', status: 'approved', activeRevision: 3},
      {name: 'never-applied', status: 'draft', activeRevision: 1},
    ])

    const listed = await getAiChatSkills()

    expect(listed.map(skill => skill.command)).toEqual(['/published'])
    expect(listed[0].description).toBe('revision 3')
  })

  it('leaves the menu empty when neither side answers', async () => {
    inventoryMock.mockRejectedValue(new Error('down'))
    skillsMock.mockRejectedValue(new Error('down'))

    expect(await getAiChatSkills()).toEqual([])
  })
})
