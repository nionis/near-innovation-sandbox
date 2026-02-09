import { createFileRoute, Link } from '@tanstack/react-router'
import { route } from '@/constants/routes'
import SettingsMenu from '@/containers/SettingsMenu'
import HeaderPage from '@/containers/HeaderPage'
import { Button } from '@/components/ui/button'
import { Card, CardItem } from '@/containers/Card'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { useModelProvider } from '@/hooks/useModelProvider'
import { IconExternalLink, IconRefresh } from '@tabler/icons-react'
import ProvidersAvatar from '@/containers/ProvidersAvatar'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { useState, useEffect } from 'react'
import { useServiceHub } from '@/hooks/useServiceHub'
import { toast } from 'sonner'
import { getModelDisplayName } from '@/lib/utils'
import Capabilities from '@/containers/Capabilities'
import { DialogEditModel } from '@/containers/dialogs/EditModel'
import { ModelSetting } from '@/containers/ModelSetting'
import { FavoriteModelAction } from '@/containers/FavoriteModelAction'
import { DialogDeleteModel } from '@/containers/dialogs/DeleteModel'
import { predefinedProviders } from '@/constants/providers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute(route.settings.near_ai as any)({
  component: NearAI,
})

function NearAI() {
  const { t } = useTranslation()
  const { providers, updateProvider } = useModelProvider()
  const serviceHub = useServiceHub()

  // Find the NEAR AI provider
  const nearAIProvider = providers.find((p) => p.provider === 'near-ai')

  const [apiKey, setApiKey] = useState(nearAIProvider?.api_key || '')
  const [isActive, setIsActive] = useState(nearAIProvider?.active || false)
  const [refreshingModels, setRefreshingModels] = useState(false)

  useEffect(() => {
    if (nearAIProvider) {
      setApiKey(nearAIProvider.api_key || '')
      setIsActive(nearAIProvider.active || false)
    }
  }, [nearAIProvider])

  const handleRefreshModels = async (overrideApiKey?: string) => {
    if (!nearAIProvider || !nearAIProvider.base_url) {
      toast.error(t('providers:models'), {
        description: t('providers:refreshModelsError'),
      })
      return
    }

    setRefreshingModels(true)
    try {
      // Use the override API key if provided (to avoid race condition with state updates)
      const providerToFetch = overrideApiKey
        ? { ...nearAIProvider, api_key: overrideApiKey }
        : nearAIProvider

      const modelIds = await serviceHub
        .providers()
        .fetchModelsFromProvider(providerToFetch)

      // Create new models from the fetched IDs
      const newModels: Model[] = modelIds.map((id) => ({
        id,
        model: id,
        name: id,
        capabilities: ['completion'], // Default capability
        version: '1.0',
      }))

      // Filter out models that already exist
      const existingModelIds = nearAIProvider.models.map((m) => m.id)
      const modelsToAdd = newModels.filter(
        (model) => !existingModelIds.includes(model.id)
      )

      if (modelsToAdd.length > 0) {
        // Update the provider with new models
        const updatedModels = [...nearAIProvider.models, ...modelsToAdd]
        updateProvider('near-ai', {
          ...nearAIProvider,
          models: updatedModels,
        })

        toast.success(t('providers:models'), {
          description: t('providers:refreshModelsSuccess', {
            count: modelsToAdd.length,
            provider: 'NEAR AI',
          }),
        })
      } else {
        toast.success(t('providers:models'), {
          description: t('providers:noNewModels'),
        })
      }
    } catch (error) {
      console.error('Failed to refresh NEAR AI models:', error)
      toast.error(t('providers:models'), {
        description: t('providers:refreshModelsFailed', {
          provider: 'NEAR AI',
        }),
      })
    } finally {
      setRefreshingModels(false)
    }
  }

  const handleSaveApiKey = async () => {
    if (nearAIProvider) {
      updateProvider('near-ai', {
        ...nearAIProvider,
        api_key: apiKey,
      })

      // Refresh models with the new API key (passed directly to avoid race condition)
      await handleRefreshModels(apiKey)
    }
  }

  const handleToggleActive = (active: boolean) => {
    if (nearAIProvider) {
      setIsActive(active)
      updateProvider('near-ai', {
        ...nearAIProvider,
        active,
      })
    }
  }

  if (!nearAIProvider) {
    return (
      <div className="flex flex-col h-svh w-full">
        <HeaderPage>
          <div className="flex items-center gap-2 w-full">
            <span className="font-medium text-base font-studio">
              {t('common:settings')}
            </span>
          </div>
        </HeaderPage>
        <div className="flex h-[calc(100%-60px)]">
          <SettingsMenu />
          <div className="p-4 pt-0 w-full h-[calc(100%-32px)] overflow-y-auto">
            <div className="flex flex-col justify-between gap-4 gap-y-3 w-full">
              <Card>
                <CardItem
                  title="NEAR AI Provider Not Found"
                  description="The NEAR AI provider is not available in your configuration."
                />
              </Card>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-svh w-full">
      <HeaderPage>
        <div className="flex items-center gap-2 w-full">
          <span className="font-medium text-base font-studio">
            {t('common:settings')}
          </span>
        </div>
      </HeaderPage>
      <div className="flex h-[calc(100%-60px)]">
        <SettingsMenu />
        <div className="p-4 pt-0 w-full h-[calc(100%-32px)] overflow-y-auto">
          <div className="flex flex-col justify-between gap-4 gap-y-3 w-full">
            {/* NEAR AI Configuration */}
            <Card
              header={
                <div className="flex items-center justify-between w-full mb-6">
                  <div className="flex items-center gap-3">
                    <ProvidersAvatar provider={nearAIProvider} />
                    <div>
                      <span className="font-medium text-base font-studio text-foreground">
                        NEAR AI
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {nearAIProvider.models.length} Models
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={handleToggleActive}
                  />
                </div>
              }
            >
              <CardItem
                title="API Key"
                description={
                  <span>
                    Your NEAR AI API key. Visit{' '}
                    <a
                      href="https://app.near.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      NEAR AI
                      <IconExternalLink size={14} />
                    </a>{' '}
                    to get your API key.
                  </span>
                }
                actions={
                  <div className="flex items-center gap-2 w-full">
                    <Input
                      type="password"
                      placeholder="Insert API Key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleSaveApiKey}
                    >
                      Save
                    </Button>
                  </div>
                }
              />

              <CardItem
                title="Base URL"
                description="The NEAR AI API endpoint."
                actions={
                  <Input
                    type="text"
                    value={nearAIProvider.base_url}
                    disabled
                    className="w-full"
                  />
                }
              />

              <CardItem
                title="Explore Models"
                description={
                  <a
                    href={nearAIProvider.explore_models_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View available NEAR AI models
                    <IconExternalLink size={14} />
                  </a>
                }
              />
            </Card>

            {/* Models List */}
            <Card
              header={
                <div className="flex items-center justify-between w-full mb-6">
                  <div>
                    <h3 className="font-medium text-base font-studio text-foreground">
                      Models
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {nearAIProvider.models.length} Models
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRefreshModels()}
                    disabled={refreshingModels}
                  >
                    <IconRefresh
                      size={16}
                      className={refreshingModels ? 'animate-spin' : ''}
                    />
                    {refreshingModels ? 'Refreshing...' : 'Refresh'}
                  </Button>
                </div>
              }
            >
              {nearAIProvider.models.length ? (
                nearAIProvider.models.map((model, modelIndex) => {
                  const capabilities = model.capabilities || []
                  return (
                    <CardItem
                      key={modelIndex}
                      title={
                        <div className="flex items-center gap-2">
                          <h1
                            className="font-medium line-clamp-1"
                            title={model.id}
                          >
                            {getModelDisplayName(model)}
                          </h1>
                          <Capabilities capabilities={capabilities} />
                        </div>
                      }
                      actions={
                        <div className="flex items-center gap-0.5">
                          <DialogEditModel
                            provider={nearAIProvider}
                            modelId={model.id}
                          />
                          {model.settings && (
                            <ModelSetting
                              provider={nearAIProvider}
                              model={model}
                            />
                          )}
                          {((nearAIProvider &&
                            !predefinedProviders.some(
                              (p) => p.provider === nearAIProvider.provider
                            )) ||
                            (nearAIProvider &&
                              predefinedProviders.some(
                                (p) => p.provider === nearAIProvider.provider
                              ) &&
                              Boolean(nearAIProvider.api_key?.length))) && (
                            <FavoriteModelAction model={model} />
                          )}
                          <DialogDeleteModel
                            provider={nearAIProvider}
                            modelId={model.id}
                          />
                        </div>
                      }
                    />
                  )
                })
              ) : (
                <div className="-mt-2">
                  <div className="flex items-center gap-2">
                    <h6 className="font-medium text-base">
                      {t('providers:noModelFound')}
                    </h6>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    {t('providers:noModelFoundDesc')}
                    &nbsp;
                    <Link to={route.hub.index}>{t('common:hub')}</Link>
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
