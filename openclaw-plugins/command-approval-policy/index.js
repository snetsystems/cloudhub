import {definePluginEntry} from 'openclaw/plugin-sdk/plugin-entry'

import {createBeforeToolCallHandler} from './handler.js'

export default definePluginEntry({
  id: 'command-approval-policy',
  name: 'Command Approval Policy',
  description: 'Applies command-level blocking and approval rules.',

  register(api) {
    api.on('before_tool_call', createBeforeToolCallHandler(api), {
      priority: 100,
    })
  },
})
