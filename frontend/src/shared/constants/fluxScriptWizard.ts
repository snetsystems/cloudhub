export const AGG_FUNCTIONS = [
  {
    description: 'None',
    value: null
  },
  {
    description: 'mean()',
    value: '|> mean()'
  },
  {
    description: 'median()',
    value: '|> toFloat()\n  |> median()'
  },
  {
    description: 'p95()',
    value: '|> toFloat()\n  |> percentile(percentile: 0.95)'
  },
  {
    description: 'count()',
    value: '|> count()'
  },
  {
    description: 'spread()',
    value: '|> spread()'
  },
  {
    description: 'stddev()',
    value: '|> stddev()'
  },
  {
    description: 'sum()',
    value: '|> sum()'
  },
  {
    description: 'first()',
    value: '|> first()'
  },
  {
    description: 'last()',
    value: '|> last()'
  },
  {
    description: 'max()',
    value: '|> max()'
  },
  {
    description: 'min()',
    value: '|> min()'
  }
]

export const DEFAULT_AGG_FUNCTION = AGG_FUNCTIONS[0]
