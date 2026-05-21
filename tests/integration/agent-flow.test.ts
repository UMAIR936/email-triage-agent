// tests/integration/agent-flow.test.ts
// Tests the full LangGraph flow end-to-end with mocked LLM calls.
// This is an integration test — it runs the real graph but mocks external APIs.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Anthropic so no real API calls happen
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}))

// Mock Gmail client
vi.mock('../../src/gmail/client', () => ({
  gmailClient: {
    addLabel: vi.fn().mockResolvedValue(undefined),
    removeLabel: vi.fn().mockResolvedValue(undefined),
  },
}))

// Mock DB
vi.mock('../../src/utils/db', () => ({
  db: {
    styleProfile: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}))

import Anthropic from '@anthropic-ai/sdk'
import { runAgent } from '../../src/agent/graph'

const mockCreate = vi.mocked(new Anthropic().messages.create)

const testEmail = {
  messageId: 'msg_test',
  threadId: 'thread_test',
  subject: 'Project update needed',
  from: 'manager@company.com',
  body: 'Hi, can you send me the project status update by Friday?',
  date: '2024-01-15T10:00:00Z',
  snippet: 'can you send me the project status update',
}

describe('Full agent flow (integration)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('routes a reply-needed email through to drafter and returns a draft', async () => {
    // First call: classifier
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          urgency: 'medium',
          category: 'action-required',
          intent: 'requesting a project status update by Friday',
          action: 'reply',
          confidence: 0.95,
        }),
      }],
    } as any)

    // Second call: drafter
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: 'Hi,\n\nI\'ll have the project status update to you by Friday.\n\nBest,\nUmair',
      }],
    } as any)

    const result = await runAgent('user_001', testEmail)

    expect(result.classification?.action).toBe('reply')
    expect(result.draft).toBeTruthy()
    expect(result.draft).toContain('Friday')
    // Drafter should have been called (2 total LLM calls)
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it('routes an urgent email to flag_urgent — skips drafter', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          urgency: 'high',
          category: 'action-required',
          intent: 'server is down, needs immediate attention',
          action: 'flag',
          confidence: 0.99,
        }),
      }],
    } as any)

    const { gmailClient } = await import('../../src/gmail/client')
    const result = await runAgent('user_001', {
      ...testEmail,
      subject: 'URGENT: Production is down!',
    })

    expect(result.classification?.urgency).toBe('high')
    expect(result.draft).toBeUndefined()
    // Drafter should NOT have been called
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(gmailClient.addLabel).toHaveBeenCalledWith('user_001', 'thread_test', 'URGENT_AI')
  })

  it('routes a deferrable email to snooze — skips drafter', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          urgency: 'low',
          category: 'informational',
          intent: 'newsletter about company events next month',
          action: 'defer',
          confidence: 0.88,
        }),
      }],
    } as any)

    const { gmailClient } = await import('../../src/gmail/client')
    await runAgent('user_001', { ...testEmail, subject: 'Company events next month' })

    expect(gmailClient.addLabel).toHaveBeenCalledWith('user_001', 'thread_test', 'SNOOZED_3_DAYS')
    expect(gmailClient.removeLabel).toHaveBeenCalledWith('user_001', 'thread_test', 'INBOX')
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })
})
