import {deriveEditorDraftState} from 'src/dashboards/utils/influxQLEditor'

describe('dashboards.utils.influxQLEditor.deriveEditorDraftState', () => {
  const basePrev = {
    configID: 'query-1',
    editedQueryText: 'SELECT mean(cpu) FROM cpu',
    isSubmitted: false,
    draftsByConfigID: {},
  }

  it('preserves unsubmitted draft when switching tabs and restores it on return', () => {
    const leaveQuery1 = deriveEditorDraftState('', 'query-2', basePrev)

    expect(leaveQuery1).not.toBeNull()
    expect(leaveQuery1.editedQueryText).toBe('')
    expect(leaveQuery1.isSubmitted).toBe(true)
    expect(leaveQuery1.draftsByConfigID['query-1']).toEqual({
      editedQueryText: 'SELECT mean(cpu) FROM cpu',
      isSubmitted: false,
    })

    const returnToQuery1 = deriveEditorDraftState(
      '',
      'query-1',
      {
        configID: leaveQuery1.configID,
        editedQueryText: leaveQuery1.editedQueryText,
        isSubmitted: leaveQuery1.isSubmitted,
        draftsByConfigID: leaveQuery1.draftsByConfigID,
      }
    )

    expect(returnToQuery1.editedQueryText).toBe('SELECT mean(cpu) FROM cpu')
    expect(returnToQuery1.isSubmitted).toBe(false)
  })

  it('syncs props.query on the same tab when submitted', () => {
    const result = deriveEditorDraftState(
      'SELECT mean(mem) FROM mem',
      'query-1',
      {
        ...basePrev,
        editedQueryText: '',
        isSubmitted: true,
      }
    )

    expect(result).not.toBeNull()
    expect(result.editedQueryText).toBe('SELECT mean(mem) FROM mem')
    expect(result.isSubmitted).toBe(true)
  })

  it('does not sync props.query on the same tab when unsubmitted', () => {
    const result = deriveEditorDraftState(
      'SELECT mean(mem) FROM mem',
      'query-1',
      basePrev
    )

    expect(result).toBeNull()
  })

  it('starts a new tab as submitted with props.query', () => {
    const result = deriveEditorDraftState(
      'SELECT mean(disk) FROM disk',
      'query-2',
      {
        ...basePrev,
        isSubmitted: true,
        editedQueryText: 'SELECT mean(cpu) FROM cpu',
      }
    )

    expect(result.editedQueryText).toBe('SELECT mean(disk) FROM disk')
    expect(result.isSubmitted).toBe(true)
    expect(result.focused).toBe(true)
  })
})
