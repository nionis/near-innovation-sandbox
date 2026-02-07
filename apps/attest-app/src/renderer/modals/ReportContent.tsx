import NiceModal, { muiDialogV5, useModal } from '@ebay/nice-modal-react'
import { TextField, Button, Dialog, DialogContent, DialogActions, DialogTitle } from '@mui/material'
import { useTranslation } from 'react-i18next'
import * as atoms from '../stores/atoms'
import { useAtom } from 'jotai'
import { useState } from 'react'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import SimpleSelect from '@/components/SimpleSelect'
import * as toastActions from '@/stores/toastActions'
import * as remote from '@/packages/remote'

const ReportContent = NiceModal.create(({ contentId }: { contentId: string }) => {
  const modal = useModal()
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()

  const [content, setContent] = useState('')
  const [reportType, setReportType] = useState('Harmful or offensive content')

  const onClose = () => {
    modal.resolve()
    modal.hide()
  }

  const onSubmit = async () => {
    toastActions.add(t('Thank you for your report'))
    if (!contentId) {
      return
    }
    await remote.reportContent({
      id: contentId,
      type: reportType,
      details: content,
    })
    modal.resolve()
    modal.hide()
  }

  return (
    <Dialog
      {...muiDialogV5(modal)}
      onClose={() => {
        modal.resolve()
        modal.hide()
      }}
      fullWidth
    >
      <DialogTitle>{t('Report Content')}</DialogTitle>
      <DialogContent>
        <TextField
          label={t('Report Content ID')}
          className="w-full"
          autoFocus={!isSmallScreen}
          value={contentId}
          // onChange={(e) => setReportObject({ ...reportObject, id: e.target.value })}
          disabled
          margin="dense"
          type="text"
          fullWidth
          variant="outlined"
        />
        <SimpleSelect
          label={t('Report Type')}
          value={reportType}
          options={[
            { value: 'Harmful or offensive content', label: t('Harmful or offensive content') },
            { value: 'Misleading information', label: t('Misleading information') },
            { value: 'Spam or advertising', label: t('Spam or advertising') },
            { value: 'Violence or dangerous content', label: t('Violence or dangerous content') },
            { value: 'Child-inappropriate content', label: t('Child-inappropriate content') },
            { value: 'Sexual content', label: t('Sexual content') },
            { value: 'Hate speech or harassment', label: t('Hate speech or harassment') },
            { value: 'Other concerns', label: t('Other concerns') },
          ]}
          onChange={(value) => setReportType(value as string)}
          style={{ margin: '16px 0' }}
        />
        <TextField
          label={t('Details')}
          type="text"
          className="w-full"
          autoFocus={!isSmallScreen}
          multiline // multiline 需要和 maxRows 一起使用，否则长文本可能会导致退出编辑？
          minRows={2}
          maxRows={3}
          placeholder={t('Please describe the content you want to report (Optional)') || ''}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={onSubmit}>{t('submit')}</Button>
      </DialogActions>
    </Dialog>
  )
})

export default ReportContent
