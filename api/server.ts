import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';

const app = new Hono();

app.use('/*', cors());

let credentials: any;

if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  // Running on Vercel or with env var set
  credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  console.log('Loaded credentials from environment variable.');
} else {
  // Local development: read from file
  credentials = JSON.parse(fs.readFileSync('./service-account-key.json', 'utf8'));
}

const auth = new GoogleAuth({
  scopes: 'https://www.googleapis.com/auth/cloud-platform',
  credentials
});

const PROJECT_NUMBER = '902310615421';
const ENGINE_ID = 'ask-andi-chatbot-simple_1769694487139';
const COLLECTION = 'default_collection';
const API_VERSION = 'v1alpha';

const ENDPOINT_URL = `https://discoveryengine.googleapis.com/${API_VERSION}/projects/${PROJECT_NUMBER}/locations/global/collections/${COLLECTION}/engines/${ENGINE_ID}/servingConfigs/default_search:search`;

// Types
type ChatRequest = { messages: { role: string; text: string }[] };

app.post('/api/chat', async (c) => {
  try {

    const body = await c.req.json<ChatRequest>();
    const lastMessage = body.messages?.[body.messages.length - 1]?.text;

    if (!lastMessage) return c.json({ error: 'No query provided' }, 400);

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const sessionPath = `projects/${PROJECT_NUMBER}/locations/global/collections/${COLLECTION}/engines/${ENGINE_ID}/sessions/-`;
    const searchPayload = {
      query: lastMessage,
      pageSize: 10,
      session: sessionPath,
      spellCorrectionSpec: { mode: "AUTO" },
      languageCode: "en-GB",
      userInfo: { timeZone: "Europe/London" },
      contentSearchSpec: {
        snippetSpec: { returnSnippet: true }
      }
    };

    const searchResponse = await fetch(ENDPOINT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(searchPayload)
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Google API Error:', errorText);
      return c.json({ error: 'Upstream API Error' }, searchResponse.status as any);
    }

    const searchData = await searchResponse.json();

      console.log('searchData:', searchData);
    const formattedReferences = formatReferences(searchData);

    // E. Extract session and queryId for summary
    const session = searchData.sessionInfo?.name || null;
    const queryId = searchData.sessionInfo?.queryId || null;

      console.log('session:', session);
      console.log('queryId:', queryId);

    let responseText = '';
    if (session && queryId) {
      // F. Make the Answer (Summary) Request
      const answerEndpoint = `https://discoveryengine.googleapis.com/${API_VERSION}/projects/${PROJECT_NUMBER}/locations/global/collections/${COLLECTION}/engines/${ENGINE_ID}/servingConfigs/default_search:answer`;
      const answerPayload = {
        query: { text: lastMessage, queryId },
        session,
        relatedQuestionsSpec: { enable: true },
        answerGenerationSpec: {
          ignoreAdversarialQuery: false,
          ignoreNonAnswerSeekingQuery: false,
          ignoreLowRelevantContent: false,
          multimodalSpec: {},
          includeCitations: true,
          promptSpec: { preamble: 'Limit to 120 words, always mention work that AND Digital has done for clients, mention the client name and articulate the benefits. When talking about AND Digital, use "we" or "us". Look at the content of search results and the title and mention client names in them and link those to work done. Break the summary into 3 short paragraphs. Bold any client names, try to mention a client in each paragraph, do not mention a client multiple times.' },
          modelSpec: { modelVersion: 'gemini-2.5-flash/answer_gen/v1' }
        }
      };
      const answerResponse = await fetch(answerEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(answerPayload)
      });
      if (answerResponse.ok) {
        const answerData = await answerResponse.json();
        responseText = answerData.answer.answerText || '';

        console.log('answer text:', responseText);

      } else {
        const errorText = await answerResponse.text();
        console.error('Answer API Error:', errorText);
      }
    }

    return c.json({
      text: responseText + '\n\n' + formattedReferences
    });

  } catch (error) {
    console.error('Server Error:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

// Helper: Turn search results into a chat-friendly string
function formatReferences(data: any): string {
  if (!data.results || data.results.length === 0) {
    return "I couldn't find any relevant retail case studies.";
  }

  // Map top 3 results to a readable string
  const summary = data.results.slice(0, 3).map((item: any) => {
    const title = item.document?.derivedStructData?.title || 'Untitled';
    let link = item.document?.derivedStructData?.link || '#';
    if (!link.endsWith('.html')) {
      link = '#';
    }
    // Markdown formatting for DeepChat
    return `**[${title}](${link})**\n`;
  }).join('\n');

  return summary;
}




// Vercel serverless function export (Node.js compatible)
import { handle } from 'hono/vercel';
export default handle(app);

// Local development: run server if not in Vercel
if (!process.env.VERCEL) {
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  // Dynamically import serve only when running locally
  import('@hono/node-server').then(({ serve }) => {
    console.log(`Hono server running locally on port ${port}`);
    serve({
      fetch: app.fetch,
      port
    });
  });
}
