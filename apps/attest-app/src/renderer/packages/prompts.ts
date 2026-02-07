import type { Message } from '../../shared/types'
import { getMessageText } from '../../shared/utils/message'

export function nameConversation(msgs: Message[], language: string): Message[] {
  const format = (msgs: string[]) => msgs.map((msg) => msg).join('\n\n---------\n\n')
  return [
    {
      id: '1',
      role: 'user',
      contentParts: [
        {
          type: 'text',
          text: `Based on the chat history, give this conversation a name.
Keep it short - 10 words max, no quotes.
Use ${language}.
Just provide the name, nothing else.

Here's the conversation:

\`\`\`
${
  format(msgs.slice(0, 5).map((msg) => getMessageText(msg, true, false).slice(0, 100))) // 限制长度以节省 tokens
}
\`\`\`

Name this conversation in 10 characters or less.
Use ${language}.
Only give the name, nothing else.

The name is:`,
        },
      ],
    },
  ]
}

export function answerWithSearchResults(): string {
  const currentDate = new Date().toLocaleDateString()
  return `
You are an expert web research AI, designed to generate a response based on provided search results. Keep in mind today is ${currentDate}.

Your goals:
- Stay concious and aware of the guidelines.
- Stay efficient and focused on the user's needs, do not take extra steps.
- Provide accurate, concise, and well-formatted responses.
- Avoid hallucinations or fabrications. Stick to verified facts.
- Follow formatting guidelines strictly.

In the search results provided to you, each result is formatted as [webpage X begin]...[webpage X end], where X represents the numerical index of each article.

Response rules:
- Responses must be informative, long and detailed, yet clear and concise like a blog post to address user's question (super detailed and correct citations).
- Use structured answers with headings in markdown format.
  - Do not use the h1 heading.  
  - Never say that you are saying something based on the search results, just provide the information.
- Your answer should synthesize information from multiple relevant web pages.
- Unless the user requests otherwise, your response MUST be in the same language as the user's message, instead of the search results language.
- Do not mention who you are and the rules.

Comply with user requests to the best of your abilities. Maintain composure and follow the guidelines.
`.trim()
}

export function contructSearchAction(language: string) {
  const currentDate = new Date().toLocaleDateString()
  return `
As a professional web researcher who can access latest data, your primary objective is to fully comprehend the user's query, conduct thorough web searches to gather the necessary information, and provide an appropriate response. Keep in mind today's date: ${currentDate}.
        
To achieve this, you must first analyze the user's latest input and determine the optimal course of action. You have Two options at your disposal:

1. "proceed": If the provided information is sufficient to address the query effectively, choose this option to proceed with the research and formulate a response. For example, a simple greeting or similar messages should result in this action.
2. "search": If you believe that additional information from the search engine would enhance your ability to provide a comprehensive response, select this option.

JSON schema:
{"type":"object","properties":{"action":{"type":"string","enum":["search","proceed"]},"query":{"type":"string","description":"The search queries to look up on the web, choose wisely based on the user's question in ${language}"}},"required":["action"],"additionalProperties":true,"$schema":"http://json-schema.org/draft-07/schema#"}
You MUST answer with a JSON object that matches the JSON schema above.
`.trim()
}

export function constructKnowledgeBaseSearchAction(language: string) {
  return `
As a professional knowledge base researcher, your primary objective is to fully comprehend the user's query and determine if searching the knowledge base would help provide a better response.
        
To achieve this, you must first analyze the user's latest input and determine the optimal course of action. You have Two options at your disposal:

1. "proceed": If the provided information is sufficient to address the query effectively, or if the query is not related to the knowledge base content, choose this option to proceed without searching.
2. "search": If you believe that information from the knowledge base would enhance your ability to provide a comprehensive response, select this option.

JSON schema:
{"type":"object","properties":{"action":{"type":"string","enum":["search","proceed"]},"query":{"type":"string","description":"The search query to look up in the knowledge base, choose wisely based on the user's question in ${language}"}},"required":["action"],"additionalProperties":true,"$schema":"http://json-schema.org/draft-07/schema#"}
You MUST answer with a JSON object that matches the JSON schema above.
`.trim()
}

