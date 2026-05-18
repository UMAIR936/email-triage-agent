// src/agent/nodes/classifier.ts
// Reads the email and produces a Classification object.
// This is a simple LLM call — no tools needed.

import Anthropic from '@anthropic-ai/sdk'
import { AgentState, Classification } from '../state'

const client = new Anthropic()

export async function classifierNode(state: AgentState): Promise<Partial<AgentState>> {
  const { email } = state

  const prompt = `You are an email classifier. Analyse this email and respond ONLY with a JSON object — no extra text, no markdown fences.

Email:
From: ${email.from}
Subject: ${email.subject}
Body: ${email.body.slice(0, 2000)}

Respond with this exact JSON shape:
{
  "urgency": "high" | "medium" | "low",
  "category": "action-required" | "informational" | "spam" | "newsletter" | "personal",
  "intent": "one sentence describing what the sender wants",
  "action": "reply" | "defer" | "flag" | "archive" | "ignore",
  "confidence": 0.0 to 1.0
}

Rules:
- urgency=high: deadlines, urgent requests, important decisions needed within 24h
- urgency=medium: needs a reply within a week
- urgency=low: FYI only, newsletters, no reply needed
- action=flag: high urgency items that need immediate human attention
- action=defer: can wait more than 3 days
- action=archive: newsletters, automated emails, no reply needed`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const classification: Classification = JSON.parse(text.trim())
    return { classification }
  } catch {
    // Fallback classification if parsing fails
    return {
      classification: {
        urgency: 'medium',
        category: 'action-required',
        intent: 'Unknown — parsing failed',
        action: 'reply',
        confidence: 0.1,
      },
    }
  }
}
