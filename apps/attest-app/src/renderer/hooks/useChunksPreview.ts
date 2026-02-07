import { useState } from 'react'
import type { KnowledgeBaseFile } from 'src/shared/types'

export const useChunksPreview = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<KnowledgeBaseFile | null>(null)

  const openPreview = (file: KnowledgeBaseFile) => {
    setSelectedFile(file)
    setIsOpen(true)
  }

  const closePreview = () => {
    setIsOpen(false)
    setSelectedFile(null)
  }

  return {
    isOpen,
    selectedFile,
    openPreview,
    closePreview,
  }
}
