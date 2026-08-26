/*
  Client-side mirror of the backend's skill rules
  (backend/server/openclaw_skill_authoring.go).

  The backend is still the authority — everything here is checked again there.
  The point of duplicating it is that the author sees the rule while typing
  instead of after a save comes back 422.
*/

export const MAIN_PATH = 'SKILL.md'

export const MAX_NAME_LENGTH = 64
export const MAX_BODY_BYTES = 40000
export const MAX_DESC_BYTES = 160
export const MAX_SUPPORT_FILES = 50
export const MAX_TOTAL_BYTES = 1 << 20

/*
  The backend also accepts `assets/`, but support file content travels as a
  UTF-8 string and is rejected if it contains a null byte, so nothing binary
  can go there. Offering the folder would promise an attachment that cannot be
  saved, so the picker leaves it out.
*/
export const SUPPORT_FOLDERS = [
  'references/',
  'scripts/',
  'examples/',
  'templates/',
]

const NAME_PATTERN = /^[a-z][a-z0-9_-]*$/

// Command names OpenClaw owns. A skill taking one would be shadowed by the
// built-in command.
const RESERVED_NAMES = new Set([
  'help',
  'commands',
  'status',
  'diagnostics',
  'codex',
  'whoami',
  'context',
  'btw',
  'stop',
  'restart',
  'reset',
  'new',
  'compact',
  'config',
  'debug',
  'allowlist',
  'activation',
  'skill',
  'learn',
  'subagents',
  'kill',
  'steer',
  'tell',
  'model',
  'models',
  'queue',
  'send',
  'bash',
  'exec',
  'think',
  'verbose',
  'reasoning',
  'elevated',
  'usage',
])

const encoder = new TextEncoder()

// The backend counts bytes, not characters, so a Korean description reaches
// the limit about three times sooner than its length suggests.
export const byteLength = (text: string): number => encoder.encode(text).length

export interface SkillIssue {
  key: string
  values?: Record<string, string | number>
}

export interface Frontmatter {
  name: string
  description: string
}

/*
  Does this value open a YAML block scalar, and is it folded (">", lines joined
  with spaces) rather than literal ("|", lines joined with newlines)? Chomping
  and indentation indicators such as "|-" or ">2" are accepted and ignored.
*/
const blockScalarStyle = (value: string): {folded: boolean} | null => {
  if (!value || (value[0] !== '|' && value[0] !== '>')) {
    return null
  }
  if (!/^[-+0-9]*$/.test(value.slice(1))) {
    return null
  }
  return {folded: value[0] === '>'}
}

/*
  Collect the indented lines making up a block scalar that opens at
  `lines[start]`, and report the last line index it consumed.
*/
const readBlockScalar = (
  lines: string[],
  start: number,
  folded: boolean
): {value: string; last: number} => {
  const block: string[] = []
  let last = start

  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (line.trim() === '') {
      block.push('')
      last = i
      continue
    }
    if (line[0] !== ' ' && line[0] !== '\t') {
      break
    }
    block.push(line.trim())
    last = i
  }

  while (block.length && block[block.length - 1] === '') {
    block.pop()
  }

  return {value: block.join(folded ? ' ' : '\n').trim(), last}
}

/**
 * Read `name` and `description` out of the SKILL.md frontmatter the same way
 * the backend does — a line scan of the top-level keys, not a YAML parse.
 * Returns null when the frontmatter is absent or unterminated.
 *
 * Only top-level keys count. A key indented under something else belongs to
 * that structure; reading one as the skill's own field is how a parameter's
 * description used to become the skill's.
 */
export const readFrontmatter = (main: string): Frontmatter | null => {
  if (!main.startsWith('---')) {
    return null
  }
  const rest = main.slice(3)
  const end = rest.indexOf('\n---')
  if (end < 0) {
    return null
  }

  const lines = rest.slice(0, end).split('\n')
  const found: Frontmatter = {name: '', description: ''}

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line || line[0] === ' ' || line[0] === '\t' || line.startsWith('#')) {
      continue
    }

    const separator = line.indexOf(':')
    if (separator < 0) {
      continue
    }
    const key = line.slice(0, separator).trim()
    if (key !== 'name' && key !== 'description') {
      continue
    }

    const raw = line.slice(separator + 1).trim()
    const style = blockScalarStyle(raw)
    let value: string

    if (style) {
      const block = readBlockScalar(lines, i, style.folded)
      value = block.value
      i = block.last
    } else {
      value = raw.replace(/^["']|["']$/g, '')
    }

    found[key] = value
  }

  return found
}

