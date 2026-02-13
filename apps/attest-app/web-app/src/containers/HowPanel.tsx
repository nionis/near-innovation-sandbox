import { Card } from '@/components/ui/card'
import { IconUser, IconSearch, IconQrcode, IconFileText } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

export function HowPanel() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">How to Use This App</h1>
          <p className="text-muted-foreground">
            Learn how to create and verify attested AI conversations
          </p>
        </div>

        {/* Creator Section */}
        <Card className="p-6 border-2 border-primary/20">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <IconUser className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-xl font-semibold mb-2">As a Creator</h2>
                <p className="text-sm text-muted-foreground">
                  Example: Lawyer, consultant, or any professional creating verified AI content
                </p>
              </div>

              <div className="space-y-4">
                <Step number={1} title="Chat with the LLM">
                  Use the chat interface to have a conversation with the AI assistant.
                  Ask questions, get insights, and refine your discussion until you're
                  satisfied with the results.
                </Step>

                <Step number={2} title="Verify & Generate Proofs">
                  Once you finish your conversation, switch to the "Verify & Share" tab.
                  Click the "Generate All Proofs" button to create cryptographic proofs
                  for your conversation.
                </Step>

                <Step number={3} title="Share Your Work">
                  After generating proofs, click "Share" to get a unique link and QR code.
                  Attach the QR code to your document (e.g., legal brief, report) so others
                  can verify the authenticity of your AI-generated content.
                </Step>

                <Step
                  number={4}
                  title="Reference Specific Parts (Optional)"
                  icon={<IconFileText className="w-4 h-4" />}
                >
                  Need to reference specific portions of the AI output in your document?
                  Use the reference functionality to create individual QR codes for selected
                  parts of the conversation. Each reference can be independently verified.
                </Step>
              </div>

              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <IconQrcode className="w-4 h-4" />
                  What to Attach to Your Document
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Main conversation QR code (from "Share" button)</li>
                  <li>Individual reference QR codes (if you created specific references)</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>

        {/* Reviewer Section */}
        <Card className="p-6 border-2 border-blue-500/20">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <IconSearch className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-xl font-semibold mb-2">As a Reviewer</h2>
                <p className="text-sm text-muted-foreground">
                  Verify the authenticity of AI-generated content you receive
                </p>
              </div>

              <div className="space-y-4">
                <Step number={1} title="Receive Shared Content">
                  The creator will send you either a shared link or a document containing
                  QR codes. The document may have multiple QR codes if the creator referenced
                  specific parts of the conversation.
                </Step>

                <Step
                  number={2}
                  title="Import the Main Conversation"
                  icon={<IconQrcode className="w-4 h-4" />}
                >
                  Click the "Scan QR Code" button in the Verify & Share panel. Use your
                  device's camera to scan the main conversation QR code, or paste the
                  shared link directly. This loads the full conversation into the app.
                </Step>

                <Step number={3} title="Import Additional References (If Any)">
                  If the document contains additional reference QR codes, scan each one
                  using the same "Scan QR Code" button. These will be imported as
                  separate references linked to specific parts of the conversation.
                </Step>

                <Step number={4} title="Verify the Conversation">
                  Click the "Verify All" button to cryptographically verify that:
                  <ul className="mt-2 space-y-1 list-disc list-inside text-muted-foreground">
                    <li>The conversation hasn't been tampered with</li>
                    <li>The cryptographic signatures are valid</li>
                    <li>The attestation proofs match the expected format</li>
                  </ul>
                </Step>
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <IconSearch className="w-4 h-4 text-blue-500" />
                  What You're Verifying
                </h3>
                <p className="text-sm text-muted-foreground">
                  The verification process ensures that the AI conversation you're reviewing
                  is authentic, unmodified, and can be trusted. Green checkmarks indicate
                  successful verification of each cryptographic proof.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Tips */}
        <Card className="p-6 bg-linear-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            💡 Quick Tips
          </h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-amber-600 dark:text-amber-400 font-bold">•</span>
              <span>
                <strong>Save your work:</strong> Always generate proofs before closing
                your conversation to ensure it can be verified later.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 dark:text-amber-400 font-bold">•</span>
              <span>
                <strong>Multiple references:</strong> You can create as many reference
                QR codes as needed for different sections of your conversation.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 dark:text-amber-400 font-bold">•</span>
              <span>
                <strong>Offline verification:</strong> Once you have the shared link or
                QR code, verification can happen anytime, even if the original conversation
                is no longer accessible.
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}

interface StepProps {
  number: number
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}

function Step({ number, title, icon, children }: StepProps) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
        {number}
      </div>
      <div className="flex-1 space-y-1">
        <h3 className="font-medium flex items-center gap-2">
          {title}
          {icon}
        </h3>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}
