import fs from 'node:fs'
import { setTimeout } from 'node:timers/promises'
import { MDocument } from '@mastra/rag'
import { embedMany, type ModelMessage } from 'ai'
import { isEpubFilePath, isOfficeFilePath, isTextFilePath } from '../../shared/file-extensions'
import { rerank } from '../../shared/models/rerank'
import { sentry } from '../adapters/sentry'
import { parseFile } from '../file-parser'
import { getLogger } from '../util'
import { checkProcessingTimeouts, getDatabase, getVectorStore } from './db'
import { getEmbeddingProvider, getRerankProvider, getVisionProvider } from './model-providers'

const log = getLogger('knowledge-base:file-loaders')

// Parse file to MDocument based on file type
async function parseFileToDocument(
  filePath: string,
  fileMeta: { fileId: number; filename: string; mimeType: string },
  kbId: number
): Promise<MDocument> {
  if (isOfficeFilePath(filePath)) {
    const content = await parseFile(filePath)
    return MDocument.fromText(content)
  } else if (fileMeta.mimeType.startsWith('image/')) {
    const vision = await getVisionProvider(kbId)
    if (!vision) {
      throw new Error('visionModel not set')
    }

    const { model: visionModel } = vision

    // Save image content to dependent storage for later retrieval during chat message conversion
    const imageBase64 = fs.readFileSync(filePath, { encoding: 'base64' })
    const dataUrl = `data:${fileMeta.mimeType};base64,${imageBase64}`

    // Assemble chat message (with image)
    const msg: ModelMessage = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'OCR the following image into Markdown. Do not sorround your output with triple backticks.',
        },
        { type: 'image', image: dataUrl, mediaType: fileMeta.mimeType },
      ],
    }

    const chatResult = await visionModel.chat([msg], {})
    const text = chatResult.contentParts
      .filter((p) => p.type === 'text')
      .map((p: any) => p.text)
      .join('')

    return MDocument.fromMarkdown(text)
  } else if (isEpubFilePath(filePath)) {
    const content = await parseFile(filePath)
    return MDocument.fromText(content)
  } else if (isTextFilePath(filePath)) {
    const content = await parseFile(filePath)
    return new MDocument({
      docs: [{ text: content }],
      type: fileMeta.mimeType,
    })
  } else {
    throw new Error(`Unsupported file type: ${fileMeta.mimeType}`)
  }
}

