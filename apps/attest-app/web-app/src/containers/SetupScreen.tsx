import { useModelProvider } from '@/hooks/useModelProvider'
import { useNavigate } from '@tanstack/react-router'
import { route } from '@/constants/routes'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { localStorageKey } from '@/constants/localStorage'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IconExternalLink } from '@tabler/icons-react'

function SetupScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { updateProvider, providers } = useModelProvider()

  const [apiKey, setApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const nearAIProvider = providers.find((p) => p.provider === 'near-ai')

  const handleContinue = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key')
      return
    }

    if (!nearAIProvider) {
      toast.error('NEAR AI provider not found')
      return
    }

    setIsSaving(true)
    try {
      // Update the NEAR AI provider with the API key
      updateProvider('near-ai', {
        ...nearAIProvider,
        api_key: apiKey,
        active: true,
      })

      // Mark setup as completed
      localStorage.setItem(localStorageKey.setupCompleted, 'true')

      // Show success message
      toast.success('API key saved successfully')

      // Navigate to home
      navigate({
        to: route.home,
        params: {},
      })
    } catch (error) {
      console.error('Error saving API key:', error)
      toast.error('Failed to save API key')
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col justify-center">
      <div className="h-full px-8 overflow-y-auto flex flex-col gap-2 justify-center">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-6 text-center">
            <h1 className="font-studio font-medium text-2xl mb-2">
              Welcome to Attest AI!
            </h1>
            <p className="text-muted-foreground">
              To get started, you'll need a NEAR AI API key.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="api-key" className="text-sm font-medium">
                API Key
              </label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your NEAR AI API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleContinue()
                  }
                }}
                disabled={isSaving}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={handleContinue}
                disabled={isSaving || !apiKey.trim()}
                className="w-full"
              >
                {isSaving ? 'Saving...' : 'Continue'}
              </Button>

              <a
                href="https://cloud.near.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center justify-center gap-1"
              >
                Get API Key
                <IconExternalLink size={14} />
              </a>
            </div>

            <div className="text-xs text-muted-foreground text-center mt-2">
              Visit{' '}
              <a
                href="https://cloud.near.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                cloud.near.ai
              </a>{' '}
              to create an account and get your API key.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SetupScreen
