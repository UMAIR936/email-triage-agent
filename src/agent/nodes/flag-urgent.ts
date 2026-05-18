// src/agent/nodes/flag-urgent.ts
import { gmailClient } from '../../gmail/client'
import { AgentState } from '../state'
import logger from '../../utils/logger'

// Flag urgent emails with a label and log for immediate human attention
export async function flagUrgentNode(state: AgentState): Promise<Partial<AgentState>> {
  const { email, userId, classification } = state

  try {
    await gmailClient.addLabel(userId, email.threadId, 'URGENT_AI')
    logger.warn('Flagged urgent email', {
      userId,
      threadId: email.threadId,
      subject: email.subject,
      intent: classification?.intent,
    })

    // TODO: send push notification to user (Slack/push/SMS)
  } catch (err) {
    logger.error('Failed to flag urgent thread', { threadId: email.threadId, err })
  }

  return {}
}
