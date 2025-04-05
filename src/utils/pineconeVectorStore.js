/**
 * Pinecone Vector Store Integration
 * This implementation uses Pinecone for vector storage and retrieval
 */

import { Pinecone } from "@pinecone-database/pinecone";
import { embedText } from "./embeddingService.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize Pinecone client
let pinecone;
let pineconeIndex = null;

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_ENV = process.env.PINECONE_ENV || "us-west1-gcp";

try {
  // Try initializing with the newer API style
  pinecone = new Pinecone({
    apiKey: PINECONE_API_KEY
  });
} catch (e) {
  console.error("Failed to initialize with new API style:", e);
  throw new Error("Failed to initialize Pinecone client: " + e.message);
}

function cleanMetadata(metadata) {
  const cleaned = {};
  for (const key in metadata) {
    if (metadata[key] !== null && metadata[key] !== undefined) {
      cleaned[key] = metadata[key];
    }
  }
  return cleaned;
}

/**
 * Initialize the Pinecone index
 * @param {string} indexName - Name of the Pinecone index to use
 * @returns {Object} The initialized Pinecone index
 */
export async function initPineconeVectorStore() {
  try {
    // Wait for pinecone to be initialized if it's using the dynamic import
    if (!pinecone) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      if (!pinecone) {
        throw new Error("Pinecone client not initialized after waiting");
      }
    }

    const indexName = process.env.PINECONE_INDEX;

    let indexes;
    try {
      // Handle different Pinecone SDK versions
      if (pinecone.listIndexes) {
        // New API style
        indexes = await pinecone.listIndexes();
      } else if (pinecone.listCollections) {
        // Alternative new API style
        indexes = await pinecone.listCollections();
      } else if (pinecone.listIndexes?.bind) {
        // Old API style
        const response = await pinecone.listIndexes();
        indexes = response.indexes || [];
      } else {
        console.error("Unknown Pinecone API structure:", pinecone);
        throw new Error("Unknown Pinecone API structure");
      }
    } catch (error) {
      console.error("Error listing indexes:", error);
      throw error;
    }

    // Handle different response structures
    let indexExists = false;
    if (Array.isArray(indexes)) {
      indexExists = indexes.some((idx) => idx.name === indexName);
    } else if (indexes && Array.isArray(indexes.indexes)) {
      indexExists = indexes.indexes.some((idx) => idx.name === indexName);
    } else if (indexes && Array.isArray(indexes.data)) {
      indexExists = indexes.data.some((idx) => idx.name === indexName);
    } else if (indexes && typeof indexes === "object") {
      // Try to find any array property that might contain the indexes
      for (const key in indexes) {
        if (Array.isArray(indexes[key])) {
          if (indexes[key].some((idx) => idx.name === indexName)) {
            indexExists = true;
            break;
          }
        }
      }
    } else {
      console.error("Unexpected indexes response format:", indexes);
      throw new Error("Unexpected indexes response format");
    }

    if (!indexExists) {
      // Create index with the appropriate API
      if (pinecone.createIndex) {
        // New API style
        await pinecone.createIndex({
          name: indexName,
          dimension: 1536,
          metric: "cosine",
          spec: {
            serverless: {
              cloud: "aws",
              region: "us-east-1"
            }
          }
        });
      } else {
        // Old API style
        await pinecone.createIndex({
          createRequest: {
            name: indexName,
            dimension: 1536,
            metric: "cosine",
            spec: {
              serverless: {
                cloud: "aws",
                region: "us-east-1"
              }
            }
          }
        });
      }

      // Wait for index to be ready
      let isReady = false;
      const maxRetries = 10;
      let retries = 0;

      while (!isReady && retries < maxRetries) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Check if index is ready using the appropriate API
          if (pinecone.describeIndex) {
            // New API style
            const indexDescription = await pinecone.describeIndex(indexName);
            isReady = indexDescription.status?.ready === true;
          } else {
            // Old API style
            const indexDescription = await pinecone.describeIndex({
              indexName
            });
            isReady = indexDescription.status?.ready === true;
          }

          retries++;
        } catch (error) {
          retries++;
        }
      }

      if (!isReady) {
        throw new Error(`Index ${indexName} not ready after max retries`);
      }
    }

    // Get the index using the appropriate API
    if (pinecone.Index) {
      // New API style
      pineconeIndex = pinecone.Index(indexName);
    } else {
      // Old API style
      pineconeIndex = pinecone.Index(indexName);
    }

    return pineconeIndex;
  } catch (error) {
    console.error("Error initializing Pinecone:", error);
    throw error;
  }
}

/**
 * Upserts a vector record to Pinecone
 * @param {string} id The ID of the record
 * @param {string} text The text to embed and store
 * @param {Object} metadata Additional metadata to store with the vector
 * @param {Array} historyData Optional array of history entries for enhanced search
 * @returns {Promise<Object>} Result of the upsert operation
 */
