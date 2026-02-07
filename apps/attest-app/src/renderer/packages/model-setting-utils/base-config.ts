import * as Sentry from '@sentry/react'
import type {
  ModelProvider,
  ProviderBaseInfo,
  ProviderModelInfo,
  ProviderSettings,
  SessionType,
} from '../../../shared/types'
import * as remote from '../../packages/remote'
import type { ModelSettingUtil } from './interface'

export default abstract class BaseConfig implements ModelSettingUtil {
  public abstract provider: ModelProvider
  public abstract getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings,
    providerBaseInfo?: ProviderBaseInfo
  ): Promise<string>

  protected abstract listProviderModels(settings: ProviderSettings): Promise<ProviderModelInfo[]>

  private async listRemoteProviderModels(): Promise<ProviderModelInfo[]> {
    return await remote
      .getModelManifest({
        aiProvider: this.provider,
      })
      .then((res) => {
        return Array.isArray(res.models) ? res.models : []
      })
      .catch(() => {
        return []
      })
  }

  // 有三个来源：本地写死、后端配置、服务商模型列表
  public async getMergeOptionGroups(providerSettings: ProviderSettings): Promise<ProviderModelInfo[]> {
    const localOptionGroups = providerSettings.models || []
    const [remoteModels, models] = await Promise.all([
      this.listRemoteProviderModels().catch((e) => {
        Sentry.captureException(e)
        return []
      }),
      this.listProviderModels(providerSettings).catch((e) => {
        Sentry.captureException(e)
        return []
      }),
    ])
    // 确保两个数组都是有效的数组
    const safeRemoteModels = Array.isArray(remoteModels) ? remoteModels : []
    const safeProviderModels = Array.isArray(models) ? models : []
    const remoteOptionGroups = [...safeRemoteModels, ...safeProviderModels]
    const mergedModels = this.mergeOptionGroups(localOptionGroups, remoteOptionGroups)

    // 尝试获取模型信息来丰富模型数据
    const enrichedModels = await this.enrichModelsWithInfo(mergedModels)
    return enrichedModels
  }

  /**
   * 合并本地与远程的模型选项组。
   * 本地模型优先，远程模型中与本地重复的会被过滤。
   * @param localOptionGroups 本地模型选项组
   * @param remoteOptionGroups 远程模型选项组
   * @returns
   */
  protected mergeOptionGroups(localOptionGroups: ProviderModelInfo[], remoteOptionGroups: ProviderModelInfo[]) {
    // 创建本地模型的映射，用于快速查找
    const localModelMap = new Map<string, ProviderModelInfo>()
    for (const model of localOptionGroups) {
      localModelMap.set(model.modelId, model)
    }

    const mergedModels: ProviderModelInfo[] = []
    const processedModelIds = new Set<string>()

    // 先添加所有本地模型
    for (const model of localOptionGroups) {
      mergedModels.push(model)
      processedModelIds.add(model.modelId)
    }

    // 处理远程模型
    for (const remoteModel of remoteOptionGroups) {
      if (!processedModelIds.has(remoteModel.modelId)) {
        // 新的远程模型，直接添加
        mergedModels.push(remoteModel)
        processedModelIds.add(remoteModel.modelId)
      }
    }

    return mergedModels
  }

  private async enrichModelsWithInfo(models: ProviderModelInfo[]): Promise<ProviderModelInfo[]> {
    if (models.length === 0) {
      return models
    }

    try {
      // 检查模型信息是否完整，只查询信息不完整的模型
      const incompleteModels = models.filter(
        (model) => !model.type || !model.capabilities || !model.contextWindow || !model.maxOutput
      )

      if (incompleteModels.length === 0) {
        // 所有模型信息都完整，无需API请求
        return models
      }

      // 收集需要查询的模型ID，最多100个
      const modelIds = incompleteModels.map((model) => model.modelId).slice(0, 100)

      // 调用API获取模型信息
      const modelsInfoData = await remote.getProviderModelsInfo({ modelIds })

      // 用获取到的信息丰富现有模型数据，只添加缺失的字段
      return models.map((model) => {
        const modelInfo = modelsInfoData[model.modelId]
        if (modelInfo) {
          return {
            ...model,
            type: model.type || modelInfo.type,
            capabilities: model.capabilities || modelInfo.capabilities,
            contextWindow: model.contextWindow || modelInfo.contextWindow,
            maxOutput: model.maxOutput || modelInfo.maxOutput,
            nickname: model.nickname || modelInfo.nickname,
            labels: model.labels || modelInfo.labels,
          }
        }
        return model
      })
    } catch (error) {
      // 如果获取模型信息失败，返回原始模型列表
      Sentry.captureException(error)
      return models
    }
  }
}
