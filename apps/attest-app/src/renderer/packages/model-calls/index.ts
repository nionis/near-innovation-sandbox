import type { ModelInterface } from 'src/shared/models/types'
import type { Message } from 'src/shared/types'
import { convertToModelMessages } from './message-utils'

export { generateImage } from './generate-image'
export { streamText } from './stream-text'

export async function generateText(model: ModelInterface, messages: Message[]) {
  return model.chat(await convertToModelMessages(messages), {})
}
