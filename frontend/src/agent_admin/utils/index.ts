// constants
import {
  WINDOW_AGENT_TELEGRAF_CONFIG,
  AGENT_TELEGRAF_CONFIG,
} from 'src/agent_admin/constants'

// types
import {TelegrafPlugin} from 'src/agent_admin/type/agent'

export const extractTelegrafVersion = (text: string) => {
  if (!text) {
    return {
      version: '',
    }
  }

  const lines = text.split('\n')
  const versionLine =
    lines.find(line => line.trim().startsWith('Telegraf'))?.trim() || ''

  const [beforeGit] = versionLine.split('(git:').map(part => part.trim())

  const version = beforeGit.replace(/^Telegraf\s+/, '')
  return {
    version,
  }
}

export const getTelegrafConfigPath = (osType: string) => {
  return osType.toLowerCase() == 'windows'
    ? WINDOW_AGENT_TELEGRAF_CONFIG
    : AGENT_TELEGRAF_CONFIG
}

export const extractNumericVersion = (versionStr: string): string => {
  const match = versionStr.match(/^(\d+\.\d+)/)
  return match ? match[1] : versionStr
}

export const parsePluginsV3 = (pluginStr: string): TelegrafPlugin[] => {
  return pluginStr
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => {
      const parts = line.split('.')
      return {
        category: parts[0],
        name: parts.slice(1).join('.'),
        isActive: false,
      }
    })
}

export const parsePluginsV2 = (
  pluginStr: string,
  defaultCategory: string
): TelegrafPlugin[] => {
  return pluginStr
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false
      const lower = line.toLowerCase()
      if (lower.startsWith('deprecated:')) return false
      if (lower.startsWith('available input plugins:')) return false
      if (lower.startsWith('available output plugins:')) return false
      return true
    })
    .map(line => ({
      category: defaultCategory,
      name: line,
      isActive: false,
    }))
}