/**
 * Every reason the current SKILL.md would be refused.
 *
 * `expectedName` is the name of the skill being revised. A revision may not
 * rename its skill, because the Gateway would keep holding the old name with
 * nothing pointing at it.
 */
export const validateMain = (
  main: string,
  expectedName?: string
): SkillIssue[] => {
  const issues: SkillIssue[] = []
  const bytes = byteLength(main)

  if (bytes > MAX_BODY_BYTES) {
    issues.push({key: 'body_too_large', values: {bytes, max: MAX_BODY_BYTES}})
  }

  if (!main.trim()) {
    return [{key: 'main_required'}]
  }

  const frontmatter = readFrontmatter(main)
  if (!frontmatter) {
    issues.push({key: 'frontmatter_missing'})
    return issues
  }

  const {name, description} = frontmatter

  if (!name) {
    issues.push({key: 'name_missing'})
  } else if (name.length > MAX_NAME_LENGTH) {
    issues.push({key: 'name_too_long', values: {max: MAX_NAME_LENGTH}})
  } else if (!NAME_PATTERN.test(name)) {
    issues.push({key: 'name_pattern', values: {name}})
  } else if (RESERVED_NAMES.has(name)) {
    issues.push({key: 'name_reserved', values: {name}})
  } else if (expectedName && name !== expectedName) {
    issues.push({key: 'name_mismatch', values: {name, expected: expectedName}})
  }

  if (!description) {
    issues.push({key: 'description_missing'})
  } else {
    const descBytes = byteLength(description)
    if (descBytes > MAX_DESC_BYTES) {
      issues.push({
        key: 'description_too_long',
        values: {bytes: descBytes, max: MAX_DESC_BYTES},
      })
    }
  }

  return issues
}

export interface SupportFileLike {
  path: string
  content: string
}

/** Every reason the current support file set would be refused. */
export const validateSupportFiles = (
  files: SupportFileLike[],
  mainBytes: number
): SkillIssue[] => {
  const issues: SkillIssue[] = []

  if (files.length > MAX_SUPPORT_FILES) {
    issues.push({
      key: 'too_many_files',
      values: {count: files.length, max: MAX_SUPPORT_FILES},
    })
  }

  const seen = new Set<string>()
  let total = mainBytes

  files.forEach(file => {
    total += byteLength(file.content)

    if (!file.path.trim()) {
      issues.push({key: 'file_path_required'})
      return
    }
    if (!SUPPORT_FOLDERS.some(folder => file.path.startsWith(folder))) {
      issues.push({key: 'file_path_folder', values: {path: file.path}})
      return
    }
    if (file.path.split('/').some(part => !part || part.startsWith('.'))) {
      issues.push({key: 'file_path_segment', values: {path: file.path}})
      return
    }
    if (seen.has(file.path)) {
      issues.push({key: 'file_path_duplicate', values: {path: file.path}})
    }
    seen.add(file.path)
  })

  if (total > MAX_TOTAL_BYTES) {
    issues.push({
      key: 'total_too_large',
      values: {bytes: total, max: MAX_TOTAL_BYTES},
    })
  }

  return issues
}

/** Split a support path into its folder prefix and the name below it. */
export const splitPath = (path: string): {folder: string; name: string} => {
  const folder = SUPPORT_FOLDERS.find(candidate => path.startsWith(candidate))
  if (!folder) {
    return {folder: SUPPORT_FOLDERS[0], name: path}
  }
  return {folder, name: path.slice(folder.length)}
}

/**
 * Guess which folder an uploaded file belongs in from its extension. Only a
 * starting point — the author can change it.
 */
export const folderForFile = (fileName: string): string => {
  if (/\.(sh|py|rb|pl|js|ts)$/i.test(fileName)) {
    return 'scripts/'
  }
  if (/\.(tmpl|tpl|j2|mustache)$/i.test(fileName)) {
    return 'templates/'
  }
  return 'references/'
}
