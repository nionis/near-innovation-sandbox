import { createGoogleGenerativeAI, type GoogleGenerativeAIProviderOptions } from '@ai-sdk/google'
import type { LanguageModelV2 } from '@ai-sdk/provider'
import type { ProviderModelInfo } from '../types'
import type { ModelDependencies } from '../types/adapters'
import { normalizeGeminiHost } from '../utils/llm_utils'
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

export default class CustomGemini extends AbstractAISDKModel {
  public name = 'Custom Gemini'

  constructor(
    public options: Options,
    dependencies: ModelDependencies
  ) {
    super(options, dependencies)
    this.injectDefaultMetadata = false
  }

  isSupportSystemMessage() {
    // Some Gemini models don't support system messages
    return ![
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash-thinking-exp',
      'gemini-2.0-flash-exp-image-generation',
      'gemini-2.5-flash-image-preview',
    ].includes(this.options.model.modelId)
  }

  protected getProvider() {
    return createGoogleGenerativeAI({
      apiKey: this.options.apiKey,
      baseURL: normalizeGeminiHost(this.options.apiHost).apiHost,
    })
  }

  protected getChatModel(_options: CallChatCompletionOptions): LanguageModelV2 {
    const provider = this.getProvider()
    return provider.chat(this.options.model.modelId)
  }

  protected getCallSettings(options: CallChatCompletionOptions): CallSettings {
    const isModelSupportThinking = this.isSupportReasoning()

    // Default safety settings - disable all filters for maximum flexibility
    let providerParams: GoogleGenerativeAIProviderOptions = {
      safetySettings: [
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      ],
    }

    // Enable thinking mode if model supports reasoning
    if (isModelSupportThinking) {
      providerParams = {
        ...providerParams,
        ...(options.providerOptions?.google || {}),
        thinkingConfig: {
          ...(options.providerOptions?.google?.thinkingConfig || {}),
          includeThoughts: true,
        },
      }
    }

    const settings: CallSettings = {
      temperature: this.options.temperature,
      topP: this.options.topP,
      maxOutputTokens: this.options.maxOutputTokens,
      providerOptions: {
        google: {
          ...providerParams,
        } satisfies GoogleGenerativeAIProviderOptions,
      },
    }

    // Special handling for image generation models
    if (
      ['gemini-2.0-flash-preview-image-generation', 'gemini-2.5-flash-image-preview'].includes(
        this.options.model.modelId
      )
    ) {
      settings.providerOptions = {
        google: {
          ...providerParams,
          responseModalities: ['TEXT', 'IMAGE'],
        } satisfies GoogleGenerativeAIProviderOptions,
      }
    }

    return settings
  }

  async listModels(): Promise<ProviderModelInfo[]> {
    // Fetch available models from Gemini API
    // https://ai.google.dev/api/models#method:-models.list
    type Response = {
      models: {
        name: string
        version: string
        displayName: string
        description: string
        inputTokenLimit: number
        outputTokenLimit: number
        supportedGenerationMethods: string[]
        temperature: number
        topP: number
        topK: number
      }[]
    }

    try {
      const { apiHost } = normalizeGeminiHost(this.options.apiHost)
      const res = await this.dependencies.request.apiRequest({
        url: `${apiHost}/models?key=${this.options.apiKey}`,
        method: 'GET',
        headers: {},
      })
      const json: Response = await res.json()

      if (!json.models) {
        throw new ApiError(JSON.stringify(json))
      }

      return json.models
        .filter((m) => m.supportedGenerationMethods.some((method) => method.includes('generate')))
        .filter((m) => m.name.includes('gemini'))
        .map((m) => ({
          modelId: m.name.replace('models/', ''),
          nickname: m.displayName,
          type: 'chat' as const,
          contextWindow: m.inputTokenLimit,
          maxOutput: m.outputTokenLimit,
        }))
        .sort((a, b) => a.modelId.localeCompare(b.modelId))
    } catch (error) {
      // If fetching fails, return empty array instead of throwing
      console.error('Failed to fetch Gemini models:', error)
      return []
    }
  }
}
