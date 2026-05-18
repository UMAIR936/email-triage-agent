// src/api/routes.ts
// REST API for the frontend dashboard + Gmail webhook receiver.

import { Router, Request, Response } from 'express'
import { db } from '../utils/db'
import { gmailClient } from '../gmail/client'
import { processFeedback } from '../memory/feedback'
import { runAgent } from '../agent/graph'
import { ensureStyleProfile } from '../memory/style-store'
import logger from '../utils/logger'

export const router = Router()

// ─── Auth ────────────────────────────────────────────────────────

// Step 1: Redirect user to Google OAuth
router.get('/auth/google', (_req: Request, res: Response) => {
  const url = gmailClient.getAuthUrl()
  res.redirect(url)
})

// Step 2: Google redirects back here with a code
router.get('/auth/google/callback', async (req: Request, res: Response) => {
  const { code } = req.query
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Missing code' })
    return
  }

  const tokens = await gmailClient.exchangeCode(code)

  // Get the user's email address
  const auth = new (await import('googleapis')).google.auth.OAuth2()
  auth.setCredentials(tokens)
  const oauth2 = (await import('googleapis')).google.oauth2({ version: 'v2', auth })
  const { data } = await oauth2.userinfo.get()

  const user = await db.user.upsert({
    where: { email: data.email! },
    create: {
      email: data.email!,
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
    },
    update: {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token ?? undefined,
    },
  })

  await ensureStyleProfile(user.id)

  // In production: set up Gmail push notifications
  if (process.env.NODE_ENV === 'production') {
    await gmailClient.watchInbox(user.id)
  }

  res.json({ message: 'Connected!', userId: user.id })
})

// ─── Gmail push webhook (production) ─────────────────────────────

router.post('/webhooks/gmail', async (req: Request, res: Response) => {
  // Acknowledge immediately — Google will retry if we don't respond in time
  res.sendStatus(200)

  try {
    const message = Buffer.from(req.body.message.data, 'base64').toString()
    const { emailAddress, historyId } = JSON.parse(message)

    const user = await db.user.findUnique({ where: { email: emailAddress } })
    if (!user) return

    const messageIds = await gmailClient.getNewMessages(user.id, user.historyId ?? historyId)
    for (const messageId of messageIds) {
      const exists = await db.processedEmail.findUnique({ where: { gmailMessageId: messageId } })
      if (exists) continue

      const email = await gmailClient.getMessage(user.id, messageId)
      const result = await runAgent(user.id, email)

      await db.processedEmail.create({
        data: {
          userId: user.id,
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

    await db.user.update({
      where: { id: user.id },
      data: { historyId: historyId.toString() },
    })
  } catch (err) {
    logger.error('Webhook processing error', { err })
  }
})

// ─── Dashboard API ────────────────────────────────────────────────

// List pending emails with drafts for review
router.get('/emails/pending', async (req: Request, res: Response) => {
  const { userId } = req.query
  if (!userId || typeof userId !== 'string') {
    res.status(400).json({ error: 'userId required' })
    return
  }

  const emails = await db.processedEmail.findMany({
    where: { userId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  res.json(emails)
})

// Submit feedback on a draft
router.post('/emails/:id/feedback', async (req: Request, res: Response) => {
  const { id } = req.params
  const { action, editedText } = req.body

  const email = await db.processedEmail.findUniqueOrThrow({ where: { id } })

  await processFeedback({
    userId: email.userId,
    emailId: id,
    draft: email.draft ?? '',
    action,
    editedText,
  })

  await db.processedEmail.update({
    where: { id },
    data: { status: action === 'reject' ? 'rejected' : 'approved' },
  })

  res.json({ message: 'Feedback recorded' })
})

// Get style profile
router.get('/style-profile', async (req: Request, res: Response) => {
  const { userId } = req.query
  if (!userId || typeof userId !== 'string') {
    res.status(400).json({ error: 'userId required' })
    return
  }

  const profile = await db.styleProfile.findUnique({ where: { userId } })
  res.json(profile ?? { message: 'No profile yet' })
})
