const SHELL_TOOL_NAMES = new Set(['exec', 'bash', 'shell', 'system.run'])

const NETWORK_REPAIR_TOOLS = new Set([
  'mcp__k8s_network__repair_network_policy_port',
  'k8s_network__repair_network_policy_port',
])

const BLOCKED_PATTERNS = [
  {
    name: '루트 파일시스템 삭제',
    pattern: /\brm\s+(?:-[^\s]*r[^\s]*f|-[^\s]*f[^\s]*r)\s+\/(?:\s|$)/i,
  },
  {
    name: '블록 장치 포맷',
    pattern: /\bmkfs(?:\.[a-z0-9_-]+)?\b/i,
  },
  {
    name: '블록 장치 덮어쓰기',
    pattern: /\bdd\b[\s\S]*\bof\s*=\s*\/dev\//i,
  },
  {
    name: 'Fork bomb',
    pattern: /:\(\)\s*\{\s*:\|:&\s*\};:/i,
  },
]

const MCP_BYPASS_PATTERNS = [
  {
    name: 'Elasticsearch MCP 우회 접근',
    pattern: /(?:elasticsearch-mcp|localhost:9200|127\.0\.0\.1:9200|10\.20\.2\.232:30920|\bcurl\b[\s\S]*(?:\/_cat\/|\/_search\b|\/_cluster\/)|\bmcporter\b[\s\S]*\belasticsearch\b)/i,
  },
  {
    name: 'InfluxDB MCP 우회 접근',
    pattern: /(?:influx-mcp|localhost:8086|127\.0\.0\.1:8086|\bmcporter\b[\s\S]*\binfluxdb\b)/i,
  },
  {
    name: 'Notion MCP 우회 접근',
    pattern: /(?:notion-mcp|\bmcporter\b[\s\S]*\bnotion\b)/i,
  },
  {
    name: 'CloudHub Plugin Tool 우회 접근',
    pattern: /(?:\bcurl\b[\s\S]*(?:10\.20\.2\.227|\/basic\/login\b|\/cloudhub\/v1\b)|\bmcporter\b[\s\S]*\bcloudhub\b)/i,
  },
]

const APPROVAL_PATTERNS = [
  {
    name: '승인 기능 테스트',
    pattern: /\bapproval-test\b/i,
  },
  {
    name: 'sudo 권한 명령',
    pattern: /(^|[;&|]\s*)sudo(?:\s|$)/i,
  },
  {
    name: '서비스 상태 변경',
    pattern: /\bsystemctl\s+(?:restart|stop|disable|mask|daemon-reload)\b/i,
  },
  {
    name: '파일 삭제',
    pattern: /(^|[;&|]\s*)rm(?:\s|$)/i,
  },
  {
    name: '소유권 변경',
    pattern: /(^|[;&|]\s*)chown(?:\s|$)/i,
  },
  {
    name: '권한 변경',
    pattern: /(^|[;&|]\s*)chmod(?:\s|$)/i,
  },
  {
    name: 'Docker 리소스 삭제',
    pattern: /\bdocker\s+(?:rm|rmi|kill|system\s+prune|volume\s+rm|network\s+rm)\b/i,
  },
  {
    name: 'Docker Compose 종료',
    pattern: /\bdocker\s+compose\s+(?:down|rm|kill)\b/i,
  },
  {
    name: 'Kubernetes 리소스 변경',
    pattern: /\bkubectl\s+(?:delete|drain|cordon|taint|replace|patch)\b/i,
  },
  {
    name: '시스템 종료 또는 재부팅',
    pattern: /\b(?:shutdown|reboot|poweroff|halt)\b/i,
  },
]

function readCommand(params) {
  if (!params || typeof params !== 'object') {
    return ''
  }

  const candidates = [params.command, params.cmd, params.script, params.input]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }

    if (Array.isArray(value)) {
      return value.map(String).join(' ').trim()
    }
  }

  return ''
}

function truncateCodePoints(value, maximum) {
  const codePoints = [...String(value)]
  if (codePoints.length <= maximum) {
    return codePoints.join('')
  }
  return `${codePoints.slice(0, maximum - 1).join('')}…`
}

function networkRepairApproval(params) {
  const values =
    params?.arguments && typeof params.arguments === 'object'
      ? params.arguments
      : params ?? {}
  const hasDetails =
    typeof values.namespace === 'string' &&
    values.namespace !== '' &&
    typeof values.policyName === 'string' &&
    values.policyName !== '' &&
    Number.isInteger(values.expectedCurrentPort) &&
    Number.isInteger(values.desiredPort)
  const description = hasDetails
    ? `${values.namespace}/${values.policyName} TCP ${values.expectedCurrentPort} → ${values.desiredPort}`
    : 'NetworkPolicy 포트 복구 요청 (세부 정보 없음)'

  return {
    cloudHubApproval: {
      title: 'NetworkPolicy 복구 승인',
      description: truncateCodePoints(description, 256),
      severity: 'warning',
      allowedDecisions: ['allow-once', 'deny'],
      timeoutMs: 120000,
    },
  }
}

export function evaluateToolCall(toolName, params) {
  if (NETWORK_REPAIR_TOOLS.has(String(toolName ?? ''))) {
    return networkRepairApproval(params)
  }

  if (!SHELL_TOOL_NAMES.has(String(toolName ?? ''))) {
    return undefined
  }

  const command = readCommand(params)
  if (!command) {
    return undefined
  }

  const backendBypass = MCP_BYPASS_PATTERNS.find(({pattern}) =>
    pattern.test(command)
  )
  if (backendBypass) {
    return {
      block: true,
      blockReason: [
        '등록된 backend 도구를 우회하는 접근이 차단되었습니다.',
        `정책: ${backendBypass.name}`,
        '등록된 MCP 또는 Plugin Tool을 직접 사용하세요.',
      ].join('\n'),
    }
  }

  const blocked = BLOCKED_PATTERNS.find(({pattern}) => pattern.test(command))
  if (blocked) {
    return {
      block: true,
      blockReason: [
        '보안 정책에 의해 명령 실행이 차단되었습니다.',
        `정책: ${blocked.name}`,
        `명령: ${command}`,
      ].join('\n'),
    }
  }

  const approval = APPROVAL_PATTERNS.find(({pattern}) => pattern.test(command))
  if (!approval) {
    return undefined
  }

  return {
    requireApproval: {
      title: '명령 실행 승인',
      description: [`분류: ${approval.name}`, `명령: ${command}`].join('\n'),
      severity: 'warning',
      allowedDecisions: ['allow-once', 'deny'],
      timeoutMs: 120000,
    },
  }
}
