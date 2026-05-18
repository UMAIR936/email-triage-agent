// src/agent/state.ts
// Shared state that flows through every node in the LangGraph graph.
// Each node can read and update this state.

export interface EmailInput {
  messageId: string
  threadId: string
  subject: string
  from: string
  body: string
  date: string
  snippet: string
}

export interface Classification {
  urgency: 'high' | 'medium' | 'low'
  category: 'action-required' | 'informational' | 'spam' | 'newsletter' | 'personal'
  intent: string       // human-readable: "requesting a meeting", "following up on invoice"
  action: 'reply' | 'defer' | 'flag' | 'archive' | 'ignore'
  confidence: number   // 0-1
}

export interface AgentState {
  // Input
  userId: string
  email: EmailInput

  // Set by classifier node
  classification?: Classification

  // Set by drafter node
  draft?: string

  // Loaded at start from DB, injected into drafter
  styleContext?: string

  // Set by any node on error
  error?: string
}
