import { useModelProvider } from '@/hooks/useModelProvider'
import { useNavigate } from '@tanstack/react-router'
import { route } from '@/constants/routes'
import { localStorageKey } from '@/constants/localStorage'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  IconExternalLink,
  IconShieldCheck,
  IconMessage,
} from '@tabler/icons-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type SetupMode = 'select' | 'chat'

function SetupScreen() {
  const navigate = useNavigate()
  const { updateProvider, providers } = useModelProvider()

  const [mode, setMode] = useState<SetupMode>('select')
  const [apiKey, setApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const nearAIProvider = providers.find((p) => p.provider === 'near-ai')

  const handleVerify = () => {
    // Navigate to import chat page for verification
    navigate({
      to: route.import,
      params: {},
    })
  }

  const handleChatSetup = () => {
    setMode('chat')
  }

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

  const handleBack = () => {
    setMode('select')
    setApiKey('')
  }

  if (mode === 'chat') {
    return (
      <div className="flex h-full flex-col justify-center">
        <div className="h-full px-8 overflow-y-auto flex flex-col gap-2 justify-center">
          <div className="w-full max-w-md mx-auto">
            <div className="mb-6 text-center">
              <h1 className="font-studio font-medium text-2xl mb-2">
                Setup Chat
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

                <Button
                  onClick={handleBack}
                  variant="outline"
                  disabled={isSaving}
                  className="w-full"
                >
                  Back
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

  return (
    <div className="flex h-full flex-col justify-center">
      <div className="h-full px-8 overflow-y-auto flex flex-col gap-2 justify-center">
        <div className="w-full max-w-2xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="font-studio font-medium text-3xl mb-3">
              Welcome to Attest AI!
            </h1>
            <p className="text-muted-foreground text-lg">
              Choose how you'd like to get started
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={handleVerify}
            >
              <CardHeader>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                  <IconShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Verify</CardTitle>
                <CardDescription>a document sent to you</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={handleVerify}>
                  Start Verification
                </Button>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={handleChatSetup}
            >
              <CardHeader>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                  <IconMessage className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Chat</CardTitle>
                <CardDescription>with a private LLM</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={handleChatSetup}>
                  Start Chat
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SetupScreen
