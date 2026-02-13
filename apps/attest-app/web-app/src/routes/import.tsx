import { createFileRoute } from '@tanstack/react-router'
import { ImportChatPage } from '../pages/ImportChatPage'

export const Route = createFileRoute('/import')({
  component: ImportChatPage,
})
