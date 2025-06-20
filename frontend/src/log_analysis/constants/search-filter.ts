export interface OperatorMeta {
  op: string
  label: string
  description: string
}

export const FIELD_OPERATOR_META: Record<string, OperatorMeta[]> = {
  _id: [
    {op: ':', label: 'equals', description: 'equals some value'},
    {op: ':*', label: 'exists', description: 'exists in any form'},
  ],
  _index: [
    {op: ':', label: 'equals', description: 'equals some value'},
    {op: ':*', label: 'exists', description: 'exists in any form'},
  ],
  _ignored: [
    {op: ':', label: 'equals', description: 'equals some value'},
    {op: ':*', label: 'exists', description: 'exists in any form'},
  ],

  keyword: [
    {op: ':', label: 'equals', description: 'equals some value'},
    {
      op: '!=',
      label: 'not equals',
      description: 'does not equal the given value',
    },
    {op: ':*', label: 'exists', description: 'exists in any form'},
  ],

  text: [
    {op: ':', label: 'equals', description: 'equals some value'},
    {
      op: 'match',
      label: 'matches',
      description: 'matches the given text (wildcard, regexp, etc.)',
    },
    {op: ':*', label: 'exists', description: 'exists in any form'},
  ],

  ip: [
    {op: ':', label: 'equals', description: 'equals some value'},
    {op: '<', label: 'less than', description: 'is less than some value'},
    {
      op: '<=',
      label: 'less than or equal to',
      description: 'is less than or equal to some value',
    },
    {op: '>', label: 'greater than', description: 'is greater than some value'},
    {
      op: '>=',
      label: 'greater than or equal to',
      description: 'is greater than or equal to some value',
    },
    {op: ':*', label: 'exists', description: 'exists in any form'},
  ],

  long: [
    {op: ':', label: 'equals', description: 'equals some value'},
    {
      op: '!=',
      label: 'not equals',
      description: 'does not equal the given value',
    },
    {op: '<', label: 'less than', description: 'is less than some value'},
    {
      op: '<=',
      label: 'less than or equal to',
      description: 'is less than or equal to some value',
    },
    {op: '>', label: 'greater than', description: 'is greater than some value'},
    {
      op: '>=',
      label: 'greater than or equal to',
      description: 'is greater than or equal to some value',
    },
    {op: ':*', label: 'exists', description: 'exists in any form'},
  ],
  integer: [
    {op: ':', label: 'equals', description: 'equals some value'},
    {
      op: '!=',
      label: 'not equals',
      description: 'does not equal the given value',
    },
    {op: '<', label: 'less than', description: 'is less than some value'},
    {
      op: '<=',
      label: 'less than or equal to',
      description: 'is less than or equal to some value',
    },
    {op: '>', label: 'greater than', description: 'is greater than some value'},
    {
      op: '>=',
      label: 'greater than or equal to',
      description: 'is greater than or equal to some value',
    },
    {op: ':*', label: 'exists', description: 'exists in any form'},
  ],
  float: [
    {op: ':', label: 'equals', description: 'equals some value'},
    {
      op: '!=',
      label: 'not equals',
      description: 'does not equal the given value',
    },
    {op: '<', label: 'less than', description: 'is less than some value'},
    {
      op: '<=',
      label: 'less than or equal to',
      description: 'is less than or equal to some value',
    },
    {op: '>', label: 'greater than', description: 'is greater than some value'},
    {
      op: '>=',
      label: 'greater than or equal to',
      description: 'is greater than or equal to some value',
    },
    {op: ':*', label: 'exists', description: 'exists in any form'},
  ],
  double: [
    {op: ':', label: 'equals', description: 'equals some value'},
    {
      op: '!=',
      label: 'not equals',
      description: 'does not equal the given value',
    },
    {op: '<', label: 'less than', description: 'is less than some value'},
    {
      op: '<=',
      label: 'less than or equal to',
      description: 'is less than or equal to some value',
    },
    {op: '>', label: 'greater than', description: 'is greater than some value'},
    {
      op: '>=',
      label: 'greater than or equal to',
      description: 'is greater than or equal to some value',
    },
    {op: ':*', label: 'exists', description: 'exists in any form'},
  ],

  date: [
    {op: ':', label: 'equals', description: 'equals some value'},
    {
      op: '!=',
      label: 'not equals',
      description: 'does not equal the given value',
    },
    {op: '<', label: 'before', description: 'is before some value'},
    {
      op: '<=',
      label: 'before or at',
      description: 'is before or at some value',
    },
    {op: '>', label: 'after', description: 'is after some value'},
    {op: '>=', label: 'after or at', description: 'is after or at some value'},
    {op: 'between', label: 'between', description: 'is between two dates'},
    {op: ':*', label: 'exists', description: 'exists in any form'},
  ],
  boolean: [
    {op: ':', label: 'equals', description: 'is true or false'},
    {op: '!=', label: 'not equals', description: 'is not true or false'},
    {op: ':*', label: 'exists', description: 'exists in any form'},
  ],
}

export const LOGICAL_OPERATORS: OperatorMeta[] = [
  {
    op: 'and',
    label: 'and',
    description: 'Requires both arguments to be true',
  },
  {
    op: 'or',
    label: 'or',
    description: 'Requires one or more arguments to be true',
  },
]

export const KNOWN_ES_FIELD_TYPES = [
  'keyword',
  'text',
  'ip',
  'long',
  'integer',
  'float',
  'double',
  'date',
  'boolean',
  'short',
  'byte',
  'geo_point',
  'geo_shape',
  'completion',
  'token_count',
  'nested',
  'object',
  '_id',
  '_index',
  '_ignored',
]

export const ALWAYS_TOP_FIELDS = ['_id', '_ignored', '_index']
