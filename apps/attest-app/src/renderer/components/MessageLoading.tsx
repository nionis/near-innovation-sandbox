import { Loader } from 'lucide-react'
import { Message } from 'src/shared/types'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import { Trans } from 'react-i18next'
import LinkTargetBlank from './Link'
import { useAtomValue } from 'jotai'
import * as atoms from '../stores/atoms'

export default function MessageStatuses(props: { statuses: Message['status'] }) {
  const { statuses } = props
  if (!statuses || statuses.length === 0) {
    return null
  }
  return (
    <>
      {statuses.map((status, index) => (
        <MessageStatus key={index} status={status} />
      ))}
    </>
  )
}

function MessageStatus(props: { status: NonNullable<Message['status']>[number] }) {
  const { status } = props
  const { t } = useTranslation()
  const remoteConfig = useAtomValue(atoms.remoteConfigAtom)
  if (status.type === 'sending_file') {
    return (
      <div>
        <LoadingBubble>
          <span className="flex flex-col">
            <span>{t('Reading file...')}</span>
            {status.mode && (
              <span className="text-[10px] opacity-70 font-normal">
                {status.mode === 'local' ? t('Local Mode') : t('Advanced Mode')}
              </span>
            )}
          </span>
        </LoadingBubble>
        {status.mode === 'local' && remoteConfig.setting_chatboxai_first && (
          <Typography variant="body2" sx={{ opacity: 0.5 }} className="pb-1">
            <Trans
              i18nKey="Due to local processing limitations, <Link>Chatbox AI Service</Link> is recommended for enhanced document processing capabilities and better results."
              components={{
                Link: (
                  <LinkTargetBlank href="https://chatboxai.app/redirect_app/advanced_file_processing"></LinkTargetBlank>
                ),
              }}
            />
          </Typography>
        )}
      </div>
    )
  }
  if (status.type === 'loading_webpage') {
    return (
      <div>
        <LoadingBubble>
          <span className="flex flex-col">
            <span>{t('Loading webpage...')}</span>
            {status.mode && (
              <span className="text-[10px] opacity-70 font-normal">
                {status.mode === 'local' ? t('Local Mode') : t('Advanced Mode')}
              </span>
            )}
          </span>
        </LoadingBubble>
        {status.mode === 'local' && remoteConfig.setting_chatboxai_first && (
          <Typography variant="body2" sx={{ opacity: 0.5 }} className="pb-1">
            <Trans
              i18nKey="Due to local processing limitations, <Link>Chatbox AI Service</Link> is recommended to enhance webpage parsing capabilities, especially for dynamic pages."
              components={{
                Link: (
                  <LinkTargetBlank href="https://chatboxai.app/redirect_app/advanced_url_processing"></LinkTargetBlank>
                ),
              }}
            />
          </Typography>
        )}
      </div>
    )
  }
  return null
}

export function LoadingBubble(props: { children: React.ReactNode }) {
  const { children } = props
  return (
    <div className="flex flex-row items-start justify-start overflow-x-auto overflow-y-hidden">
      <div
        className="flex justify-start items-center mb-1 px-1 py-2
                                                    border-solid border-blue-400/20 shadow-md rounded-lg
                                                    bg-blue-100
                                                    "
      >
        <Loader className="w-6 h-6 ml-1 mr-2 text-black animate-spin" />
        <span className="mr-4 animate-pulse font-bold text-gray-800/70">{children}</span>
      </div>
    </div>
  )
}
