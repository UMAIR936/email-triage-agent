# 📬 AI Email Triage Agent

An autonomous email assistant built with **LangGraph + Claude AI + Gmail API**.

It reads your inbox, classifies each email by urgency and intent, routes it to the right action (draft reply / snooze / flag urgent), and learns your writing style from your feedback over time.

---

## Architecture

```
Gmail (push/poll)
      ↓
  Classifier node      ← LLM call: urgency, category, action
      ↓
  Router node          ← Conditional branching (no LLM)
   ↙    ↓    ↘
Snooze  Drafter  FlagUrgent
          ↓
     Human review
          ↓
     Feedback loop  →  Style memory (Postgres)
                              ↑
                        (used next time)
```

**Stack:** TypeScript · NestJS-free Express · LangGraph · Anthropic Claude · Prisma · PostgreSQL · Gmail API

---

## Quick start

### 1. Clone and install
```bash
git clone https://github.com/YOUR_USERNAME/email-triage-agent
cd email-triage-agent
npm install
```

### 2. Set up environment
```bash
cp .env.example .env
# Fill in your ANTHROPIC_API_KEY and Gmail OAuth credentials
```

### 3. Start the database
```bash
docker-compose up -d
npm run db:push       # create tables
npm run db:generate   # generate Prisma client
```

### 4. Set up Gmail OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable Gmail API
3. Create OAuth 2.0 credentials (Web application)
4. Set redirect URI: `http://localhost:3000/auth/google/callback`
5. Copy Client ID and Secret into `.env`

### 5. Run the app
```bash
npm run dev
```

### 6. Connect your Gmail
Open `http://localhost:3000/auth/google` in your browser and complete OAuth.

The poller will start checking your inbox every 30 seconds.

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/google` | Start Gmail OAuth flow |
| `GET` | `/auth/google/callback` | OAuth callback |
| `GET` | `/emails/pending?userId=X` | List emails with drafts awaiting review |
| `POST` | `/emails/:id/feedback` | Submit approve/edit/reject feedback |
| `GET` | `/style-profile?userId=X` | View your current style profile |
| `POST` | `/webhooks/gmail` | Gmail push notification receiver (production) |

### Feedback request body
```json
{
  "action": "approve",          // "approve" | "edit" | "reject"
  "editedText": "Hi,\n\n..."   // only required when action = "edit"
}
```

---

## Testing

```bash
# Run all unit + integration tests
npm test

# Run with coverage report
npm run test:coverage

# Run eval suite (costs API credits — run before releases)
npm run test:evals
```

### Testing layers

| Layer | Tool | When to run | Speed |
|-------|------|-------------|-------|
| Unit | Vitest + mocks | Every commit | ~2s |
| Integration | Vitest + mocked LLM | Every PR | ~5s |
| Evals | Real LLM calls | Before release | ~30s + credits |

---

## How the style learning works

Every time you give feedback on a draft:

- **Approve** → adds the draft to your example replies. The drafter uses these as style reference.
- **Edit** → diffs your version against the AI's draft. Removed phrases go into an `avoidPhrases` list. Tone signals (formality, greeting, signoff) update your profile using exponential moving average.
- **Reject** → logged for manual review. No auto-learning (too risky without knowing *why* it was rejected).

Your style profile is stored as a JSON object in Postgres and injected as a prompt prefix on every draft call.

---

## Project structure

```
src/
├── agent/
│   ├── graph.ts           ← LangGraph graph (wires all nodes)
│   ├── state.ts           ← Shared AgentState type
│   └── nodes/
│       ├── classifier.ts  ← LLM: classify email
│       ├── router.ts      ← Pure logic: route by classification
│       ├── drafter.ts     ← LLM: generate reply
│       ├── snooze.ts      ← Gmail: snooze thread
│       └── flag-urgent.ts ← Gmail: label + notify
├── memory/
│   ├── style-store.ts     ← Read style profile, format as prompt
│   └── feedback.ts        ← Process feedback, update profile
├── gmail/
│   ├── client.ts          ← Gmail API wrapper
│   └── poller.ts          ← Dev-mode inbox polling
├── api/routes.ts          ← Express REST API
└── utils/
    ├── db.ts              ← Prisma singleton
    └── logger.ts          ← Winston logger

tests/
├── unit/                  ← Fast, mocked LLM tests
├── integration/           ← Full graph flow, mocked LLM
└── evals/
    ├── fixtures/          ← Golden email dataset
    └── draft-quality.eval.ts ← Real LLM quality checks
```

---

## What you'll learn building this

- **LangGraph** — state graphs, conditional edges, node composition
- **Agentic AI patterns** — multi-step reasoning, tool design, human-in-the-loop
- **Testing LLMs** — structural assertions, semantic scoring, LLM-as-judge
- **Gmail API** — OAuth, push notifications, thread management
- **Feedback loops** — learning from user behaviour over time
- **System design** — event-driven architecture, idempotency, graceful degradation

---

## Roadmap / things to build next

- [ ] Frontend dashboard (Next.js) to review drafts in a nice UI
- [ ] Push notifications when urgent emails arrive (Slack webhook)
- [ ] Support multiple Gmail accounts per user
- [ ] Playwright E2E tests for the dashboard
- [ ] Replace polling with real Pub/Sub in production
- [ ] Add Stripe billing to turn this into a SaaS

