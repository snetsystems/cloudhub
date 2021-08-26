export enum Provider {
  AWS = 'AWS',
  GCP = 'GCP',
  AZURE = 'AZURE',
}

export interface AWSInstanceData {
  [instanceID: string]: {[info: string]: number | string | JSX.Element}
}
