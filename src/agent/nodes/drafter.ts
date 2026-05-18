// src/agent/nodes/drafter.ts
// Generates an email reply using the user's style profile.
// This is the most important node — quality here = quality of the whole system.

import Anthropic from '@anthropic-ai/sdk'
import { AgentState } from '../state'

const client = new Anthropic()

export async function drafterNode(state: AgentState): Promise<Partial<AgentState>> {
  const { email, classification, styleContext } = state

  const styleInstructions = styleContext ?? 'Write in a professional, concise tone.'

  const prompt = `You are a personal email assistant. Draft a reply to this email.

STYLE INSTRUCTIONS (follow these precisely):
${styleInstructions}

ORIGINAL EMAIL:
From: ${email.from}
Subject: ${email.subject}
Body: ${email.body.slice(0, 2000)}

CONTEXT:
- Sender's intent: ${classification?.intent ?? 'unknown'}
- Urgency: ${classification?.urgency ?? 'medium'}

RULES:
- Write ONLY the reply body — no "Subject:" line, no metadata
- Do NOT include a subject line
- Match the tone and length implied by the original email
- If you need a specific piece of information you don't have (e.g. a date, a number), use a placeholder like [INSERT DATE]
- Keep it human — do not sound like an AI

Reply:`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const draft = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

  return { draft }
}
