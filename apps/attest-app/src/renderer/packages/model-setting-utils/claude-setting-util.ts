import { createModelDependencies } from '@/adapters'
import Claude from 'src/shared/models/claude'
import { ModelProvider, ModelProviderEnum, ProviderSettings, SessionType } from 'src/shared/types'
import BaseConfig from './base-config'
import { ModelSettingUtil } from './interface'

export default class ClaudeSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProviderEnum.Claude
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `Claude API (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  protected async listProviderModels(settings: ProviderSettings) {
    const dependencies = await createModelDependencies()
    const claude = new Claude(
      {
        claudeApiHost: settings.apiHost!,
        claudeApiKey: settings.apiKey!,
        model: {
          modelId: '',
          capabilities: [],
        },
      },
      dependencies
    )
    return claude.listModels()
  }
}
