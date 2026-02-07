import type { ModelDependencies } from '../types/adapters'
import OpenAICompatible, { type OpenAICompatibleSettings } from './openai-compatible'

interface Options extends OpenAICompatibleSettings {}

export default class DeepSeek extends OpenAICompatible {
  public name = 'DeepSeek'
  public options: Options

  constructor(options: Omit<Options, 'apiHost'>, dependencies: ModelDependencies) {
    const apiHost = 'https://api.deepseek.com/v1'
    super(
      {
        apiKey: options.apiKey,
        apiHost,
        model: options.model,
        temperature: options.model.modelId === 'deepseek-reasoner' ? undefined : options.temperature,
        topP: options.model.modelId === 'deepseek-reasoner' ? undefined : options.topP,
        maxOutputTokens: options.maxOutputTokens,
        stream: options.stream,
      },
      dependencies
    )
    this.options = {
      ...options,
      apiHost,
    }
  }

  isSupportToolUse(scope?: 'web-browsing') {
    if (scope === 'web-browsing' && /deepseek-(v3|r1)$/.test(this.options.model.modelId.toLowerCase())) {
      return false
    }
    return super.isSupportToolUse()
  }
}
