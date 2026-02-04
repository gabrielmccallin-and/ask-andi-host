import { credentialHelper } from './credential-helper'
import fs from 'fs'

import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('fs')

const mockReadFileSync = fs.readFileSync as unknown as ReturnType<typeof vi.fn>

describe('credentialHelper', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns credentials from local file if no env vars are set', () => {
    mockReadFileSync.mockReturnValue('{"foo":"bar"}')
    const env = {}
    const result = credentialHelper(env as NodeJS.ProcessEnv)
    expect(result).toEqual({ foo: 'bar' })
    expect(fs.readFileSync).toHaveBeenCalledWith('./service-account-key.json', 'utf8')
  })

  it('returns credentials from GOOGLE_SERVICE_ACCOUNT_KEY env var', () => {
    const env = { GOOGLE_SERVICE_ACCOUNT_KEY: '{"baz":"qux"}' }
    const result = credentialHelper(env as NodeJS.ProcessEnv)
    expect(result).toEqual({ baz: 'qux' })
  })

  it('returns empty string and logs for Cloud Run (K_SERVICE set)', () => {
    const env = { K_SERVICE: 'my-service' }
    const result = credentialHelper(env as NodeJS.ProcessEnv)
    expect(result).toBe('')
  })
})
