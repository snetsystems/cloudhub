import {AiModal} from 'src/types'

export type Action = ModalOpenAction | ModalCloseAction

export enum ActionTypes {
  ModalOpen = 'MODAL_OPEN',
  ModalClose = 'MODAL_CLOSE',
}

interface ModalOpenAction {
  type: ActionTypes.ModalOpen
  payload?: AiModal
}

export const openModal = (aiModal?: AiModal): ModalOpenAction => ({
  type: ActionTypes.ModalOpen,
  payload: aiModal,
})

interface ModalCloseAction {
  type: ActionTypes.ModalClose
}

export const closeModal = (): ModalCloseAction => ({
  type: ActionTypes.ModalClose,
})
