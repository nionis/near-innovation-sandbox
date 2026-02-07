import { type AnthropicProviderOptions, createAnthropic } from '@ai-sdk/anthropic'
import type { LanguageModelV2 } from '@ai-sdk/provider'
import type { ProviderModelInfo } from '../types'
import type { ModelDependencies } from '../types/adapters'
import { normalizeClaudeHost } from '../utils/llm_utils'
import AbstractAISDKModel, { type CallSettings } from './abstract-ai-sdk'
import { ApiError } from './errors'
import type { CallChatCompletionOptions } from './types'

interface Options {
  apiKey: string
  apiHost: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxOutputTokens?: number
  stream?: boolean
}

export default class CustomClaude extends AbstractAISDKModel {
  public name = 'Custom Claude'

  constructor(
    public options: Options,
    dependencies: ModelDependencies
  ) {
    super(options, dependencies)
    const { apiHost } = normalizeClaudeHost(options.apiHost)
    this.options = { ...options, apiHost }
    this.injectDefaultMetadata = false
  }

  protected getProvider() {
    return createAnthropic({
      baseURL: this.options.apiHost,
      apiKey: this.options.apiKey,
      headers: {
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    })
  }

  protected getChatModel(_options: CallChatCompletionOptions): LanguageModelV2 {
    const provider = this.getProvider()
    return provider.languageModel(this.options.model.modelId)
  }

  protected getCallSettings(options: CallChatCompletionOptions): CallSettings {
    const isModelSupportReasoning = this.isSupportReasoning()
    let providerOptions = {} as { anthropic: AnthropicProviderOptions }
    if (isModelSupportReasoning) {
      providerOptions = {
        anthropic: {
          ...(options.providerOptions?.claude || {}),
        },
      }
    }
    return {
      providerOptions,
      temperature: this.options.temperature,
      topP: this.options.topP,
      maxOutputTokens: this.options.maxOutputTokens,
    }
  }

  // https://docs.anthropic.com/en/docs/api/models
  public async listModels(): Promise<ProviderModelInfo[]> {
    type Response = {
      data: { id: string; type: string }[]
    }
    const url = `${this.options.apiHost}/models?limit=990`
    const res = await this.dependencies.request.apiRequest({
      url: url,
      method: 'GET',
      headers: {
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'x-api-key': this.options.apiKey,
      },
    })
    const json: Response = await res.json()
    if (!json['data']) {
      throw new ApiError(JSON.stringify(json))
    }
    return json['data']
      .filter((item) => item.type === 'model')
      .map((item) => ({
        modelId: item.id,
        type: 'chat',
      }))
  }
}
