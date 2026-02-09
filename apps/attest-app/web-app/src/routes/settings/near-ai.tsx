import { createFileRoute } from '@tanstack/react-router'
import { route } from '@/constants/routes'
import SettingsMenu from '@/containers/SettingsMenu'
import HeaderPage from '@/containers/HeaderPage'
import { Button } from '@/components/ui/button'
import { Card, CardItem } from '@/containers/Card'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { useModelProvider } from '@/hooks/useModelProvider'
import { IconExternalLink } from '@tabler/icons-react'
import ProvidersAvatar from '@/containers/ProvidersAvatar'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { useState, useEffect } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute(route.settings.near_ai as any)({
  component: NearAI,
})

function NearAI() {
  const { t } = useTranslation()
  const { providers, updateProvider } = useModelProvider()
  
  // Find the NEAR AI provider
  const nearAIProvider = providers.find((p) => p.provider === 'near-ai')
  
  const [apiKey, setApiKey] = useState(nearAIProvider?.api_key || '')
  const [isActive, setIsActive] = useState(nearAIProvider?.active || false)

  useEffect(() => {
    if (nearAIProvider) {
      setApiKey(nearAIProvider.api_key || '')
      setIsActive(nearAIProvider.active || false)
    }
  }, [nearAIProvider])

  const handleSaveApiKey = () => {
    if (nearAIProvider) {
      updateProvider('near-ai', {
        ...nearAIProvider,
        api_key: apiKey,
      })
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
            <span className='font-medium text-base font-studio'>{t('common:settings')}</span>
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
          <span className='font-medium text-base font-studio'>{t('common:settings')}</span>
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
          </div>
        </div>
      </div>
    </div>
  )
}
