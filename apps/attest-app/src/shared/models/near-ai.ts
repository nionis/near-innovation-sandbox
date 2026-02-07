import { createNearAI } from '@repo/packages-near-ai-provider'
import { extractReasoningMiddleware, wrapLanguageModel } from 'ai'
import type { ProviderModelInfo } from '../types'
import type { ModelDependencies } from '../types/adapters'
import AbstractAISDKModel from './abstract-ai-sdk'
import type { CallChatCompletionOptions, ModelInterface } from './types'

export interface NearAISettings {
  apiKey: string
  apiHost: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxOutputTokens?: number
  stream?: boolean
  e2eeEnabled?: boolean
}

export default class NearAI extends AbstractAISDKModel implements ModelInterface {
  public name = 'NEAR AI'

  constructor(
    public options: NearAISettings,
    dependencies: ModelDependencies
  ) {
    super({ model: options.model, stream: options.stream }, dependencies)
  }

  protected getCallSettings() {
    return {
      temperature: this.options.temperature,
      topP: this.options.topP,
      maxOutputTokens: this.options.maxOutputTokens,
    }
  }

  protected getProvider(_options: CallChatCompletionOptions) {
    return createNearAI({
      apiKey: this.options.apiKey,
      baseURL: this.options.apiHost,
      e2ee: this.options.e2eeEnabled
        ? { enabled: true, algorithm: 'ecdsa' }
        : undefined,
    })
  }

  protected getChatModel(options: CallChatCompletionOptions) {
    const provider = this.getProvider(options)
    const baseModel = provider.languageModel(this.options.model.modelId)
    return wrapLanguageModel({
      model: baseModel,
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    })
  }
}
