import fs from 'fs'

export const credentialHelper = (env: NodeJS.ProcessEnv) => {
  if (typeof env.K_SERVICE == 'undefined') {
    if (typeof env.GOOGLE_SERVICE_ACCOUNT_KEY == 'undefined') {
      console.log('Loaded credentials from local file.')
      return JSON.parse(fs.readFileSync('./service-account-key.json', 'utf8'))
    } else {
      console.log('Loaded credentials from environment variable.')
      return JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY as string)
    }
  } else {
    console.log('Using default Google Cloud credentials.')
    return ''
  }
}
