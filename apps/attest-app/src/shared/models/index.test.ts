import { settings as getDefaultSettings, newConfigs } from 'src/shared/defaults'
import { ModelProviderEnum, type SessionSettings, type Settings } from 'src/shared/types'
import type { ModelDependencies } from 'src/shared/types/adapters'
import type { SentryScope } from 'src/shared/utils/sentry_adapter'
import { describe, expect, it, vi } from 'vitest'
import NearAI from './near-ai'
import { getModel } from './index'

const mockScope: SentryScope = {
  setTag: vi.fn(),
  setExtra: vi.fn(),
}

const mockDependencies: ModelDependencies = {
  request: {
    fetchWithOptions: vi.fn(),
    apiRequest: vi.fn(),
  },
  storage: {
    saveImage: vi.fn(),
    getImage: vi.fn(),
  },
  sentry: {
    captureException: vi.fn(),
    withScope: vi.fn((callback: (scope: SentryScope) => void) => callback(mockScope)),
  },
  getRemoteConfig: vi.fn(),
}

describe('getModel', () => {
  it('returns NearAI when provider is NearAI', () => {
    const sessionSettings: SessionSettings = {
      provider: ModelProviderEnum.NearAI,
      modelId: 'deepseek-ai/DeepSeek-V3.1',
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 2048,
      stream: true,
    }

    const defaultSettings = getDefaultSettings()
    const globalSettings: Settings = {
      ...defaultSettings,
      providers: {
        ...defaultSettings.providers,
        [ModelProviderEnum.NearAI]: {
          apiKey: 'test-key',
          apiHost: 'https://cloud-api.near.ai/v1',
          models: [{ modelId: 'deepseek-ai/DeepSeek-V3.1' }],
        },
      },
    }

    const model = getModel(sessionSettings, globalSettings, newConfigs(), mockDependencies)

    expect(model).toBeInstanceOf(NearAI)
  })
})
