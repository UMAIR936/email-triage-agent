// tests/unit/drafter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { drafterNode } from '../../src/agent/nodes/drafter'
import { AgentState } from '../../src/agent/state'

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}))

import Anthropic from '@anthropic-ai/sdk'
const mockCreate = vi.mocked(new Anthropic().messages.create)

const baseState: AgentState = {
  userId: 'user_001',
  email: {
    messageId: 'msg_001',
    threadId: 'thread_001',
    subject: 'Quick question',
    from: 'ali@example.com',
    body: 'Hey, are you free for a call tomorrow at 3pm?',
    date: '2024-01-15T10:00:00Z',
    snippet: 'Hey, are you free',
  },
  classification: {
    urgency: 'medium',
    category: 'action-required',
    intent: 'requesting a call tomorrow at 3pm',
    action: 'reply',
    confidence: 0.9,
  },
  styleContext: 'Use "Hi" as greeting. Use "Best" as sign-off. Keep it short.',
}

describe('drafterNode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a draft string', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Hi Ali,\n\nYes, 3pm works for me. Talk soon.\n\nBest,\nUmair' }],
    } as any)

    const result = await drafterNode(baseState)
    expect(typeof result.draft).toBe('string')
    expect(result.draft!.length).toBeGreaterThan(10)
  })

  it('trims whitespace from the draft', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '   Hi,\n\nSure!\n\nBest   ' }],
    } as any)

    const result = await drafterNode(baseState)
    expect(result.draft).toBe('Hi,\n\nSure!\n\nBest')
  })

  it('injects style context into the prompt', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Hi,\n\nSure!\n\nBest' }],
    } as any)

    await drafterNode(baseState)

    const callArg = mockCreate.mock.calls[0][0] as any
    const prompt = callArg.messages[0].content as string
    expect(prompt).toContain('Use "Hi" as greeting')
  })

  it('uses a default style when no styleContext is provided', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Hi,\n\nSounds good.\n\nBest' }],
    } as any)

    const stateWithoutStyle = { ...baseState, styleContext: undefined }
    await drafterNode(stateWithoutStyle)

    const callArg = mockCreate.mock.calls[0][0] as any
    const prompt = callArg.messages[0].content as string
    expect(prompt).toContain('professional')
  })

  it('does not include a Subject: line in the draft', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Hi Ali,\n\nWorks for me.\n\nBest' }],
    } as any)

    const result = await drafterNode(baseState)
    expect(result.draft).not.toMatch(/^Subject:/im)
  })
})
