import type { ProviderModelInfo } from '../types'
import type { ModelDependencies } from '../types/adapters'
import { normalizeOpenAIApiHostAndPath } from '../utils/llm_utils'
import OpenAICompatible from './openai-compatible'

const helpers = {
  isModelSupportVision: (model: string) => {
    return [
      'gemma3',
      'llava',
      'llama3.2-vision',
      'llava-llama3',
      'moondream',
      'bakllava',
      'llava-phi3',
      'granite3.2-vision',
      'qwen3',
    ].some((m) => model.startsWith(m))
  },
  isModelSupportToolUse: (model: string) => {
    return [
      'qwq',
      'llama3.3',
      'llama3.2',
      'llama3.1',
      'mistral',
      'qwen2.5',
      'qwen2.5-coder',
      'qwen2',
      'mistral-nemo',
      'mixtral',
      'smollm2',
      'mistral-small',
      'command-r',
      'hermes3',
      'mistral-large',
      'qwen3',
    ].some((m) => model.startsWith(m))
  },
}

interface OllamaOptions {
  ollamaHost: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxOutputTokens?: number
  stream?: boolean
  useProxy?: boolean
}

export default class Ollama extends OpenAICompatible {
  public name = 'Ollama'

  constructor(
    private ollamaOptions: OllamaOptions,
    dependencies: ModelDependencies
  ) {
    super(
      {
        apiKey: 'ollama',
        apiHost: normalizeOpenAIApiHostAndPath({ apiHost: ollamaOptions.ollamaHost }).apiHost,
        model: ollamaOptions.model,
        temperature: ollamaOptions.temperature,
        topP: ollamaOptions.topP,
        maxOutputTokens: ollamaOptions.maxOutputTokens,
        stream: ollamaOptions.stream,
        useProxy: ollamaOptions.useProxy,
      },
      dependencies
    )
  }
  public isSupportToolUse(): boolean {
    return helpers.isModelSupportToolUse(this.options.model.modelId) || super.isSupportToolUse()
  }
  public isSupportVision(): boolean {
    return helpers.isModelSupportVision(this.options.model.modelId) || super.isSupportVision()
  }
}
