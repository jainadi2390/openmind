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

    // Generate embeddings for each chunk
    for (let i = 0; i < documentChunks.length; i++) {
      const chunk = documentChunks[i];
      const embedding = await this.generateEmbedding(chunk, apiKey);

      this.chunks.push({
        filename,
        chunkIndex: i,
        text: chunk,
        embedding
      });
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
   * Generate embedding using Gemini API
   * @param {string} text - Text to embed
   * @param {string} apiKey - Gemini API key
   * @returns {Promise<number[]>} Embedding vector
   */
  async generateEmbedding(text, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;

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
      throw new Error(`Embedding API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.embedding.values;
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

    console.log(`[KB] Retrieving for query: ${query.substring(0, 50)}...`);

    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(query, apiKey);

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
