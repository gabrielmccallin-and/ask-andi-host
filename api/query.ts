import { ConversationalSearchServiceClient } from '@google-cloud/discoveryengine'
import type { google } from '@google-cloud/discoveryengine/build/protos/protos.d.ts'
import fs from 'fs'
import { prompt } from './prompt'

const PROJECT_NUMBER = '902310615421'
const ENGINE_ID = 'ask-andi-chatbot-simple_1769694487139'
const COLLECTION = 'default_collection'
const SESSION_RESOURCE_LOCATOR = `projects/${PROJECT_NUMBER}/locations/global/collections/${COLLECTION}/engines/${ENGINE_ID}/sessions/`

let credentials: any

if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  // Running on Vercel or with env var set
  credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  console.log('Loaded credentials from environment variable.')
} else {
  // Local development: read from file
  credentials = JSON.parse(fs.readFileSync('./service-account-key.json', 'utf8'))
}

export const query = async (queryText: string, sessionId?: string) => {
  const client = new ConversationalSearchServiceClient({
    credentials,
  })

  // Build the request
  const request: google.cloud.discoveryengine.v1.IAnswerQueryRequest = {
    servingConfig: `projects/${PROJECT_NUMBER}/locations/global/collections/${COLLECTION}/engines/${ENGINE_ID}/servingConfigs/default_search`,
    query: {
      text: queryText,
    },
    answerGenerationSpec: {
      ignoreAdversarialQuery: false,
      ignoreNonAnswerSeekingQuery: false,
      ignoreLowRelevantContent: false,
      includeCitations: true,
      promptSpec: {
        preamble: prompt,
      },
      modelSpec: { modelVersion: 'gemini-2.5-flash/answer_gen/v1' },
    },
    relatedQuestionsSpec: { enable: true },
    session: sessionId ? `${SESSION_RESOURCE_LOCATOR}${sessionId}` : `${SESSION_RESOURCE_LOCATOR}-`,
  }

  const [response] = await client.answerQuery(request)
  const answer = response.answer?.answerText || ''

  // Extract session from the response
  let returnedSessionId: string | undefined
  const session = response.session
  if (session?.name) {
    // Extract only the session ID (after the last slash)
    const parts = session.name.split('/')
    returnedSessionId = parts[parts.length - 1]
  }
  console.log('response:', answer)
  console.log('sessionId:', returnedSessionId)
  return { answer, sessionId: returnedSessionId }
}
