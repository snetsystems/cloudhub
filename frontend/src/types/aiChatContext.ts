/**
 * Data a page hands to AI Chat, and what the chat should do with it.
 *
 * Every screen packages what it knows into an AiContextCapsule, so AI Chat
 * never learns about individual pages. How a capsule is turned into text for
 * the agent is decided by its `type`, registered in
 * src/ai_chat/utils/aiContextRegistry.
 */
export interface AiContextCapsule<T = any> {
  /** Stable per subject, so attaching the same host twice does not duplicate. */
  id: string
  /** Registry key that decides how this capsule is described and rendered. */
  type: string
  /** Where it came from, for display and for later analytics. */
  sourcePage: string
  /** Short label shown on the chip, e.g. a host name. */
  title: string
  /** One line of detail shown under the title, e.g. "CPU 94%, MEM 62%". */
  summary?: string
  /** The raw record. Never sent verbatim; the registry decides what is sent. */
  payload: T
  capturedAt: number
}

/**
 * What AI Chat should do with an intent.
 *
 * These are deliberately independent fields rather than a mode enum: a new
 * interaction is expressed by combining them, so adding one does not mean
 * adding a branch inside AI Chat.
 *
 *   one-click diagnose  {context, prompt, autoSend: true}
 *   attach only         {context}
 *   quote a selection   {context: {type: 'text'}, prompt, autoSend: true}
 *   prefill the box     {prompt, autoSend: false}
 */
export interface AiChatIntent {
  context?: AiContextCapsule
  prompt?: string
  /**
   * Skill command to seed the composer with, e.g. '/cloudhub_server_health'.
   *
   * It is placed in the input as ordinary text ahead of whatever is already
   * typed, never injected at send time. A caller suggests a skill; the user
   * can delete it and ask something unrelated instead. An input that already
   * begins with a command is left alone, because the user has chosen one.
   */
  skill?: string
  /** Send immediately. Omitted or false leaves the prompt in the input box. */
  autoSend?: boolean
  /** 'new' starts a fresh session instead of using the open one. */
  target?: 'active' | 'new'
  /** Reveal the chat. Defaults to true; pass false to attach silently. */
  openDrawer?: boolean
}

/** An intent waiting for AI Chat to pick it up. */
export interface PendingAiChatIntent extends AiChatIntent {
  /**
   * Identifies this delivery. AI Chat consumes by id so that a re-mount, which
   * happens on every route change today, cannot replay an already-sent prompt.
   */
  intentId: string
}

export interface AiChatContextState {
  pendingIntent: PendingAiChatIntent | null
  /** Capsules currently attached to the composer, shown as chips. */
  attachments: AiContextCapsule[]
}
