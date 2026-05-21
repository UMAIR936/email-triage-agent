// tests/evals/fixtures/golden-emails.ts
// Golden dataset: real-world email scenarios with expected classification and ideal reply style.
// Add more fixtures as you find edge cases in real usage.

export interface GoldenFixture {
  id: string
  email: {
    subject: string
    from: string
    body: string
  }
  expectedClassification: {
    urgency: 'high' | 'medium' | 'low'
    action: 'reply' | 'defer' | 'flag' | 'archive' | 'ignore'
  }
  // What a good reply should contain (keywords/phrases, not exact text)
  replyMustContain?: string[]
  replyMustNotContain?: string[]
  replyMaxWords?: number
}

export const goldenFixtures: GoldenFixture[] = [
  {
    id: 'meeting-request-casual',
    email: {
      subject: 'Quick call?',
      from: 'friend@example.com',
      body: 'Hey, are you free for a 15 min call tomorrow around 3pm?',
    },
    expectedClassification: { urgency: 'medium', action: 'reply' },
    replyMustContain: ['3pm', 'tomorrow'],
    replyMustNotContain: ['As per my last email', 'Kindly revert'],
    replyMaxWords: 60,
  },
  {
    id: 'invoice-urgent',
    email: {
      subject: 'Invoice overdue - action required',
      from: 'billing@client.com',
      body: 'Your invoice #1234 for $500 is now 30 days overdue. Please pay within 48 hours to avoid late fees.',
    },
    expectedClassification: { urgency: 'high', action: 'flag' },
  },
  {
    id: 'newsletter-archive',
    email: {
      subject: 'Your weekly tech digest',
      from: 'noreply@technews.com',
      body: 'This week in tech: AI updates, new frameworks, and more...',
    },
    expectedClassification: { urgency: 'low', action: 'archive' },
  },
  {
    id: 'job-offer',
    email: {
      subject: 'Software Engineer offer from Acme Corp',
      from: 'hr@acme.com',
      body: 'We are pleased to offer you the Software Engineer position. Salary: $120k. Please respond within 5 business days.',
    },
    expectedClassification: { urgency: 'high', action: 'flag' },
  },
  {
    id: 'status-update-request',
    email: {
      subject: 'Project status?',
      from: 'manager@company.com',
      body: 'Hi, could you share a quick update on where things stand with the API integration?',
    },
    expectedClassification: { urgency: 'medium', action: 'reply' },
    replyMustContain: ['update', 'API'],
    replyMaxWords: 100,
  },
  {
    id: 'spam',
    email: {
      subject: 'You have won $1,000,000!!!',
      from: 'winner@totally-legit.xyz',
      body: 'Congratulations! Click here to claim your prize.',
    },
    expectedClassification: { urgency: 'low', action: 'ignore' },
  },
]
