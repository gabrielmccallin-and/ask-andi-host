import { ConversationalSearchServiceClient } from '@google-cloud/discoveryengine'
import fs from 'fs'

const PROJECT_NUMBER = '902310615421'
const ENGINE_ID = 'ask-andi-chatbot-simple_1769694487139'
const COLLECTION = 'default_collection'

let credentials: any

if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  // Running on Vercel or with env var set
  credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  console.log('Loaded credentials from environment variable.')
} else {
  // Local development: read from file
  credentials = JSON.parse(fs.readFileSync('./service-account-key.json', 'utf8'))
}

export const query = async (queryText: string) => {
  const client = new ConversationalSearchServiceClient({
    credentials,
  })

  // Build the request
  const request = {
    servingConfig: `projects/${PROJECT_NUMBER}/locations/global/collections/${COLLECTION}/engines/${ENGINE_ID}/servingConfigs/default_search`,
    query: {
      text: queryText,
    },
    pageSize: 10,
    userInfo: { userId: 'user-id' },
    answerGenerationSpec: {
      ignoreAdversarialQuery: false,
      ignoreNonAnswerSeekingQuery: false,
      ignoreLowRelevantContent: false,
      multimodalSpec: {},
      includeCitations: true,
      promptSpec: {
        preamble:
          'Limit to 120 words, always mention work that AND Digital has done for clients, mention the client name and articulate the benefits. When talking about AND Digital, use "we" or "us". Look at the content of search results and the title and mention client names in them and link those to work done. Break the summary into 3 short paragraphs. Bold any client names, try to mention a client in each paragraph, do not mention a client multiple times.',
      },
      modelSpec: { modelVersion: 'gemini-2.5-flash/answer_gen/v1' },
    },
    relatedQuestionsSpec: { enable: true },
  }

  try {
    const [response] = await client.answerQuery(request)
    console.log('response:', response.answer?.answerText)
    return response.answer?.answerText || ''
  } catch (error) {
    console.error('Error during search:', error)
    return ''
  }
}
