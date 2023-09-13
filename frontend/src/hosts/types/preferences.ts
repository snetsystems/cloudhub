export interface PreferenceType {
  temperatureType: 'inlet' | 'inside' | 'outlet'
  temperatureValueType: 'min' | 'max'
}

export type TemperatureTooltip = {
  hostname: string
  dataType: string
  temperature: {title: string; value: string; status: string}
  cpu: {title: string; value: string; status: string}
  memory: {title: string; value: string; status: string}
  disk: {title: string; value: string; status: string}
}
