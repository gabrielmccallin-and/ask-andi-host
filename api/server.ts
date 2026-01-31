import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { GoogleAuth } from 'google-auth-library';

const app = new Hono();

// 1. Enable CORS
app.use('/*', cors());

// 2. Setup Google Auth (Replaces $(gcloud auth print-access-token))
const auth = new GoogleAuth({
  scopes: 'https://www.googleapis.com/auth/cloud-platform',
  keyFile: './service-account-key.json'
});

// 3. Configuration from your URL
// URL: projects/902310615421/locations/global/collections/default_collection/engines/ask-andi-chatbot-simple_1769694487139/servingConfigs/default_search:search
const PROJECT_NUMBER = '902310615421';
const ENGINE_ID = 'ask-andi-chatbot-simple_1769694487139';
const COLLECTION = 'default_collection';
const API_VERSION = 'v1alpha'; // As per your curl

const ENDPOINT_URL = `https://discoveryengine.googleapis.com/${API_VERSION}/projects/${PROJECT_NUMBER}/locations/global/collections/${COLLECTION}/engines/${ENGINE_ID}/servingConfigs/default_search:search`;

// Types
type DeepChatRequest = { messages: { role: string; text: string }[] };

app.post('/api/chat', async (c) => {
  try {
    // A. Parse DeepChat input
    const body = await c.req.json<DeepChatRequest>();
    const lastMessage = body.messages?.[body.messages.length - 1]?.text;

    if (!lastMessage) return c.json({ error: 'No query provided' }, 400);

    // B. Get Access Token
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    // C. Construct the Payload (Matching your curl -d)
    const payload = {
      query: lastMessage,
      pageSize: 10,
      spellCorrectionSpec: { mode: "AUTO" },
      languageCode: "en-GB",
      userInfo: { timeZone: "Europe/London" },
      contentSearchSpec: {
        snippetSpec: { returnSnippet: true }
      }
    };

    // D. Make the Fetch Request (Matching your curl)
    const response = await fetch(ENDPOINT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google API Error:', errorText);
      return c.json({ error: 'Upstream API Error' }, response.status as any);
    }

    const data = await response.json();

    // E. Format for DeepChat
    // Since this is SEARCH, not Chat, we get a list of results. 
    // We need to format them into a single text block for the chat bot to display.
    const formattedResponse = formatSearchResults(data);

    return c.json({ text: formattedResponse });

  } catch (error) {
    console.error('Server Error:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

// Helper: Turn search results into a chat-friendly string
function formatSearchResults(data: any): string {
  if (!data.results || data.results.length === 0) {
    return "I couldn't find any relevant retail case studies.";
  }

  // Map top 3 results to a readable string
  const summary = data.results.slice(0, 3).map((item: any) => {
    const title = item.document?.derivedStructData?.title || 'Untitled';
    const snippet = item.document?.derivedStructData?.snippets?.[0]?.snippet || '';
    const link = item.document?.derivedStructData?.link || '#';
    
    // Markdown formatting for DeepChat
    return `**[${title}](${link})**\n${snippet}\n`;
  }).join('\n---\n\n');

  return `Here are some results I found:\n\n${summary}`;
}

// Start Server
const port = 5001;
console.log(`Search Proxy running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
