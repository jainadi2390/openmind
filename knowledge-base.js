/**
 * Knowledge Base RAG System
 * Handles document upload, embedding generation, vector storage, and retrieval
 * @module knowledge-base
 */

const fs = require('fs');
const path = require('path');

/**
 * Knowledge Base Manager
 * Manages document embeddings and retrieval for RAG
 */
class KnowledgeBase {
  constructor() {
    this.documents = [];
    this.embeddings = [];
    this.chunks = [];
    this.chunkSize = 500; // characters per chunk
    this.chunkOverlap = 100; // overlap between chunks
    this.rateLimitCooldownUntil = null; // Timestamp until which RAG is disabled due to rate limits
  }

  /**
   * Add document to knowledge base
   * @param {string} filename - Name of the file
   * @param {string} content - Text content of the document
   * @param {string} apiKey - Gemini API key for embeddings
   * @returns {Promise<void>}
   */
  async addDocument(filename, content, apiKey) {
    console.log(`[KB] Adding document: ${filename}`);

    // Chunk the document
    const documentChunks = this.chunkText(content);

    // Generate embeddings for each chunk with small delays to avoid rate limits
    for (let i = 0; i < documentChunks.length; i++) {
      const chunk = documentChunks[i];

      // Add small delay between chunks to avoid rate limits (except for first chunk)
      if (i > 0) {
        await this.sleep(500); // 500ms delay between chunks
      }

      const embedding = await this.generateEmbedding(chunk, apiKey);

      this.chunks.push({
        filename,
        chunkIndex: i,
        text: chunk,
        embedding
      });

      console.log(`[KB] Processed chunk ${i + 1}/${documentChunks.length}`);
    }

    // Store document metadata
    this.documents.push({
      filename,
      content,
      chunkCount: documentChunks.length,
      addedAt: new Date().toISOString()
    });

    console.log(`[KB] Added ${documentChunks.length} chunks from ${filename}`);
  }

  /**
   * Chunk text into smaller pieces with overlap
   * @param {string} text - Text to chunk
   * @returns {string[]} Array of text chunks
   */
  chunkText(text) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length);
      const chunk = text.slice(start, end);
      chunks.push(chunk.trim());
      start += this.chunkSize - this.chunkOverlap;
    }

    return chunks.filter(chunk => chunk.length > 50); // Filter out very small chunks
  }

  /**
   * Generate embedding using Gemini API with retry logic
   * @param {string} text - Text to embed
   * @param {string} apiKey - Gemini API key
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<number[]>} Embedding vector
   */
  async generateEmbedding(text, apiKey, maxRetries = 3) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'models/text-embedding-004',
            content: {
              parts: [{
                text: text
              }]
            }
          })
        });

        if (!response.ok) {
          const error = await response.json();

          // Handle rate limit errors with exponential backoff
          if (response.status === 429 && attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
            console.warn(`[KB] Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
            await this.sleep(delay);
            continue;
          }

          throw new Error(`Embedding API error (${response.status}): ${error.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        return data.embedding.values;
      } catch (error) {
        // If it's the last attempt or not a rate limit error, throw
        if (attempt === maxRetries || error.message.includes('fetch')) {
          throw error;
        }

        // Otherwise retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.warn(`[KB] Error generating embedding, retrying in ${delay}ms:`, error.message);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Sleep utility for delays
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {number[]} a - First vector
   * @param {number[]} b - Second vector
   * @returns {number} Similarity score (0-1)
   */
  cosineSimilarity(a, b) {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Retrieve most relevant chunks for a query
   * @param {string} query - User's question
   * @param {string} apiKey - Gemini API key
   * @param {number} topK - Number of chunks to retrieve
   * @returns {Promise<Array>} Most relevant chunks
   */
  async retrieve(query, apiKey, topK = 3) {
    if (this.chunks.length === 0) {
      return [];
    }

    // Check if we're in cooldown period due to rate limits
    if (this.rateLimitCooldownUntil && Date.now() < this.rateLimitCooldownUntil) {
      const remainingSeconds = Math.ceil((this.rateLimitCooldownUntil - Date.now()) / 1000);
      console.warn(`[KB] RAG in cooldown mode for ${remainingSeconds}s due to rate limits`);
      return []; // Return empty results during cooldown
    }

    console.log(`[KB] Retrieving for query: ${query.substring(0, 50)}...`);

    try {
      // Generate embedding for query (use 1 retry for fast failure during chat)
      const queryEmbedding = await this.generateEmbedding(query, apiKey, 1);

      // Clear cooldown if successful
      this.rateLimitCooldownUntil = null;

      // Calculate similarity with all chunks
      const similarities = this.chunks.map((chunk, index) => ({
        index,
        chunk,
        similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding)
      }));

      // Sort by similarity and get top K
      similarities.sort((a, b) => b.similarity - a.similarity);
      const topChunks = similarities.slice(0, topK);

      console.log(`[KB] Top ${topK} chunks retrieved with similarities:`,
        topChunks.map(c => c.similarity.toFixed(3)));

      return topChunks.map(item => ({
        text: item.chunk.text,
        filename: item.chunk.filename,
        similarity: item.similarity
      }));
    } catch (error) {
      // If rate limit error, enable cooldown for 60 seconds
      if (error.message.includes('429') || error.message.includes('Rate limit')) {
        this.rateLimitCooldownUntil = Date.now() + 60000; // 60 seconds cooldown
        console.warn('[KB] Rate limit hit, enabling 60s cooldown for RAG retrieval');
      }
      throw error; // Re-throw to be caught by chatbox handler
    }
  }

  /**
   * Get knowledge base statistics
   * @returns {Object} Statistics about the knowledge base
   */
  getStats() {
    return {
      documentCount: this.documents.length,
      chunkCount: this.chunks.length,
      documents: this.documents.map(doc => ({
        filename: doc.filename,
        chunkCount: doc.chunkCount,
        addedAt: doc.addedAt
      }))
    };
  }

  /**
   * Clear all documents and embeddings
   */
  clear() {
    this.documents = [];
    this.embeddings = [];
    this.chunks = [];
    console.log('[KB] Knowledge base cleared');
  }

  /**
   * Serialize knowledge base to JSON
   * @returns {string} JSON string
   */
  serialize() {
    return JSON.stringify({
      documents: this.documents,
      chunks: this.chunks,
      metadata: {
        chunkSize: this.chunkSize,
        chunkOverlap: this.chunkOverlap,
        createdAt: new Date().toISOString()
      }
    });
  }

  /**
   * Deserialize knowledge base from JSON
   * @param {string} json - JSON string
   */
  deserialize(json) {
    try {
      const data = JSON.parse(json);
      this.documents = data.documents || [];
      this.chunks = data.chunks || [];

      if (data.metadata) {
        this.chunkSize = data.metadata.chunkSize || 500;
        this.chunkOverlap = data.metadata.chunkOverlap || 100;
      }

      console.log(`[KB] Loaded ${this.documents.length} documents, ${this.chunks.length} chunks`);
    } catch (error) {
      console.error('[KB] Error deserializing knowledge base:', error);
      throw error;
    }
  }
}

module.exports = { KnowledgeBase };
