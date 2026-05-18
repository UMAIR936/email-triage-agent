// tests/unit/classifier.test.ts
// Unit tests for the classifier node.
// We MOCK the Anthropic SDK so tests are fast and free.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { classifierNode } from '../../src/agent/nodes/classifier'
import { AgentState } from '../../src/agent/state'

// Mock the entire Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}))

import Anthropic from '@anthropic-ai/sdk'

const mockCreate = vi.mocked(new Anthropic().messages.create)

const baseEmail: AgentState['email'] = {
  messageId: 'msg_001',
  threadId: 'thread_001',
  subject: 'Test email',
  from: 'sender@example.com',
  body: 'Hello, can we meet tomorrow at 2pm?',
  date: '2024-01-15T10:00:00Z',
  snippet: 'Hello, can we meet tomorrow',
}

const baseState: AgentState = {
  userId: 'user_001',
  email: baseEmail,
}

describe('classifierNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('classifies a meeting request as action-required with reply action', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          urgency: 'medium',
          category: 'action-required',
          intent: 'requesting a meeting tomorrow at 2pm',
          action: 'reply',
          confidence: 0.92,
        }),
      }],
    } as any)

    const result = await classifierNode(baseState)

    expect(result.classification?.category).toBe('action-required')
    expect(result.classification?.action).toBe('reply')
    expect(result.classification?.confidence).toBeGreaterThan(0.5)
  })

  it('classifies an urgent deadline email as high urgency', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          urgency: 'high',
          category: 'action-required',
          intent: 'contract deadline tomorrow, requires signature',
          action: 'flag',
          confidence: 0.97,
        }),
      }],
    } as any)

    const result = await classifierNode({
      ...baseState,
      email: { ...baseEmail, subject: 'URGENT: Contract deadline tomorrow' },
    })

    expect(result.classification?.urgency).toBe('high')
    expect(result.classification?.action).toBe('flag')
  })

  it('classifies a newsletter as low urgency with archive action', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          urgency: 'low',
          category: 'newsletter',
          intent: 'marketing newsletter',
          action: 'archive',
          confidence: 0.99,
        }),
      }],
    } as any)

    const result = await classifierNode({
      ...baseState,
      email: { ...baseEmail, subject: 'Your weekly digest is here!' },
    })

    expect(result.classification?.urgency).toBe('low')
    expect(result.classification?.action).toBe('archive')
  })

  it('falls back to a safe default if LLM returns invalid JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Sorry, I cannot classify this.' }],
    } as any)

    const result = await classifierNode(baseState)

    // Should not throw — should return a safe fallback
    expect(result.classification).toBeDefined()
    expect(result.classification?.confidence).toBeLessThan(0.5)
  })

  it('calls the LLM with the email body truncated to 2000 chars', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          urgency: 'low', category: 'informational',
          intent: 'test', action: 'archive', confidence: 0.8,
        }),
      }],
    } as any)

    const longBody = 'x'.repeat(5000)
    await classifierNode({ ...baseState, email: { ...baseEmail, body: longBody } })

    const callArg = mockCreate.mock.calls[0][0] as any
    const prompt = callArg.messages[0].content as string
    // The body in the prompt should be truncated
    expect(prompt).not.toContain('x'.repeat(2001))
  })
})
