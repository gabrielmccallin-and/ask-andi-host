import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { query } from './query'

const app = new Hono()

app.use('/*', cors())

type ChatRequest = { messages: { role: string; text: string; sessionId?: string }[] }

app.post('/api/chat', async (c) => {
  try {
    const body = await c.req.json<ChatRequest>()
    const queryText = body.messages?.[body.messages.length - 1]?.text
    const sessionId = body.messages?.[body.messages.length - 1]?.sessionId

    if (!queryText) return c.json({ error: 'No query provided' }, 400)

    const response = await query(queryText, sessionId)
    return c.json({
      text: response.answer,
      sessionId: response.sessionId,
    })
  } catch (error) {
    console.error('Server Error:', error)
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

// Vercel serverless function export (Node.js compatible)
export default app

// Local development: run server if not in Vercel
if (!process.env.VERCEL) {
  const port = process.env.PORT ? Number(process.env.PORT) : 4000
  // Dynamically import serve only when running locally
  import('@hono/node-server').then(({ serve }) => {
    console.log(`Hono server running locally on port ${port}`)
    serve({
      fetch: app.fetch,
      port,
    })
  })
}
