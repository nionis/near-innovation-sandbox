import { Button, Group, Input, Pill, Radio, Select, Stack, Text } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import type React from 'react'
import { useTranslation } from 'react-i18next'

interface ModelSelectorsProps {
  embeddingModelList: Array<{ label: string; value: string }>
  rerankModelList: Array<{ label: string; value: string }>
  visionModelList: Array<{ label: string; value: string }>
  embeddingModel?: string | null
  rerankModel?: string | null
  visionModel?: string | null
  onEmbeddingModelChange?: (value: string | null) => void
  onRerankModelChange?: (value: string | null) => void
  onVisionModelChange?: (value: string | null) => void
  isEmbeddingDisabled?: boolean
  showEmbeddingModel?: boolean
}

export const KnowledgeBaseModelSelectors: React.FC<ModelSelectorsProps> = ({
  embeddingModelList,
  rerankModelList,
  visionModelList,
  embeddingModel,
  rerankModel,
  visionModel,
  onEmbeddingModelChange,
  onRerankModelChange,
  onVisionModelChange,
  isEmbeddingDisabled = false,
  showEmbeddingModel = true,
}) => {
  const { t } = useTranslation()

  return (
    <>
      {showEmbeddingModel && (
        <Select
          label={t('Embedding Model')}
          description={t('Used to extract text feature vectors, add in Settings - Provider - Model List')}
          data={embeddingModelList}
          value={embeddingModel}
          onChange={onEmbeddingModelChange}
          required={!isEmbeddingDisabled}
          disabled={isEmbeddingDisabled}
          searchable
          comboboxProps={{ withinPortal: false }}
          allowDeselect={false}
        />
      )}
      <Select
        label={t('Rerank Model (optional)')}
        description={t('Used to get more accurate search results')}
        data={rerankModelList}
        value={rerankModel}
        onChange={onRerankModelChange}
        clearable
        searchable
        comboboxProps={{ withinPortal: false, position: 'bottom' }}
      />
      <Select
        label={t('Vision Model (optional)')}
        description={t('Used to preprocess image files, requires models with vision capabilities enabled')}
        data={visionModelList}
        value={visionModel}
        onChange={onVisionModelChange}
        clearable
        searchable
        comboboxProps={{ withinPortal: false, position: 'bottom' }}
      />
    </>
  )
}

interface KnowledgeBaseChatboxAIInfoProps {
  showModelsLabel?: boolean
  hasError?: boolean
}

export const KnowledgeBaseChatboxAIInfo: React.FC<KnowledgeBaseChatboxAIInfoProps> = ({
  showModelsLabel = false,
  hasError = false,
}) => {
  const { t } = useTranslation()

  return (
    <Stack gap="sm">
      {showModelsLabel && (
        <Group>
          {t('Models')}: <Pill>Chatbox AI</Pill>
        </Group>
      )}
      <Text size="sm" c="dimmed">
        {t('Chatbox AI provides all the essential model support required for knowledge base processing')}
      </Text>
      {hasError && (
        <Text size="sm" c="red">
          {t('Failed to load Chatbox AI models configuration')}
        </Text>
      )}
    </Stack>
  )
}

interface KnowledgeBaseProviderModeSelectProps {
  value: 'chatbox-ai' | 'custom'
  onChange: (value: 'chatbox-ai' | 'custom') => void
  isChatboxAIDisabled?: boolean
}

export const KnowledgeBaseProviderModeSelect: React.FC<KnowledgeBaseProviderModeSelectProps> = ({
  value,
  onChange,
  isChatboxAIDisabled = false,
}) => {
  const { t } = useTranslation()

  return (
    <Radio.Group
      label={t('Model Provider')}
      value={value}
      onChange={(value) => onChange(value as 'chatbox-ai' | 'custom')}
    >
      <Group mt="xs">
        <Radio value="chatbox-ai" label="Chatbox AI" disabled={isChatboxAIDisabled} />
        <Radio value="custom" label={t('Custom')} />
      </Group>
    </Radio.Group>
  )
}

interface KnowledgeBaseFormActionsProps {
  onCancel: () => void
  onConfirm: () => void
  confirmText: string
  isConfirmDisabled?: boolean
  showDelete?: boolean
  onDelete?: () => void
}

export const KnowledgeBaseFormActions: React.FC<KnowledgeBaseFormActionsProps> = ({
  onCancel,
  onConfirm,
  confirmText,
  isConfirmDisabled = false,
  showDelete = false,
  onDelete,
}) => {
  const { t } = useTranslation()

  if (showDelete && onDelete) {
    return (
      <Group justify="space-between">
        <Button variant="outline" color="red" leftSection={<IconTrash size={16} />} onClick={onDelete}>
          {t('Delete')}
        </Button>
        <Group>
          <Button variant="default" onClick={onCancel}>
            {t('Cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={isConfirmDisabled}>
            {confirmText}
          </Button>
        </Group>
      </Group>
    )
  }

  return (
    <Group justify="flex-end">
      <Button variant="default" onClick={onCancel}>
        {t('Cancel')}
      </Button>
      <Button onClick={onConfirm} disabled={isConfirmDisabled}>
        {confirmText}
      </Button>
    </Group>
  )
}

interface KnowledgeBaseNameInputProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  autoFocus?: boolean
}

export const KnowledgeBaseNameInput: React.FC<KnowledgeBaseNameInputProps> = ({
  value,
  onChange,
  label,
  placeholder,
  autoFocus = false,
}) => {
  const { t } = useTranslation()

  return (
    <Input.Wrapper label={label}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || t('New knowledge base name')}
        autoFocus={autoFocus}
      />
    </Input.Wrapper>
  )
}
