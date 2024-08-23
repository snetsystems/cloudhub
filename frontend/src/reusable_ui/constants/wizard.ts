export enum ConnectorState {
  None = 'none',
  Some = 'some',
  Full = 'full',
}

export enum StepStatus {
  Incomplete = 'circle-thick',
  Complete = 'checkmark',
  Error = 'remove',
}

export type StepStatusKey = keyof typeof StepStatus
