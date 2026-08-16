import {awaitCloudHubApproval} from './cloudhub-approval.js'
import {evaluateToolCall} from './policy.js'

const CLOUDHUB_APPROVAL_BLOCK_REASON =
  'CloudHub 승인이 완료되지 않아 NetworkPolicy 변경을 차단했습니다.'

export function createBeforeToolCallHandler(
  api,
  {
    awaitApproval = awaitCloudHubApproval,
    token = process.env.MCP_SERVICE_TOKEN ?? '',
  } = {}
) {
  return async (event, context) => {
    const toolName = String(event.toolName ?? '')
    api.logger?.info?.(
      `[command-approval-policy] tool=${toolName} agent=${
        context?.agentId ?? 'unknown'
      }`
    )

    const result = evaluateToolCall(toolName, event.params)
    if (!result) {
      return undefined
    }
    if (result.block) {
      api.logger?.warn?.(`[command-approval-policy] blocked: tool=${toolName}`)
      return result
    }
    if (result.cloudHubApproval) {
      let decision
      try {
        decision = await awaitApproval({
          baseURL: api.pluginConfig?.cloudHubApprovalURL,
          token,
          sessionKey: context?.sessionKey,
          toolName,
          toolCallId: stableString(event.toolCallId ?? context?.toolCallId),
          idempotencyKey: '',
          approval: result.cloudHubApproval,
          insecureSkipVerify:
            api.pluginConfig?.cloudHubApprovalInsecureSkipVerify === true,
        })
      } catch {
        api.logger?.warn?.(
          `[command-approval-policy] CloudHub approval failed: tool=${toolName}`
        )
        return cloudHubApprovalBlock()
      }
      if (decision === 'allow-once') {
        api.logger?.info?.(
          `[command-approval-policy] CloudHub approval allowed: tool=${toolName}`
        )
        return undefined
      }
      api.logger?.warn?.(
        `[command-approval-policy] CloudHub approval not granted: tool=${toolName}`
      )
      return cloudHubApprovalBlock()
    }

    const approval = result.requireApproval
    if (!approval) {
      return result
    }
    api.logger?.info?.(
      `[command-approval-policy] approval requested: tool=${toolName}`
    )
    return {
      requireApproval: {
        ...approval,
        onResolution(decision) {
          api.logger?.info?.(
            `[command-approval-policy] decision=${decision} tool=${toolName}`
          )
        },
      },
    }
  }
}

function stableString(value) {
  return typeof value === 'string' ? value : ''
}

function cloudHubApprovalBlock() {
  return {block: true, blockReason: CLOUDHUB_APPROVAL_BLOCK_REASON}
}
