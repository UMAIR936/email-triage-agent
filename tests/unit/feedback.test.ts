// tests/unit/feedback.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Prisma before importing feedback
vi.mock('../../src/utils/db', () => ({
  db: {
    feedbackLog: { create: vi.fn() },
    styleProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { processFeedback } from '../../src/memory/feedback'
import { db } from '../../src/utils/db'

const mockProfile = {
  userId: 'user_001',
  greeting: 'Hi',
  signoff: 'Best',
  formalityScore: 0.5,
  avgSentenceLength: 15,
  commonPhrases: [],
  avoidPhrases: [],
  exampleReplies: [],
  updatedAt: new Date(),
}

describe('processFeedback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('always logs feedback to feedbackLog', async () => {
    vi.mocked(db.styleProfile.findUnique).mockResolvedValue(mockProfile as any)
    vi.mocked(db.styleProfile.update).mockResolvedValue(mockProfile as any)

    await processFeedback({
      userId: 'user_001', emailId: 'e1',
      draft: 'Hello draft', action: 'approve',
    })

    expect(db.feedbackLog.create).toHaveBeenCalledOnce()
  })

  it('does NOT update style profile on reject', async () => {
    await processFeedback({
      userId: 'user_001', emailId: 'e1',
      draft: 'Hello draft', action: 'reject',
    })

    expect(db.styleProfile.update).not.toHaveBeenCalled()
  })

  it('adds draft to exampleReplies on approve', async () => {
    vi.mocked(db.styleProfile.findUnique).mockResolvedValue(mockProfile as any)
    vi.mocked(db.styleProfile.update).mockResolvedValue(mockProfile as any)

    await processFeedback({
      userId: 'user_001', emailId: 'e1',
      draft: 'Hi,\n\nSounds good.\n\nBest', action: 'approve',
    })

    const updateCall = vi.mocked(db.styleProfile.update).mock.calls[0][0]
    const examples = (updateCall.data as any).exampleReplies
    expect(examples.length).toBe(1)
    expect(examples[0].edited).toBeNull()
  })

  it('saves edited text and extracts avoided phrases on edit', async () => {
    vi.mocked(db.styleProfile.findUnique).mockResolvedValue(mockProfile as any)
    vi.mocked(db.styleProfile.update).mockResolvedValue(mockProfile as any)

    await processFeedback({
      userId: 'user_001', emailId: 'e1',
      draft: 'Hi,\n\nAs per my last email please find the details below.\n\nBest',
      action: 'edit',
      editedText: 'Hi,\n\nHere are the details.\n\nBest',
    })

    const updateCall = vi.mocked(db.styleProfile.update).mock.calls[0][0]
    const avoided = (updateCall.data as any).avoidPhrases as string[]
    // Should have detected that "as per my last email" was removed
    expect(avoided.some(p => p.includes('as per my last'))).toBe(true)
  })

  it('caps exampleReplies at 20 entries', async () => {
    const profileWith20 = {
      ...mockProfile,
      exampleReplies: Array.from({ length: 20 }, (_, i) => ({
        original: `email ${i}`, draft: `draft ${i}`, edited: null,
      })),
    }
    vi.mocked(db.styleProfile.findUnique).mockResolvedValue(profileWith20 as any)
    vi.mocked(db.styleProfile.update).mockResolvedValue(profileWith20 as any)

    await processFeedback({
      userId: 'user_001', emailId: 'e1',
      draft: 'Hi,\n\nSure!\n\nBest', action: 'approve',
    })

    const updateCall = vi.mocked(db.styleProfile.update).mock.calls[0][0]
    const examples = (updateCall.data as any).exampleReplies
    expect(examples.length).toBeLessThanOrEqual(20)
  })
})
