// src/gmail/client.ts
// Thin wrapper around the Gmail API.

import { google, gmail_v1 } from 'googleapis'
import { db } from '../utils/db'

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  )
}

async function getAuthedClient(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
  const auth = getOAuthClient()
  auth.setCredentials({
    access_token: user.accessToken,
    refresh_token: user.refreshToken,
  })
  return google.gmail({ version: 'v1', auth })
}

export const gmailClient = {
  /** Get OAuth URL to redirect user to for login */
  getAuthUrl(): string {
    const auth = getOAuthClient()
    return auth.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.compose',
      ],
      prompt: 'consent',
    })
  },

  /** Exchange auth code for tokens after OAuth callback */
  async exchangeCode(code: string) {
    const auth = getOAuthClient()
    const { tokens } = await auth.getToken(code)
    return tokens
  },

  /** Fetch a list of new message IDs since the last historyId */
  async getNewMessages(userId: string, startHistoryId: string): Promise<string[]> {
    const gmail = await getAuthedClient(userId)
    const res = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded'],
      labelId: 'INBOX',
    })

    const messages: string[] = []
    for (const record of res.data.history ?? []) {
      for (const msg of record.messagesAdded ?? []) {
        if (msg.message?.id) messages.push(msg.message.id)
      }
    }
    return messages
  },

  /** Fetch full message content */
  async getMessage(userId: string, messageId: string) {
    const gmail = await getAuthedClient(userId)
    const res = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    })
    return parseMessage(res.data)
  },

  async addLabel(userId: string, threadId: string, labelName: string): Promise<void> {
    const gmail = await getAuthedClient(userId)
    // In real usage, resolve labelName to labelId first
    await gmail.users.threads.modify({
      userId: 'me',
      id: threadId,
      requestBody: { addLabelIds: [labelName] },
    })
  },

  async removeLabel(userId: string, threadId: string, labelName: string): Promise<void> {
    const gmail = await getAuthedClient(userId)
    await gmail.users.threads.modify({
      userId: 'me',
      id: threadId,
      requestBody: { removeLabelIds: [labelName] },
    })
  },

  /** Register Pub/Sub push notifications for a user's inbox */
  async watchInbox(userId: string): Promise<void> {
    const gmail = await getAuthedClient(userId)
    await gmail.users.watch({
      userId: 'me',
      requestBody: {
        labelIds: ['INBOX'],
        topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/${process.env.PUBSUB_TOPIC_NAME}`,
      },
    })
  },
}

// ─── Parse raw Gmail message into a clean object ────────────────

function parseMessage(msg: gmail_v1.Schema$Message) {
  const headers = msg.payload?.headers ?? []
  const get = (name: string) => headers.find(h => h.name?.toLowerCase() === name)?.value ?? ''

  const body = extractBody(msg.payload)

  return {
    messageId: msg.id ?? '',
    threadId: msg.threadId ?? '',
    subject: get('subject'),
    from: get('from'),
    date: get('date'),
    snippet: msg.snippet ?? '',
    body,
  }
}

function extractBody(payload?: gmail_v1.Schema$MessagePart): string {
  if (!payload) return ''

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8')
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part)
      if (text) return text
    }
  }

  return ''
}