export async function upsertVectorRecord(
  id,
  text,
  metadata = {},
  historyData = []
) {
  try {
    // Make sure the index is initialized
    if (!pineconeIndex) {
      pineconeIndex = await initPineconeVectorStore();
    }

    // Prepare enhanced text with history if available
    let enhancedText = text;

    if (historyData && historyData.length > 0) {
      const historyText = historyData
        .map(
          (entry) => `HISTORY_ENTRY: ${entry.timestamp}
CATEGORY: ${entry.change_category}
IMPORTANCE: ${entry.change_type}
${entry.vector_searchable_text || entry.summary}`
        )
        .join("\n\n");

      enhancedText = `${text}\n\nHISTORY:\n${historyText}`;
    }

    // Generate embedding for the enhanced text
    const embedding = await embedText(enhancedText);

    // Include history metadata
    const historyMetadata = {};
    if (historyData && historyData.length > 0) {
      historyMetadata.has_history = true;
      historyMetadata.history_count = historyData.length;
      historyMetadata.latest_change = historyData[0]?.timestamp;
      historyMetadata.history_categories = [
        ...new Set(historyData.map((h) => h.change_category))
      ];

      // Get the most recent major change if any
      const majorChange = historyData.find((h) => h.change_type === "MAJOR");
      if (majorChange) {
        historyMetadata.latest_major_change = majorChange.timestamp;
        historyMetadata.latest_major_category = majorChange.change_category;
      }
    }

    // Prepare the vector with metadata
    const vector = {
      id: id.toString(),
      values: embedding,
      metadata: cleanMetadata({
        ...metadata,
        ...historyMetadata,
        text: enhancedText.slice(0, 1000),
        recordId: id.toString()
      })
    };

    // Upsert the vector to Pinecone
    const upsertResponse = await pineconeIndex.upsert([vector]);

    console.log(`Pinecone vector upload successful: id=${id}`);
    return upsertResponse;
  } catch (error) {
    console.error("Error upserting vector:", error);
    throw error;
  }
}

/**
 * Upsert multiple records in a batch
 * @param {Array} records - Array of {id, text, metadata} objects
 * @returns {Object} The result of the batch upsert operation
 */
export async function batchUpsertVectorRecords(records) {
  if (!pineconeIndex) {
    throw new Error(
      "Pinecone index not initialized. Call initPineconeVectorStore first."
    );
  }

  try {
    // Generate embeddings for all texts in parallel
    const embedPromises = records.map((record) => embedText(record.text));
    const embeddings = await Promise.all(embedPromises);

    // Prepare vectors with metadata
    const vectors = records.map((record, i) => ({
      id: record.id.toString(),
      values: embeddings[i],
      metadata: cleanMetadata({
        ...record.metadata,
        text: record.text.slice(0, 1000),
        recordId: record.id.toString()
      })
    }));

    // Upsert vectors to Pinecone
    const upsertResponse = await pineconeIndex.upsert(vectors);

    console.log(
      `Pinecone batch vector upload successful: count=${
        records.length
      }, ids=[${records.map((r) => r.id).join(", ")}]`
    );
    return upsertResponse;
  } catch (error) {
    console.error("Error batch upserting records to Pinecone:", error);
    throw error;
  }
}

/**
 * Searches for similar vectors in Pinecone
 * @param {string} query The query text to search for
 * @param {number} limit The maximum number of results to return
 * @param {number} minScore The minimum similarity score (0-1)
 * @returns {Promise<Array>} The search results
 */
export async function searchVectors(query, limit = 5, minScore = 0.7) {
  try {
    // Make sure the index is initialized
    if (!pineconeIndex) {
      pineconeIndex = await initPineconeVectorStore();
    }

    // Generate embedding for the query
    const embedding = await embedText(query);

    // Search for similar vectors using the appropriate API
    let response;
    if (pineconeIndex.query) {
      // New API style
      response = await pineconeIndex.query({
        vector: embedding,
        topK: limit,
        includeMetadata: true
      });
    } else {
      // Old API style
      response = await pineconeIndex.query({
        queryRequest: {
          vector: embedding,
          topK: limit,
          includeMetadata: true
        }
      });
    }

    // Process the response
    let matches = [];
    if (response.matches) {
      matches = response.matches;
    } else if (response.results && response.results.matches) {
      matches = response.results.matches;
    }

    // Filter by minimum score and map to result format
    const results = matches
      .filter((match) => match.score >= minScore)
      .map((match) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata,
        text: match.metadata.text
      }));

    return results;
  } catch (error) {
    console.error(`Error searching vectors: ${error.message}`);
    console.error(error);
    throw error;
  }
}

/**
 * Delete vectors from Pinecone
 * @param {Array} ids - Array of record IDs to delete
 * @returns {Object} The result of the delete operation
 */
export async function deleteVectorRecords(ids) {
  if (!pineconeIndex) {
    throw new Error(
      "Pinecone index not initialized. Call initPineconeVectorStore first."
    );
  }

  try {
    // Convert all IDs to strings
    const stringIds = ids.map((id) => id.toString());

    // Delete the vectors
    const deleteResponse = await pineconeIndex.delete({
      ids: stringIds
    });

    return deleteResponse;
  } catch (error) {
    console.error("Error deleting records from Pinecone:", error);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    throw error;
  }
}

/**
 * Get vector by ID
 * @param {string} id - The record ID to fetch
 * @returns {Object} The vector and its metadata
 */
export async function getVectorById(id) {
  if (!pineconeIndex) {
    throw new Error(
      "Pinecone index not initialized. Call initPineconeVectorStore first."
    );
  }

  try {
    // Fetch the vector
    const fetchResponse = await pineconeIndex.fetch([id.toString()]);

    if (fetchResponse.vectors[id.toString()]) {
      return fetchResponse.vectors[id.toString()];
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error fetching vector with ID ${id}:`, error);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    throw error;
  }
}
