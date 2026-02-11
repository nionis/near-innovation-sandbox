import { useRef } from 'react'
import type { ReferenceMetadata } from '@/stores/attestation-store'
import { Button } from '@/components/ui/button'
import { QRCodeSVG } from 'qrcode.react'
import { Download, Trash } from 'lucide-react'

interface ReferenceQRProps {
  reference: ReferenceMetadata
  onDownload?: () => void
  onDelete?: () => void
}

export function ReferenceQR({
  reference,
  onDownload,
  onDelete,
}: ReferenceQRProps) {
  const qrRef = useRef<HTMLDivElement>(null)
  const qrValue = `${reference.shareId}:${reference.messageIndex}:${reference.startChar}-${reference.endChar}`

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
      <div ref={qrRef} className="shrink-0 bg-white p-2 rounded">
        <QRCodeSVG value={qrValue} size={80} level="M" includeMargin={false} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-1">
          Message #{reference.messageIndex}, chars {reference.startChar}-
          {reference.endChar}
        </p>
        <p className="text-xs wrap-break-word">{reference.previewText}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        {onDownload && (
          <Button
            size="sm"
            variant="outline"
            onClick={onDownload}
            title="Download QR Code"
          >
            <Download className="size-4" />
          </Button>
        )}
        {onDelete && (
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            title="Delete Reference"
          >
            <Trash className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
