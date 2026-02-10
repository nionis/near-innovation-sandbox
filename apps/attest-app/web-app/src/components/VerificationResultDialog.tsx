import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAttestationStore } from '@/stores/attestation-store'
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function VerificationResultDialog() {
  const { verificationDialog, closeVerificationDialog } = useAttestationStore()
  const { isOpen, verificationResult } = verificationDialog

  if (!verificationResult) return null

  const { result, chat, notorized, model_gpu, model_tdx, gateway_tdx } =
    verificationResult

  const checks = [
    {
      label: 'Chat Signature',
      valid: chat.valid,
      message: chat.message,
    },
    {
      label: 'Blockchain Record',
      valid: notorized.valid,
      message: notorized.message,
    },
    {
      label: 'Model GPU Attestation',
      valid: model_gpu.valid,
      message: model_gpu.message,
    },
    {
      label: 'Model TDX Attestation',
      valid: model_tdx.valid,
      message: model_tdx.message,
    },
    {
      label: 'Gateway TDX Attestation',
      valid: gateway_tdx.valid,
      message: gateway_tdx.message,
    },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={closeVerificationDialog}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {result.valid ? (
              <>
                <CheckCircle2 className="size-6 text-green-500" />
                Proof Verified Successfully
              </>
            ) : (
              <>
                <AlertCircle className="size-6 text-yellow-500" />
                Proof Verification Completed with Issues
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {result.valid
              ? 'All verification checks passed successfully.'
              : 'Some verification checks did not pass. See details below.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {checks.map((check, index) => (
            <div
              key={index}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border',
                check.valid
                  ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900/50'
                  : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50'
              )}
            >
              {check.valid ? (
                <CheckCircle2 className="size-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="size-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm font-medium',
                    check.valid
                      ? 'text-green-900 dark:text-green-100'
                      : 'text-red-900 dark:text-red-100'
                  )}
                >
                  {check.label}
                </p>
                {check.message && (
                  <p
                    className={cn(
                      'text-xs mt-1',
                      check.valid
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-red-700 dark:text-red-300'
                    )}
                  >
                    {check.message}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={closeVerificationDialog} className="w-full sm:w-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
