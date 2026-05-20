import 'dotenv/config'
import { runAgent } from './agent/graph'

async function main() {
    const result = await runAgent('test-user', {
        messageId: 'test-001',
        threadId: 'thread-001',
        subject: 'Quick question about the project',
        from: 'ali@example.com',
        body: 'Hey, can you send me the latest project update by Friday? Need it for the client meeting.',
        date: new Date().toISOString(),
        snippet: 'can you send me the latest project update',
    })

    console.log('\n=== Classification ===')
    console.log(result.classification)
    console.log('\n=== Draft Reply ===')
    console.log(result.draft)
}

main().catch(console.error)