// Use mastra to parse, chunk, embed, and store files, embeddingProvider parameter is required
export async function processFileWithMastra(
  filePath: string,
  fileMeta: { fileId: number; filename: string; mimeType: string },
  kbId: number
) {
  const startTime = Date.now()
  log.debug(`[FILE] Starting file processing: ${fileMeta.filename} (id=${fileMeta.fileId})`)

  try {
    const db = getDatabase()

    // Check current processing status and get processed chunk count
    const fileRecord = await db.execute('SELECT chunk_count, total_chunks, status FROM kb_file WHERE id = ?', [
      fileMeta.fileId,
    ])
    const currentChunkCount = (fileRecord.rows[0]?.chunk_count as number) || 0
    const currentTotalChunks = (fileRecord.rows[0]?.total_chunks as number) || 0

    // 1. Parse file to get all chunks
    const doc = await parseFileToDocument(filePath, fileMeta, kbId)

    // 2. Chunking
    const allChunks = await doc.chunk({
      strategy: 'recursive',
      size: 512,
      overlap: 50,
    })

    if (!allChunks || allChunks.length === 0) {
      // throw new Error('No chunks generated from document')
      await db.execute({
        sql: 'UPDATE kb_file SET chunk_count = 0, status = ? WHERE id = ?',
        args: ['done', fileMeta.fileId],
      })
      return
    }

    // Record total chunks if not already recorded
    if (currentTotalChunks === 0 || currentTotalChunks !== allChunks.length) {
      await db.execute({
        sql: 'UPDATE kb_file SET total_chunks = ? WHERE id = ?',
        args: [allChunks.length, fileMeta.fileId],
      })
      log.debug(`[FILE] Recorded total chunks: ${allChunks.length} for file ${fileMeta.fileId}`)
    }

    log.debug(`[FILE] Processing progress: ${currentChunkCount}/${allChunks.length} chunks already processed`)

    // 3. Check if processing is already complete
    if (currentChunkCount >= allChunks.length) {
      log.info(`[FILE] File already fully processed: ${fileMeta.filename} (id=${fileMeta.fileId})`)
      return
    }

    // 4. Get remaining chunks to process
    const remainingChunks = allChunks.slice(currentChunkCount)
    log.debug(`[FILE] Processing remaining ${remainingChunks.length} chunks from index ${currentChunkCount}`)

    // 5. If no remaining chunks, processing is complete
    if (remainingChunks.length === 0) {
      log.info(`[FILE] File processing already complete: ${fileMeta.filename} (id=${fileMeta.fileId})`)
      return
    }

    // 6. Process remaining chunks in batches
    const embeddingInstance = await getEmbeddingProvider(kbId)
    const vectorStore = getVectorStore()
    const indexName = `kb_${kbId}`
    const BATCH_SIZE = 50 // Process chunks in batches of 50

    // Ensure vector index exists by getting dimension from first remaining chunk
    const firstEmbedding = await embedMany({
      model: embeddingInstance,
      values: [`filename: ${fileMeta.filename}\nchunk:\n${remainingChunks[0].text}`],
    })
    await vectorStore.createIndex({ indexName, dimension: firstEmbedding.embeddings[0].length })

    for (let i = 0; i < remainingChunks.length; i += BATCH_SIZE) {
      // Check if file has been paused before processing each batch
      const statusCheck = await db.execute('SELECT status FROM kb_file WHERE id = ?', [fileMeta.fileId])
      const currentStatus = statusCheck.rows[0]?.status as string
      if (currentStatus === 'paused') {
        log.info(`[FILE] File processing paused by user: ${fileMeta.filename} (id=${fileMeta.fileId})`)
        return
      }

      const batchChunks = remainingChunks.slice(i, i + BATCH_SIZE)
      const batchTexts = batchChunks.map((chunk: any) => `filename: ${fileMeta.filename}\nchunk:\n${chunk.text}`)

      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(remainingChunks.length / BATCH_SIZE)
      log.debug(`[FILE] Processing batch ${batchNumber}/${totalBatches}, chunks: ${batchTexts.length}`)

      // Generate embeddings for this batch
      const embeddingResult = await embedMany({
        model: embeddingInstance,
        values: batchTexts,
      })

      if (!embeddingResult.embeddings || embeddingResult.embeddings.length !== batchTexts.length) {
        throw new Error(
          `Embedding batch failed: expected ${batchTexts.length}, got ${embeddingResult.embeddings?.length || 0}`
        )
      }

      // Store vectors for this batch
      log.debug(`[FILE] Storing batch ${batchNumber}/${totalBatches} to vector store`)
      await vectorStore.upsert({
        indexName,
        vectors: embeddingResult.embeddings,
        metadata: batchChunks.map((chunk: any, chunkIndex: number) => ({
          text: chunk.text,
          fileId: fileMeta.fileId,
          filename: fileMeta.filename,
          mimeType: fileMeta.mimeType,
          chunkIndex: currentChunkCount + i + chunkIndex, // Use absolute chunk index
        })),
      })

      // Update processed chunk count in database
      const newChunkCount = currentChunkCount + i + batchChunks.length
      await db.execute({
        sql: 'UPDATE kb_file SET chunk_count = ? WHERE id = ?',
        args: [newChunkCount, fileMeta.fileId],
      })

      log.debug(`[FILE] Updated chunk count to ${newChunkCount} for file ${fileMeta.fileId}`)

      // Small delay between batches to avoid overwhelming the API
      if (i + BATCH_SIZE < remainingChunks.length) {
        await setTimeout(100) // 100ms delay between batches
      }
    }

    const duration = Date.now() - startTime
    log.info(
      `[FILE] File processed successfully: ${fileMeta.filename} (id=${fileMeta.fileId}), total chunks: ${allChunks.length}, duration: ${duration}ms`
    )
    // Mark as done and clear processing timestamp
    await db.execute({
      sql: 'UPDATE kb_file SET status = ?, processing_started_at = NULL WHERE id = ?',
      args: ['done', fileMeta.fileId],
    })
  } catch (error: any) {
    const duration = Date.now() - startTime
    log.error(`[FILE] File processing failed after ${duration}ms: ${fileMeta.filename} (id=${fileMeta.fileId})`, error)

    // Determine the operation type based on error message for better debugging
    let operation = 'file_processing'
    if (error.message.includes('parse')) {
      operation = 'file_parsing'
    } else if (error.message.includes('chunk')) {
      operation = 'document_chunking'
    } else if (error.message.includes('embedding')) {
      operation = 'generate_embeddings'
    } else if (error.message.includes('store') || error.message.includes('vector')) {
      operation = 'vector_storage'
    } else if (error.message.includes('vision') || error.message.includes('OCR') || error.message.includes('image')) {
      operation = 'image_ocr_processing'
    }

    // Report processing failures to Sentry with unified context
    sentry.withScope((scope) => {
      scope.setTag('component', 'knowledge-base-file')
      scope.setTag('operation', operation)
      scope.setExtra('fileId', fileMeta.fileId)
      scope.setExtra('filename', fileMeta.filename)
      scope.setExtra('mimeType', fileMeta.mimeType)
      scope.setExtra('kbId', kbId)
      scope.setExtra('duration', duration)
      scope.setExtra('filePath', filePath)
      sentry.captureException(error)
    })

    throw error
  }
}

