// tests/evals/draft-quality.eval.ts
// Eval suite — runs REAL LLM calls to measure quality.
// Run with: npm run test:evals
// ⚠️  This costs API credits. Run before releases, not on every commit.

import { describe, it, expect } from 'vitest'
import { goldenFixtures } from './fixtures/golden-emails'
import Anthropic from '@anthropic-ai/sdk'

// Real client — no mocks in evals
const client = new Anthropic()

// ─── Classifier accuracy eval ─────────────────────────────────────

describe('Classifier accuracy (real LLM)', () => {
  for (const fixture of goldenFixtures) {
    it(`correctly classifies: ${fixture.id}`, async () => {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Classify this email as JSON only:
From: ${fixture.email.from}
Subject: ${fixture.email.subject}
Body: ${fixture.email.body}

Respond: { "urgency": "high"|"medium"|"low", "action": "reply"|"defer"|"flag"|"archive"|"ignore", "category": string, "intent": string, "confidence": number }`,
        }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const result = JSON.parse(text.trim())

      expect(result.urgency).toBe(fixture.expectedClassification.urgency)
      expect(result.action).toBe(fixture.expectedClassification.action)
    }, 15_000) // 15s timeout per eval
  }
})

// ─── Draft quality eval (LLM-as-judge) ───────────────────────────

async function judgeReplyQuality(
  originalEmail: { subject: string; from: string; body: string },
  draft: string
): Promise<{ score: number; reason: string }> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `You are evaluating an AI-generated email reply. Score it 1-5.

Original email:
From: ${originalEmail.from}
Subject: ${originalEmail.subject}
Body: ${originalEmail.body}

Generated reply:
${draft}

Score criteria:
5 = Perfect: relevant, right tone, concise, human-sounding
4 = Good: minor issues
3 = Acceptable: gets the job done
2 = Poor: off-topic or wrong tone
1 = Bad: irrelevant or harmful

Respond ONLY as JSON: { "score": number, "reason": string }`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text.trim())
}

describe('Draft quality (LLM-as-judge)', () => {
  const replyFixtures = goldenFixtures.filter(f => f.expectedClassification.action === 'reply')

  it('average quality score is above 3.5', async () => {
    const scores: number[] = []

    for (const fixture of replyFixtures) {
      // Generate a draft
      const draftResponse = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Draft a reply to this email. Reply body only, no subject line.
From: ${fixture.email.from}
Subject: ${fixture.email.subject}
Body: ${fixture.email.body}`,
        }],
      })

      const draft = draftResponse.content[0].type === 'text'
        ? draftResponse.content[0].text.trim()
        : ''

      // Judge the draft
      const judgment = await judgeReplyQuality(fixture.email, draft)
      scores.push(judgment.score)

      // Structural checks from fixture
      if (fixture.replyMustContain) {
        for (const phrase of fixture.replyMustContain) {
          expect(draft.toLowerCase()).toContain(phrase.toLowerCase())
        }
      }
      if (fixture.replyMustNotContain) {
        for (const phrase of fixture.replyMustNotContain) {
          expect(draft.toLowerCase()).not.toContain(phrase.toLowerCase())
        }
      }
      if (fixture.replyMaxWords) {
        expect(draft.split(/\s+/).length).toBeLessThanOrEqual(fixture.replyMaxWords)
      }
    }

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    console.log(`Average draft quality score: ${avg.toFixed(2)} / 5`)
    expect(avg).toBeGreaterThan(3.5)
  }, 60_000) // 60s for full eval suite
})
