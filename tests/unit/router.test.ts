// tests/unit/router.test.ts
import { describe, it, expect } from 'vitest'
import { routerNode } from '../../src/agent/nodes/router'
import { AgentState } from '../../src/agent/state'

const baseEmail: AgentState['email'] = {
  messageId: 'msg_001', threadId: 'thread_001',
  subject: 'Test', from: 'a@b.com',
  body: 'Hello', date: '2024-01-15', snippet: 'Hello',
}

const makeState = (overrides: Partial<AgentState['classification']>): AgentState => ({
  userId: 'user_001',
  email: baseEmail,
  classification: {
    urgency: 'medium',
    category: 'action-required',
    intent: 'test',
    action: 'reply',
    confidence: 0.9,
    ...overrides,
  },
})

describe('routerNode', () => {
  it('routes high urgency to flag_urgent', () => {
    expect(routerNode(makeState({ urgency: 'high' }))).toBe('flag_urgent')
  })

  it('routes action=flag to flag_urgent regardless of urgency', () => {
    expect(routerNode(makeState({ action: 'flag', urgency: 'medium' }))).toBe('flag_urgent')
  })

  it('routes action=defer to snooze', () => {
    expect(routerNode(makeState({ action: 'defer' }))).toBe('snooze')
  })

  it('routes action=reply to drafter', () => {
    expect(routerNode(makeState({ action: 'reply' }))).toBe('drafter')
  })

  it('routes action=archive to done', () => {
    expect(routerNode(makeState({ action: 'archive' }))).toBe('done')
  })

  it('routes action=ignore to done', () => {
    expect(routerNode(makeState({ action: 'ignore' }))).toBe('done')
  })

  it('returns done if classification is missing', () => {
    expect(routerNode({ userId: 'u', email: baseEmail })).toBe('done')
  })
})