async function processPendingFiles() {
  try {
    // First check for timed out processing files
    await checkProcessingTimeouts()

    const db = getDatabase()
    // Query pending files (includes files that were interrupted and reset by cleanup)
    const rs = await db.execute('SELECT * FROM kb_file WHERE status = ?', ['pending'])

    if (rs.rows.length === 0) {
      return
    }

    log.debug(`[FILE] Processing ${rs.rows.length} pending files`)

    for (const file of rs.rows) {
      try {
        log.debug(`[FILE] Processing file: ${file.filename} (id=${file.id})`)

        // Mark as processing and record the processing start time
        await db.execute({
          sql: 'UPDATE kb_file SET status = ?, processing_started_at = CURRENT_TIMESTAMP WHERE id = ?',
          args: ['processing', file.id],
        })

        // Use mastra to parse, chunk, embed, and store (supports resuming from chunk_count)
        await processFileWithMastra(
          file.filepath as string,
          { fileId: file.id as number, filename: file.filename as string, mimeType: file.mime_type as string },
          file.kb_id as number
        )
      } catch (err: any) {
        log.error(`[FILE] File processing failed: ${file.filename} (id=${file.id})`, err)
        // Mark as failed
        await db.execute({
          sql: 'UPDATE kb_file SET status = ?, error = ?, processing_started_at = NULL WHERE id = ?',
          args: ['failed', String(err), file.id],
        })

        // Report individual file processing failures
        sentry.withScope((scope) => {
          scope.setTag('component', 'knowledge-base-file')
          scope.setTag('operation', 'individual_file_processing')
          scope.setExtra('fileId', file.id)
          scope.setExtra('filename', file.filename)
          scope.setExtra('kbId', file.kb_id)
          sentry.captureException(err)
        })
      }
    }
  } catch (error: any) {
    log.error('[FILE] Failed to process pending files:', error)
    sentry.withScope((scope) => {
      scope.setTag('component', 'knowledge-base-file')
      scope.setTag('operation', 'process_pending_files')
      sentry.captureException(error)
    })
  }
}

// Periodic polling
export async function startWorkerLoop() {
  log.info('[FILE] Starting worker loop')

  while (true) {
    try {
      await processPendingFiles()
    } catch (e: any) {
      log.error('[FILE] Worker loop error:', e)
      sentry.withScope((scope) => {
        scope.setTag('component', 'knowledge-base-file')
        scope.setTag('operation', 'worker_loop')
        sentry.captureException(e)
      })

      // Wait before retrying to prevent rapid error loops
      await setTimeout(10000) // 10 seconds
    }
    await setTimeout(3000) // Poll every 3 seconds
  }
}

