// src/agent/nodes/snooze.ts
import { gmailClient } from '../../gmail/client'
import { AgentState } from '../state'
import logger from '../../utils/logger'

// Snooze low-priority emails for 3 days
export async function snoozeNode(state: AgentState): Promise<Partial<AgentState>> {
  const { email, userId } = state

  try {
    await gmailClient.addLabel(userId, email.threadId, 'SNOOZED_3_DAYS')
    await gmailClient.removeLabel(userId, email.threadId, 'INBOX')
    logger.info(`Snoozed thread ${email.threadId} for user ${userId}`)
  } catch (err) {
    logger.error('Failed to snooze thread', { threadId: email.threadId, err })
  }

  return {}
}
