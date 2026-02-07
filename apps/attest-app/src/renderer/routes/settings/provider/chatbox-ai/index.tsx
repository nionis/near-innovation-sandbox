import { createFileRoute, Navigate } from '@tanstack/react-router'
import { ModelProviderEnum } from 'src/shared/types'

export const Route = createFileRoute('/settings/provider/chatbox-ai/')({
  component: RouteComponent,
})

/** Redirect legacy chatbox-ai settings to NEAR AI provider settings. */
export function RouteComponent() {
  return <Navigate to="/settings/provider/$providerId" params={{ providerId: ModelProviderEnum.NearAI }} replace />
}
