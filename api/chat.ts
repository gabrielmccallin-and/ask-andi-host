import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { query } from './query'

const app = new Hono()

app.use('/*', cors())

type ChatRequest = { messages: { role: string; text: string }[] }

app.post('/api/chat', async (c) => {
  try {
    const body = await c.req.json<ChatRequest>()
    const lastMessage = body.messages?.[body.messages.length - 1]?.text

    if (!lastMessage) return c.json({ error: 'No query provided' }, 400)

    const response = await query()
    return c.json({
      text: response,
    })
  } catch (error) {
    console.error('Server Error:', error)
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

// Helper: Turn search results into a chat-friendly string
function formatReferences(data: any): string {
  if (!data.results || data.results.length === 0) {
    return "I couldn't find any relevant retail case studies."
  }

  // Map top 3 results to a readable string
  const summary = data.results
    .slice(0, 3)
    .map((item: any) => {
      const title = item.document?.derivedStructData?.title || 'Untitled'
      let link = item.document?.derivedStructData?.link || '#'
      if (!link.endsWith('.html')) {
        link = '#'
      }
      // Markdown formatting for DeepChat
      return `**[${title}](${link})**\n`
    })
    .join('\n')

  return summary
}

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
