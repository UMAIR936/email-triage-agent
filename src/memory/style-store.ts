// src/memory/style-store.ts
// Reads the user's style profile from Postgres and formats it as a prompt string.

import { db } from '../utils/db'

export async function getStyleContext(userId: string): Promise<string> {
  const profile = await db.styleProfile.findUnique({ where: { userId } })

  if (!profile) {
    return 'Write in a professional, concise tone. Use "Hi" as greeting and "Best" as sign-off.'
  }

  const exampleReplies = (profile.exampleReplies as any[]).slice(-3) // last 3 examples

  const exampleText = exampleReplies.length > 0
    ? `\nExamples of replies you have approved:\n` +
      exampleReplies
        .map((e: any) => `- "${e.edited ?? e.draft}"`)
        .join('\n')
    : ''

  return `Writing style:
- Greeting: "${profile.greeting}"
- Sign-off: "${profile.signoff}"
- Tone: ${profile.formalityScore > 0.7 ? 'formal' : profile.formalityScore > 0.4 ? 'semi-formal' : 'casual'}
- Sentence length: ${profile.avgSentenceLength < 12 ? 'short and punchy' : 'normal'}
- Avoid these phrases: ${profile.avoidPhrases.length > 0 ? profile.avoidPhrases.join(', ') : 'none'}${exampleText}`
}

export async function ensureStyleProfile(userId: string): Promise<void> {
  await db.styleProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  })
}
