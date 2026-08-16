import assert from 'node:assert/strict'
import test from 'node:test'

import {evaluateToolCall} from './policy.js'

const repairParams = {
  namespace: 'network-repair-demo',
  sourceWorkload: 'frontend',
  destinationService: 'backend',
  policyName: 'allow-frontend-to-backend',
  expectedCurrentPort: 8081,
  desiredPort: 8080,
}

test('both NetworkPolicy repair tool names use CloudHub-managed approval', () => {
  for (const toolName of [
    'mcp__k8s_network__repair_network_policy_port',
    'k8s_network__repair_network_policy_port',
  ]) {
    const result = evaluateToolCall(toolName, {
      ...repairParams,
      planId: 'ignored-plan-id',
    })
    assert.ok(result?.cloudHubApproval, toolName)
    assert.equal(result.requireApproval, undefined)
    assert.equal(result.cloudHubApproval.title, 'NetworkPolicy 복구 승인')
    assert.deepEqual(result.cloudHubApproval.allowedDecisions, [
      'allow-once',
      'deny',
    ])
    assert.equal(result.cloudHubApproval.timeoutMs, 120000)
    assert.match(result.cloudHubApproval.description, /8081 → 8080/)
    assert.match(result.cloudHubApproval.description, /network-repair-demo/)
    assert.match(
      result.cloudHubApproval.description,
      /allow-frontend-to-backend/
    )
    assert.doesNotMatch(
      result.cloudHubApproval.description,
      /planId|ignored-plan-id|sourceWorkload|destinationService/
    )
    assert.ok([...result.cloudHubApproval.description].length <= 256)
  }
})

test('legacy, read-only, and unrelated tools do not require approval', () => {
  for (const toolName of [
    'mcp__k8s_network__inspect_network_policy_path',
    'mcp__k8s_network__plan_network_policy_port_repair',
    'mcp__k8s_network__verify_network_policy_repair',
    'k8s_network__inspect_network_policy_path',
    'k8s_network__plan_network_policy_port_repair',
    'k8s_network__verify_network_policy_repair',
    'mcp__k8s_network__apply_network_policy_repair',
    'k8s_network__apply_network_policy_repair',
    'mcp__k8s_network__unrelated_mutator',
    'k8s_network__unrelated_mutator',
  ]) {
    assert.equal(evaluateToolCall(toolName, repairParams), undefined, toolName)
  }
})

test('missing or very long fields never bypass approval and stay bounded', () => {
  const missing = evaluateToolCall(
    'k8s_network__repair_network_policy_port',
    {}
  )
  assert.ok(missing?.cloudHubApproval)
  assert.equal(missing.requireApproval, undefined)
  assert.match(missing.cloudHubApproval.description, /세부 정보 없음/)

  const longValue = '가'.repeat(400)
  const long = evaluateToolCall(
    'mcp__k8s_network__repair_network_policy_port',
    {
      ...repairParams,
      namespace: longValue,
      policyName: longValue,
    }
  )
  assert.ok(long?.cloudHubApproval)
  assert.equal(long.requireApproval, undefined)
  assert.ok([...long.cloudHubApproval.description].length <= 256)
})

test('existing shell blocking and approval behavior is preserved', () => {
  const bypass = evaluateToolCall('exec', {
    command: 'curl http://localhost:9200/_cat/indices',
  })
  assert.equal(bypass?.block, true)
  assert.match(bypass.blockReason, /Elasticsearch MCP 우회 접근/)

  const destructive = evaluateToolCall('bash', {command: 'rm -rf /'})
  assert.equal(destructive?.block, true)
  assert.match(destructive.blockReason, /루트 파일시스템 삭제/)

  const risky = evaluateToolCall('shell', {command: 'rm old-file'})
  assert.ok(risky?.requireApproval)
  assert.equal(risky.requireApproval.title, '명령 실행 승인')
  assert.deepEqual(risky.requireApproval.allowedDecisions, [
    'allow-once',
    'deny',
  ])
  assert.equal(risky.requireApproval.timeoutMs, 120000)
})
