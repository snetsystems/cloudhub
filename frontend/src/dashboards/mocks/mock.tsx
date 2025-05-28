import {WordDatum} from '../types'

export const smallSample: WordDatum[] = [
  {text: 'error', value: 42},
  {text: 'warn', value: 31},
  {text: 'info', value: 28},
  {text: 'successfully', value: 22},
  {text: 'deactivated', value: 15},
  {text: 'host', value: 14},
  {text: 'exception', value: 13},
  {text: 'lookup', value: 12},
  {text: 'failure', value: 11},
  {text: 'timeout', value: 10},
  {text: 'excepti11on', value: 44},
  {text: 'look212up', value: 152},
  {text: 'fail33ure', value: 111},
  {text: 'time33out', value: 120},
]

export function makeLargeSample(count = 10): WordDatum[] {
  const tokens = [
    'error',
    'warn',
    'info',
    'success',
    'debug',
    'failed',
    'connected',
    'disconnected',
    'timeout',
    'retry',
  ]

  return Array.from({length: count}, (_, i) => ({
    text: tokens[i % tokens.length] + '_' + (i % 100),
    value: Math.floor(Math.random() * 1000) + 1,
  }))
}