// Search interface, embeddingProvider parameter is required
export async function searchKnowledgeBase(kbId: number, query: string) {
  try {
    log.debug(`[FILE] Searching knowledge base: kbId=${kbId}, query=${query}`)
    const embeddingInstance = await getEmbeddingProvider(kbId)
    const embedding = await embedMany({
      model: embeddingInstance,
      values: [query],
    })
    const vectorStore = getVectorStore()
    const indexName = `kb_${kbId}`
    const results = await vectorStore.query({
      indexName,
      queryVector: embedding.embeddings[0],
      topK: 20,
    })
    try {
      const rerankInstance = await getRerankProvider(kbId)
      if (rerankInstance) {
        const rerankedResults = await rerank(results, query, rerankInstance, {
          topK: 5,
        })
        return rerankedResults.map((r) => ({
          id: r.result.id,
          score: r.result.score,
          ...r.result.metadata,
        }))
      }
      return results.map((r) => ({
        id: r.id,
        score: r.score,
        ...r.metadata,
      }))
    } catch (e) {
      log.error(`[FILE] Failed to rerank: kbId=${kbId}, query=${query}`, e)
      sentry.withScope((scope) => {
        scope.setTag('component', 'knowledge-base-file')
        scope.setTag('operation', 'rerank')
        scope.setExtra('kbId', kbId)
        scope.setExtra('query', query)
        sentry.captureException(e)
      })
      return results.map((r) => ({
        id: r.id,
        score: r.score,
        ...r.metadata,
      }))
    }
  } catch (e) {
    log.error(`[FILE] Failed to search: kbId=${kbId}, query=${query}`, e)

    sentry.withScope((scope) => {
      scope.setTag('component', 'knowledge-base-file')
      scope.setTag('operation', 'search_knowledge_base')
      scope.setExtra('kbId', kbId)
      scope.setExtra('query', query)
      sentry.captureException(e)
    })

    // TODO: user friendly error message
    throw e
  }
}

// Read chunks from vector store
export async function readChunks(kbId: number, chunks: { fileId: number; chunkIndex: number }[]) {
  try {
    log.debug(`[FILE] Reading chunks: kbId=${kbId}, chunks=${chunks.length}`)

    if (!chunks || chunks.length === 0) {
      return []
    }

    const indexName = `kb_${kbId}`
    const results: any[] = []

    // Use single SQL query to get all chunks at once
    log.debug(`[FILE] Using single SQL query via vectorStore.turso for ${chunks.length} chunks`)

    const vectorStore = getVectorStore()
    // Build composite IN condition to avoid SQLite's 999 variable limit
    const valuePlaceholders = chunks.map(() => '(?,?)').join(',')
    const condition = `(json_extract(metadata, '$.fileId'), json_extract(metadata, '$.chunkIndex')) IN (${valuePlaceholders})`

    // Flatten chunk parameters for the query
    const args = chunks.flatMap((c) => [c.fileId, c.chunkIndex])

    const sql = `SELECT metadata FROM ${indexName} WHERE ${condition}`
    log.debug(`[FILE] Executing SQL: ${sql}`)
    log.debug(`[FILE] With args:`, args)

    const queryResult = await (vectorStore as any).turso.execute({
      sql,
      args,
    })

    log.debug(`[FILE] Single SQL query returned ${queryResult.rows.length} results`)

    // Parse results and maintain the order requested by chunks array
    const foundChunks = queryResult.rows.map((row: any) => {
      const metadata = JSON.parse(row.metadata as string)
      return {
        fileId: metadata.fileId,
        filename: metadata.filename,
        chunkIndex: metadata.chunkIndex,
        text: metadata.text,
      }
    })

    // Maintain the order of the requested chunks
    for (const chunk of chunks) {
      const found = foundChunks.find(
        (fc: any) => Number(fc.fileId) === Number(chunk.fileId) && Number(fc.chunkIndex) === Number(chunk.chunkIndex)
      )
      if (found) {
        results.push(found)
      }
    }

    return results
  } catch (sqlErr: any) {
    log.error(`[FILE] Single SQL query failed:`, sqlErr)
    sentry.withScope((scope) => {
      scope.setTag('component', 'knowledge-base-file')
      scope.setTag('operation', 'read_chunks')
      scope.setExtra('kbId', kbId)
      scope.setExtra('chunkCount', chunks.length)
      sentry.captureException(sqlErr)
    })
    throw sqlErr
  }
}
