// src/agent/nodes/router.ts
// Reads the classification and returns a routing decision.
// LangGraph uses the return value of this function to pick the next node.

import { AgentState } from '../state'

export type RouteDecision = 'drafter' | 'snooze' | 'flag_urgent' | 'done'

export function routerNode(state: AgentState): RouteDecision {
  const { classification } = state

  if (!classification) return 'done'

  // Urgent items: skip drafting, flag immediately for human attention
  if (classification.urgency === 'high' || classification.action === 'flag') {
    return 'flag_urgent'
  }

  // Items to defer: snooze them
  if (classification.action === 'defer') {
    return 'snooze'
  }

  // Archive and ignore: no further action needed
  if (classification.action === 'archive' || classification.action === 'ignore') {
    return 'done'
  }

  // Everything else: draft a reply
  return 'drafter'
}
