// src/index.ts
import 'dotenv/config'
import express from 'express'
import { router } from './api/routes'
import { startPoller } from './gmail/poller'
import logger from './utils/logger'

const app = express()
app.use(express.json())
app.use(router)

const PORT = process.env.PORT ?? 3000

app.listen(PORT, () => {
  logger.info(`Email triage agent running on http://localhost:${PORT}`)

  // In dev, use the poller. In production, Gmail pushes to /webhooks/gmail
  if (process.env.NODE_ENV !== 'production') {
    startPoller()
  }
})
