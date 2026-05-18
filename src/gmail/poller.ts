// src/gmail/poller.ts
// For LOCAL DEVELOPMENT: polls Gmail every 30 seconds instead of using Pub/Sub.
// In production, replace this with the webhook handler in api/routes.ts.

import { db } from '../utils/db'
import { gmailClient } from './client'
import { runAgent } from '../agent/graph'
import logger from '../utils/logger'

const POLL_INTERVAL_MS = 30_000

export function startPoller(): void {
  logger.info('Starting Gmail poller (dev mode) — polling every 30s')
  poll()
  setInterval(poll, POLL_INTERVAL_MS)
}

async function poll(): Promise<void> {
  const users = await db.user.findMany({
    where: { historyId: { not: null } },
  })

  for (const user of users) {
    try {
      await processNewEmails(user.id, user.historyId!)
    } catch (err) {
      logger.error('Poller error for user', { userId: user.id, err })
    }
  }
}

async function processNewEmails(userId: string, historyId: string): Promise<void> {
  const messageIds = await gmailClient.getNewMessages(userId, historyId)

  for (const messageId of messageIds) {
    // Skip already-processed emails
    const exists = await db.processedEmail.findUnique({ where: { gmailMessageId: messageId } })
    if (exists) continue

    const email = await gmailClient.getMessage(userId, messageId)
    logger.info('Processing email', { messageId, subject: email.subject })

    const result = await runAgent(userId, email)

    // Save result to DB
    await db.processedEmail.create({
      data: {
        userId,
        gmailMessageId: messageId,
        threadId: email.threadId,
        subject: email.subject,
        from: email.from,
        classification: result.classification as any,
        draft: result.draft ?? null,
        status: 'pending',
      },
    })
  }
}