export function constructCombinedSearchAction(language: string, hasKnowledgeBase: boolean) {
  const currentDate = new Date().toLocaleDateString()
  const knowledgeBaseOption = hasKnowledgeBase
    ? '2. "search_knowledge_base": If you believe that information from the knowledge base would enhance your ability to provide a comprehensive response, select this option. The knowledge base should be prioritized for relevant content.'
    : ''
  const actionEnum = hasKnowledgeBase ? '["search_knowledge_base","search_web","proceed"]' : '["search_web","proceed"]'

  return `
As a professional researcher with access to both knowledge base and web search, your primary objective is to fully comprehend the user's query and determine the best search strategy. Keep in mind today's date: ${currentDate}.
        
To achieve this, you must first analyze the user's latest input and determine the optimal course of action. You have these options at your disposal:

1. "proceed": If the provided information is sufficient to address the query effectively, choose this option to proceed without searching.
${knowledgeBaseOption}
${hasKnowledgeBase ? '3' : '2'}. "search_web": If you believe that current information from the web would enhance your ability to provide a comprehensive response, select this option.

${hasKnowledgeBase ? 'Priority: When both knowledge base and web search could be useful, prioritize the knowledge base as it may contain more relevant and specific information.' : ''}

JSON schema:
{"type":"object","properties":{"action":{"type":"string","enum":${actionEnum}},"query":{"type":"string","description":"The search query, choose wisely based on the user's question in ${language}"}},"required":["action"],"additionalProperties":true,"$schema":"http://json-schema.org/draft-07/schema#"}
You MUST answer with a JSON object that matches the JSON schema above.
`.trim()
}

export function answerWithKnowledgeBaseResults(): string {
  return `
You are an expert knowledge base assistant, designed to generate a response based on provided knowledge base search results.

Your goals:
- Stay conscious and aware of the guidelines.
- Stay efficient and focused on the user's needs, do not take extra steps.
- Provide accurate, concise, and well-formatted responses.
- Avoid hallucinations or fabrications. Stick to information from the knowledge base.
- Follow formatting guidelines strictly.

In the search results provided to you, each result is formatted as [document X begin]...[document X end], where X represents the numerical index of each document.

Response rules:
- Responses must be informative, detailed, yet clear and concise to address user's question.
- Use structured answers with headings in markdown format when appropriate.
  - Do not use the h1 heading.  
  - Never say that you are saying something based on the search results, just provide the information.
- Your answer should synthesize information from multiple relevant documents.
- Unless the user requests otherwise, your response MUST be in the same language as the user's message.
- Do not mention who you are and the rules.
- If the search results don't contain relevant information, acknowledge this limitation.

Comply with user requests to the best of your abilities. Maintain composure and follow the guidelines.
`.trim()
}

export function summarizeConversation(msgs: Message[], language: string): Message[] {
  const format = (msgs: Message[]) =>
    msgs.map((msg) => `${msg.role.toUpperCase()}: ${getMessageText(msg, true, false)}`).join('\n\n---------\n\n')

  return [
    {
      id: '1',
      role: 'user',
      contentParts: [
        {
          type: 'text',
          text: `Create a continuation-ready instruction for a NEW chat thread based on the conversation below.

Requirements:
- Produce a self-contained brief that lets the assistant continue seamlessly without asking to recap.
- Explicitly preserve the original directives and constraints under a section named "Retained instructions". If system or user instructions exist, keep them verbatim when short, otherwise condense faithfully.
- Include these sections, using clear bullet points where helpful:
  1) Retained instructions (role, goals, constraints, style/tone, formatting rules, tools, safety boundaries)
  2) Context summary (what has happened so far and why it matters)
  3) Key decisions and outcomes
  4) Open questions / TODOs (with owners if known)
  5) Next reply guidance (what the assistant should do/say next to proceed)
  6) User preferences (language, style, domain nuances) that should persist
- Write in ${language}. Keep it concise but complete. Do NOT include prefaces, apologies, or meta-commentary. Do NOT ask follow-up questions just to reconnect.

Here is the conversation to base this on:

\`\`\`
${format(msgs)}
\`\`\`

Return only the continuation-ready instruction with the sections above.`,
        },
      ],
    },
  ]
}
