export const modeFlux = {
  // The start state contains the rules that are intially used
  start: [
    // Flux Syntax
    {
      regex: /[|][>]/,
      token: 'pipe-forward',
    },
    {
      regex: /\w+(?=[(])/,
      token: 'function',
    },
    {
      regex: /[\w\d]+(?=\s[=]\s)/,
      token: 'variable',
    },
    {
      regex: /[=][>]/,
      token: 'arrow-function',
    },
    {
      regex: /\w+(?=[)]\s[=][>])(?![(])/,
      token: 'function-arg',
    },
    {
      regex: /\w+(?=[[]["]|[.])/,
      token: 'function-arg-ref',
    },
    {
      regex: /AND|OR|[=][=]|[!][=]|[<][=]|[>][=]/,
      token: 'operator',
    },
    {
      regex: /\w+[:]/,
      token: 'argument',
    },
    // The regex matches the token, the token property contains the type
    {
      regex: /"(?:[^\\]|\\.)*?(?:"|$)/,
      token: 'string-double',
    },
    {
      regex: /'(?:[^\\]|\\.)*?(?:'|$)/,
      token: 'string-single',
    },
    {
      regex: /(function)(\s+)([a-z$][\w$]*)/,
      token: ['keyword', null, 'variable-2'],
    },
    {
      regex: /true|false|TRUE|FALSE/,
      token: 'boolean',
    },
    {
      regex: /null|undefined/,
      token: 'null',
    },
    {
      regex: /0x[a-f\d]+|[-+]?(?:\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/i,
      token: 'number',
    },
    {
      regex: /({.+:.+})/,
      token: 'object',
    },
    {
      regex: /\/\/.*/,
      token: 'comment',
    },
    // A next property will cause the mode to move to a different state
    {
      regex: /\/\*/,
      token: 'comment',
      next: 'comment',
    },
    {
      regex: /[-+\/*=<>!]+/,
      token: 'operator',
    },
  ],
  // The multi-line comment state.
  comment: [
    {
      regex: /.*?\*\//,
      token: 'comment',
      next: 'start',
    },
    {
      regex: /.*/,
      token: 'comment',
    },
  ],
  // The meta property contains global information about the mode. It
  // can contain properties like lineComment, which are supported by
  // all modes, and also directives like dontIndentStates, which are
  // specific to simple modes.
  meta: {
    dontIndentStates: ['comment'],
    lineComment: '//',
  },
}

export const modeTickscript = {
  // The start state contains the rules that are intially used
  start: [
    // The regex matches the token, the token property contains the type
    // A next property will cause the mode to move to a different state
    {
      regex: /"/,
      token: 'string.double',
      next: 'stringdouble',
    },
    {
      regex: /'/,
      token: 'string.single',
      next: 'stringsingle',
    },
    {
      regex: /(function)(\s+)([A-Za-z][\w]*)/,
      token: ['keyword', null, 'variable-2'],
    },
    // Rules are matched in the order in which they appear, so there is
    // no ambiguity between this one and the one above
    {
      regex: /(?:var|return|dbrp|if|for|while|else|do|this|stream|batch|influxql|lambda)/,
      token: 'keyword',
    },
    {
      regex: /TRUE|FALSE/,
      token: 'atom',
    },
    {
      regex: /0x[a-f\d]+|[-+]?(?:\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/i,
      token: 'number',
    },
    {
      regex: /\/\/.*/,
      token: 'comment',
    },
    {
      regex: /\/(?:[^\\]|\\.)*?\//,
      token: 'variable-3',
    },
    {
      regex: /AND|OR|[-~+\/*=<>!]+/,
      token: 'operator',
    },
    {
      regex: /[@]?[A-Za-z][\w$]*/,
      token: 'variable',
    },
  ],
  stringdouble: [
    {
      regex: /"/,
      token: 'string.double',
      next: 'start',
    },
    {
      regex: /[^"]/,
      token: 'string.double',
    },
  ],
  stringsingle: [
    {
      regex: /'/,
      token: 'string.single',
      next: 'start',
    },
    {
      regex: /[^']/,
      token: 'string.single',
    },
  ],
  // The meta property contains global information about the mode. It
  // can contain properties like lineComment, which are supported by
  // all modes, and also directives like dontIndentStates, which are
  // specific to simple modes.
  meta: {
    lineComment: '//',
  },
}

export const modeInfluxQL = {
  // The start state contains the rules that are intially used
  start: [
    // The regex matches the token, the token property contains the type
    {
      regex: /"(?:[^\\]|\\.)*?(?:"|$)/,
      token: 'string.double',
    },
    {
      regex: /'(?:[^\\]|\\.)*?(?:'|$)/,
      token: 'string.single',
    },
    {
      regex: /(function)(\s+)([a-z$][\w$]*)/,
      token: ['keyword', null, 'variable-2'],
    },
    // Rules are matched in the order in which they appear, so there is
    // no ambiguity between this one and the one above
    {
      regex: /(SELECT\s|AS\s|FROM\s|WHERE\s|GROUP\sBY\s)/i,
      token: 'clause',
    },
    {
      regex: /FILL(?=[(])/i,
      token: 'clause',
    },
    {
      regex: /(CREATE\s|SHOW\s|DROP\s)/i,
      token: 'meta',
    },
    {
      regex: /0x[a-f\d]+|[-+]?(?:\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/i,
      token: 'number',
    },
    {
      regex: /[:](interval|dashboardTime|dashboardUpper)[:]/,
      token: 'temp-system',
    },
    {
      regex: /[:]\w+[:]/,
      token: 'temp-var',
    },
    {
      regex: /now[(][)]\s\S\s\S+/,
      token: 'now',
    },
    {
      regex: /[-+\/*=~<>!]+/,
      token: 'operator',
    },
    {
      regex: /(NULL)/i,
      token: 'null',
    },
  ],
  // The multi-line comment state.
  comment: [
    {
      regex: /.*?\*\//,
      token: 'comment',
      next: 'start',
    },
    {
      regex: /.*/,
      token: 'comment',
    },
  ],
  // The meta property contains global information about the mode. It
  // can contain properties like lineComment, which are supported by
  // all modes, and also directives like dontIndentStates, which are
  // specific to simple modes.
  meta: {
    dontIndentStates: ['comment'],
    lineComment: '//',
  },
}

export const modeInfluxQLReadOnly = {
  // The start state contains the rules that are intially used
  start: [
    // The regex matches the token, the token property contains the type
    {
      regex: /"(?:[^\\]|\\.)*?(?:"|$)/,
      token: 'string.double',
    },
    {
      regex: /'(?:[^\\]|\\.)*?(?:'|$)/,
      token: 'string.single',
    },
    {
      regex: /(function)(\s+)([a-z$][\w$]*)/,
      token: ['keyword', null, 'variable-2'],
    },
    // Rules are matched in the order in which they appear, so there is
    // no ambiguity between this one and the one above
    {
      regex: /(SELECT\s|AS\s|FROM\s|WHERE\s|GROUP\sBY\s)/i,
      token: 'clause',
    },
    {
      regex: /FILL(?=[(])/i,
      token: 'clause',
    },
    {
      regex: /(CREATE\s|SHOW\s|DROP\s)/i,
      token: 'meta',
    },
    {
      regex: /[:]['](\w|[-:.])+['][:]/,
      token: 'temp-var',
    },
    {
      regex: /[:]now[(][)]\s[-]\s(\w+)[:]/,
      token: 'temp-var',
    },
    {
      regex: /[:]\w+[:]/,
      token: 'temp-var',
    },
    {
      regex: /0x[a-f\d]+|[-+]?(?:\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/i,
      token: 'number',
    },
    {
      regex: /(NULL)/i,
      token: 'null',
    },
  ],
  // The multi-line comment state.
  comment: [
    {
      regex: /.*?\*\//,
      token: 'comment',
      next: 'start',
    },
    {
      regex: /.*/,
      token: 'comment',
    },
  ],
  // The meta property contains global information about the mode. It
  // can contain properties like lineComment, which are supported by
  // all modes, and also directives like dontIndentStates, which are
  // specific to simple modes.
  meta: {
    dontIndentStates: ['comment'],
    lineComment: '//',
  },
}

export const modeMarkdown = {
  // The start state contains the rules that are intially used
  start: [
    // The regex matches the token, the token property contains the type
    {
      regex: /[*](\s|\w)+[*]/,
      token: 'italic',
    },
    {
      regex: /[*][*](\s|\w)+[*][*]/,
      token: 'bold',
    },
    {
      regex: /[~][~](\s|\w)+[~][~]/,
      token: 'strikethrough',
    },
    {
      regex: /\#+\s.+(?=$)/gm,
      token: 'heading',
    },
    {
      regex: /\>.+(?=$)/gm,
      token: 'blockquote',
    },
    {
      regex: /\[.+\]\(.+\)/,
      token: 'link',
    },
    {
      regex: /[!]\[.+\]\(.+\)/,
      token: 'image',
    },
  ],
  // The multi-line comment state.
  comment: [
    {
      regex: /.*?\*\//,
      token: 'comment',
      next: 'start',
    },
    {
      regex: /.*/,
      token: 'comment',
    },
  ],
  // The meta property contains global information about the mode. It
  // can contain properties like lineComment, which are supported by
  // all modes, and also directives like dontIndentStates, which are
  // specific to simple modes.
  meta: {
    dontIndentStates: ['comment'],
    lineComment: '//',
  },
}

export const modeAgentConf = {
  // The start state contains the rules that are intially used
  start: [
    // Agent Syntax
    {
      regex: /[\w\d]+(?=\s[=]\s)/,
      token: 'variable',
    },
    {
      regex: /[=][>]/,
      token: 'arrow-function',
    },
    {
      regex: /\w+(?=[)]\s[=][>])(?![(])/,
      token: 'function-arg',
    },
    {
      regex: /\w+(?=[[]["]|[.])/,
      token: 'function-arg-ref',
    },
    {
      regex: /AND|OR|[=][=]|[!][=]|[<][=]|[>][=]/,
      token: 'operator',
    },
    // The regex matches the token, the token property contains the type
    {
      regex: /"(?:[^\\]|\\.)*?(?:"|$)/,
      token: 'string-double',
    },
    {
      regex: /'(?:[^\\]|\\.)*?(?:'|$)/,
      token: 'string-single',
    },
    {
      regex: /(function)(\s+)([a-z$][\w$]*)/,
      token: ['keyword', null, 'variable-2'],
    },
    {
      regex: /true|false|TRUE|FALSE/,
      token: 'boolean',
    },
    {
      regex: /null|undefined/,
      token: 'null',
    },
    {
      regex: /0x[a-f\d]+|[-+]?(?:\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/i,
      token: 'number',
    },
    {
      regex: /({.+:.+})/,
      token: 'object',
    },
    {
      regex: /\#.*/,
      token: 'comment',
    },
    {
      regex: /[-+\/*=<>!]+/,
      token: 'operator',
    },
    {
      regex: /\[(?:[^\\]|\\.)*?(?:|$)]+/,
      token: 'agent-title',
    },
  ],
}

export const modeYaml = {
  // The start state contains the rules that are intially used
  start: [
    {
      regex: /\>\-\n\s*/,
      token: 'literal-block',
    },
    {
      regex: /^\s*[\$A-Za-z0-9_-]+\:/,
      token: 'key',
    },
    {
      regex: /^\s-\s*[\$A-Za-z0-9_-]+\:/,
      token: 'array',
    },
    {
      regex: /(\{|\})/,
      token: 'object-bracelet',
    },
    {
      regex: /[\:\s](\d+$)/,
      token: 'number',
    },
    {
      regex: /[^:\s]\d+\.\d+\.\d+\.\d+$/,
      token: 'ip',
    },
    {
      regex: / (y|yes|n|no|true|false|on|off|'true'|'false'|'True'|'False'|'TRUE'|'FALSE')$/,
      token: 'boolean',
    },
    {
      regex: /\[" "\]" ":\s+[|>]" "^\s*- /,
      token: 'array',
    },
    {
      regex: /(^| )!!(binary|bool|float|int|map|null|omap|seq|set|str) /,
      token: 'reserved',
    },
    {
      regex: /#.*$/,
      token: 'comment',
    },
    {
      regex: /['\"][^['\"]]*$/,
      token: 'none-closed-quote',
    },
    {
      regex: /['\"].*['\"]/,
      token: 'closed-quote',
    },
    {
      regex: /:( |$)/,
      token: 'equal-sign',
    },
    {
      regex: /[\:\s](null|undifined)/,
      token: 'null',
    },
  ],
}

export const modeLogger = {
  // The start state contains the rules that are intially used
  start: [
    // Agent Syntax
    {
      regex: /true|false|TRUE|FALSE/,
      token: 'boolean',
    },
    {
      regex: /errors|Errors|ERRORS|error|Error|ERROR/,
      token: 'error',
    },
  ],
}
