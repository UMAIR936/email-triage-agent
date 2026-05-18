// src/memory/feedback.ts
// Processes human feedback (approve / edit / reject) and updates the style profile.

import { db } from '../utils/db'

type FeedbackAction = 'approve' | 'edit' | 'reject'

interface FeedbackInput {
  userId: string
  emailId: string
  draft: string
  action: FeedbackAction
  editedText?: string       // only when action = 'edit'
  originalEmail?: string    // original email body for context
}

export async function processFeedback(input: FeedbackInput): Promise<void> {
  const { userId, emailId, draft, action, editedText, originalEmail } = input

  // Always log feedback for analysis
  await db.feedbackLog.create({
    data: {
      userId,
      emailId,
      draft,
      action,
      editedText: editedText ?? null,
    },
  })

  if (action === 'reject') {
    // Don't auto-learn from rejections — too risky. Log for manual review.
    return
  }

  const profile = await db.styleProfile.findUnique({ where: { userId } })
  if (!profile) return

  if (action === 'approve') {
    // Add the approved draft to example replies (cap at 20)
    const existingExamples = (profile.exampleReplies as any[]).slice(-19)
    await db.styleProfile.update({
      where: { userId },
      data: {
        exampleReplies: [
          ...existingExamples,
          { original: originalEmail ?? '', draft, edited: null },
        ],
      },
    })
  }

  if (action === 'edit' && editedText) {
    const removedPhrases = extractRemovedPhrases(draft, editedText)
    const styleSignals = analyzeStyleDiff(draft, editedText)
    const existingExamples = (profile.exampleReplies as any[]).slice(-19)
    const existingAvoid = profile.avoidPhrases

    await db.styleProfile.update({
      where: { userId },
      data: {
        // Add newly removed phrases to the avoid list (deduplicated)
        avoidPhrases: [...new Set([...existingAvoid, ...removedPhrases])],
        // Update formality score with exponential moving average
        formalityScore: lerp(profile.formalityScore, styleSignals.formalityScore, 0.2),
        // Update greeting/signoff if the user changed them
        greeting: styleSignals.greeting ?? profile.greeting,
        signoff: styleSignals.signoff ?? profile.signoff,
        exampleReplies: [
          ...existingExamples,
          { original: originalEmail ?? '', draft, edited: editedText },
        ],
      },
    })
  }
}

// ─── Helpers ────────────────────────────────────────────────────

/** Find phrases that appear in the draft but not in the edited version. */
function extractRemovedPhrases(draft: string, edited: string): string[] {
  // Simple approach: find 3-5 word sequences in draft that were removed
  const draftWords = draft.toLowerCase().split(/\s+/)
  const editedLower = edited.toLowerCase()
  const removed: string[] = []

  for (let i = 0; i < draftWords.length - 3; i++) {
    const phrase = draftWords.slice(i, i + 4).join(' ')
    if (phrase.length > 10 && !editedLower.includes(phrase)) {
      removed.push(phrase)
    }
  }

  return removed.slice(0, 5) // cap at 5 phrases per feedback
}

/** Detect formality level and greeting/signoff changes. */
function analyzeStyleDiff(draft: string, edited: string) {
  const formalWords = ['please', 'kindly', 'regarding', 'sincerely', 'hereby', 'aforementioned']
  const casualWords = ['hey', 'yep', 'nope', 'cool', 'awesome', 'thanks!']

  const editedLower = edited.toLowerCase()
  const formalCount = formalWords.filter(w => editedLower.includes(w)).length
  const casualCount = casualWords.filter(w => editedLower.includes(w)).length
  const formalityScore = Math.min(1, Math.max(0, 0.5 + (formalCount - casualCount) * 0.1))

  // Detect greeting
  const greetingMatch = edited.match(/^(Hi|Hello|Hey|Dear|Good morning)\b/i)
  const greeting = greetingMatch ? greetingMatch[1] : null

  // Detect sign-off (last line before signature)
  const lines = edited.trim().split('\n').filter(Boolean)
  const lastLine = lines[lines.length - 1] ?? ''
  const signoffMatch = lastLine.match(/^(Best|Regards|Thanks|Cheers|Kind regards|Sincerely)/i)
  const signoff = signoffMatch ? signoffMatch[1] : null

  return { formalityScore, greeting, signoff }
}

/** Linear interpolation — for smoothly updating scores. */
function lerp(current: number, target: number, alpha: number): number {
  return current + alpha * (target - current)
}
