// Generates an email reply using the user's style profile.
// This is the most important node — quality here = quality of the whole system.

import OpenAI from 'openai'
import { AgentState } from '../state'

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})

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

  const response = await client.chat.completions.create({
    model: 'openai/gpt-4.1-mini',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })
  const draft = response.choices[0].message.content ?? ''

  return { draft }
}
