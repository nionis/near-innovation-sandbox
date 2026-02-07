import NiceModal, { muiDialogV5, useModal } from '@ebay/nice-modal-react'
import { Dialog, DialogContent, DialogActions, Button, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import platform from '@/platform'
import StarIcon from '@mui/icons-material/Star'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'
import { recordAppStoreRatingClick } from '@/packages/apple_app_store'

const AppStoreRating = NiceModal.create(() => {
  const { t } = useTranslation()
  const modal = useModal()

  const handleRateNow = async () => {
    const appStoreUrl = 'itms-apps://itunes.apple.com/app/id6471368056?action=write-review'
    try {
      platform.openLink(appStoreUrl)
    } catch (error) {
      console.error('Failed to open App Store:', error)
    }
    modal.resolve()
    modal.hide()
    await recordAppStoreRatingClick()
  }
  const onClose = () => {
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
      PaperProps={{
        sx: {
          maxWidth: '400px',
          borderRadius: 2,
          background: 'linear-gradient(to bottom, #ffffff, #f8f9fa)',
        },
      }}
    >
      <DialogContent sx={{ textAlign: 'center', py: 4, px: 4 }}>
        <ThumbUpIcon
          sx={{
            fontSize: 64,
            color: '#4CAF50',
            mb: 2.5,
            filter: 'drop-shadow(0px 4px 8px rgba(76, 175, 80, 0.25))',
            animation: 'pulse 2s infinite',
            '@keyframes pulse': {
              '0%': { transform: 'scale(1)' },
              '50%': { transform: 'scale(1.05)' },
              '100%': { transform: 'scale(1)' },
            },
          }}
        />
        <Typography
          variant="h5"
          gutterBottom
          sx={{
            fontWeight: 600,
            mb: 2,
          }}
        >
          {t('Enjoying Chatbox?')}
        </Typography>
        <Typography
          color="text.secondary"
          sx={{
            mb: 1.5,
            fontSize: '1.1rem',
            lineHeight: 1.5,
          }}
        >
          {t('Your rating on the App Store would help make Chatbox even better!')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('It only takes a few seconds and helps a lot.')}
        </Typography>
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          pb: 3,
          justifyContent: 'center',
          gap: 1.5,
        }}
      >
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            borderColor: 'rgba(0, 0, 0, 0.12)',
            color: 'text.secondary',
            '&:hover': {
              borderColor: 'rgba(0, 0, 0, 0.24)',
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
            },
          }}
        >
          {t('Maybe Later')}
        </Button>
        <Button
          onClick={handleRateNow}
          variant="contained"
          color="primary"
          endIcon={<StarIcon sx={{ color: '#FFD700' }} />}
          sx={{
            fontWeight: 600,
            background: 'linear-gradient(45deg, #4CAF50 30%, #66BB6A 90%)',
            boxShadow: '0 3px 10px rgba(76, 175, 80, 0.3)',
            '&:hover': {
              background: 'linear-gradient(45deg, #43A047 30%, #5CB860 90%)',
              boxShadow: '0 4px 12px rgba(76, 175, 80, 0.4)',
            },
          }}
        >
          {t('Rate Now')}
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default AppStoreRating
