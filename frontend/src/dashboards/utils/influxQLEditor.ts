export const createMarkerElement = (
  title: string,
  tempVar: string
): HTMLElement => {
  const marker = document.createElement('span')
  const replacementText = document.createTextNode(`${tempVar}`)

  marker.setAttribute('title', title)
  marker.appendChild(replacementText)
  marker.classList.add('cm-temp-var')

  return marker
}

export interface QueryEditorDraft {
  editedQueryText: string
  isSubmitted: boolean
}

export interface EditorDraftPrevState {
  configID: string
  editedQueryText: string
  isSubmitted: boolean
  draftsByConfigID: {[id: string]: QueryEditorDraft}
}

export interface EditorDraftDerivedState {
  configID: string
  editedQueryText: string
  isSubmitted: boolean
  draftsByConfigID: {[id: string]: QueryEditorDraft}
  focused: boolean
}

export const deriveEditorDraftState = (
  nextQuery: string,
  nextConfigID: string,
  prev: EditorDraftPrevState
): EditorDraftDerivedState | null => {
  const isQueryConfigChanged = nextConfigID !== prev.configID
  const isQueryTextChanged = prev.editedQueryText.trim() !== nextQuery.trim()

  const prevDrafts = prev.draftsByConfigID || {}

  if (isQueryConfigChanged) {
    const draftsByConfigID = {
      ...prevDrafts,
      [prev.configID]: {
        editedQueryText: prev.editedQueryText,
        isSubmitted: prev.isSubmitted,
      },
    }

    const cached = draftsByConfigID[nextConfigID]
    const editedQueryText = cached ? cached.editedQueryText : nextQuery
    const isSubmitted = editedQueryText.trim() === nextQuery.trim()

    return {
      editedQueryText,
      isSubmitted,
      configID: nextConfigID,
      draftsByConfigID,
      focused: true,
    }
  }

  if (prev.isSubmitted && isQueryTextChanged) {
    return {
      editedQueryText: nextQuery,
      isSubmitted: true,
      configID: nextConfigID,
      draftsByConfigID: {
        ...prevDrafts,
        [nextConfigID]: {
          editedQueryText: nextQuery,
          isSubmitted: true,
        },
      },
      focused: false,
    }
  }

  return null
}
