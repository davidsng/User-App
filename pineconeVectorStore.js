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
console.log("PINECONE_API_KEY available:", !!PINECONE_API_KEY);
console.log("PINECONE_ENV:", PINECONE_ENV);

try {
  // Try initializing with the newer API style
  pinecone = new Pinecone({
    apiKey: PINECONE_API_KEY
  });
  console.log("Initialized Pinecone with new API style");
} catch (e) {
  console.error("Failed to initialize with new API style:", e);
  throw new Error("Failed to initialize Pinecone client: " + e.message);
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
      console.log("Waiting for Pinecone client to initialize...");
      await new Promise((resolve) => setTimeout(resolve, 3000));
      if (!pinecone) {
        throw new Error("Pinecone client not initialized after waiting");
      }
    }

    const indexName = process.env.PINECONE_INDEX;

    console.log(`Checking if index ${indexName} exists...`);

    let indexes;
    try {
      // Handle different Pinecone SDK versions
      if (pinecone.listIndexes) {
        // New API style
        indexes = await pinecone.listIndexes();
        console.log(
          "List indexes response (new API):",
          JSON.stringify(indexes, null, 2)
        );
      } else if (pinecone.listCollections) {
        // Alternative new API style
        indexes = await pinecone.listCollections();
        console.log(
          "List collections response:",
          JSON.stringify(indexes, null, 2)
        );
      } else if (pinecone.listIndexes?.bind) {
        // Old API style
        const response = await pinecone.listIndexes();
        indexes = response.indexes || [];
        console.log(
          "List indexes response (old API):",
          JSON.stringify(response, null, 2)
        );
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
      console.log("Indexes is an array");
      indexExists = indexes.some((idx) => idx.name === indexName);
    } else if (indexes && Array.isArray(indexes.indexes)) {
      console.log("Indexes has indexes array property");
      indexExists = indexes.indexes.some((idx) => idx.name === indexName);
    } else if (indexes && Array.isArray(indexes.data)) {
      console.log("Indexes has data array property");
      indexExists = indexes.data.some((idx) => idx.name === indexName);
    } else if (indexes && typeof indexes === "object") {
      console.log("Indexes is an object, keys:", Object.keys(indexes));
      // Try to find any array property that might contain the indexes
      for (const key in indexes) {
        if (Array.isArray(indexes[key])) {
          console.log(`Found array in property ${key}, checking for index...`);
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
      console.log(`Creating index ${indexName}...`);

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
      console.log("Waiting for index to be ready...");
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
          console.log(
            `Index ready check (${retries}/${maxRetries}): ${isReady}`
          );
        } catch (error) {
          console.error(
            `Error checking if index is ready (retry ${retries}/${maxRetries}):`,
            error
          );
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

    console.log(`Successfully initialized Pinecone index: ${indexName}`);
    return pineconeIndex;
  } catch (error) {
    console.error("Error initializing Pinecone:", error);
    throw error;
  }
}

/**
 * Upserts a vector record to Pinecone
 * @param {string} id The unique ID for the vector
 * @param {string} text The text to embed and store
 * @param {Object} metadata Additional metadata to store with the vector
 * @returns {Promise<Object>} Result of the upsert operation
 */
export async function upsertVectorRecord(id, text, metadata = {}) {
  try {
    console.log(`Upserting vector record with ID: ${id}`);

    // Make sure the index is initialized
    if (!pineconeIndex) {
      console.log("Pinecone index not initialized, initializing now...");
      pineconeIndex = await initPineconeVectorStore();
    }

    // Generate embedding for the text
    console.log(
      `Generating embedding for text: "${text.substring(0, 50)}${
        text.length > 50 ? "..." : ""
      }"`
    );
    const embedding = await embedText(text);
    console.log(`Generated embedding with length: ${embedding.length}`);

    // Prepare the vector with metadata
    const vector = {
      id: id.toString(),
      values: embedding,
      metadata: {
        ...metadata,
        text: text.slice(0, 1000), // Store the first 1000 chars of text in metadata for reference
        recordId: id.toString()
      }
    };

    // Upsert the vector to Pinecone
    console.log("Upserting vector to Pinecone...");
    let upsertResponse;

    // Handle different API styles
    if (typeof pineconeIndex.upsert === "function") {
      // New API style
      if (pineconeIndex.upsert.length === 1) {
        // Newer API expects array directly
        upsertResponse = await pineconeIndex.upsert([vector]);
      } else {
        // Slightly older API expects vectors in an object
        upsertResponse = await pineconeIndex.upsert({
          vectors: [vector]
        });
      }
    } else {
      // Old API style
      upsertResponse = await pineconeIndex.upsert({
        upsertRequest: {
          vectors: [vector]
        }
      });
    }

    console.log("Vector upserted successfully:", upsertResponse);
    return upsertResponse;
  } catch (error) {
    console.error(`Error upserting record ${id} to Pinecone:`, error);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
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
    console.log(`Batch upserting ${records.length} records to Pinecone...`);

    // Generate embeddings for all texts in parallel
    console.log("Generating embeddings for all records...");
    const embedPromises = records.map((record) => embedText(record.text));
    const embeddings = await Promise.all(embedPromises);
    console.log(`Generated ${embeddings.length} embeddings successfully.`);

    // Prepare vectors with metadata
    const vectors = records.map((record, i) => ({
      id: record.id.toString(),
      values: embeddings[i],
      metadata: {
        ...record.metadata,
        text: record.text.slice(0, 1000), // Store the first 1000 chars of text in metadata
        recordId: record.id.toString()
      }
    }));

    // Upsert vectors to Pinecone
    console.log("Upserting vectors to Pinecone...");
    let upsertResponse;

    // Handle different API styles
    if (typeof pineconeIndex.upsert === "function") {
      // New API style
      if (pineconeIndex.upsert.length === 1) {
        // Newer API expects array directly
        upsertResponse = await pineconeIndex.upsert(vectors);
      } else {
        // Slightly older API expects vectors in an object
        upsertResponse = await pineconeIndex.upsert({
          vectors: vectors
        });
      }
    } else {
      // Old API style
      upsertResponse = await pineconeIndex.upsert({
        upsertRequest: {
          vectors: vectors
        }
      });
    }

    console.log("Vectors batch upserted successfully:", upsertResponse);
    return upsertResponse;
  } catch (error) {
    console.error("Error batch upserting records to Pinecone:", error);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
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
    console.log(
      `Searching for vectors similar to: "${query.substring(0, 50)}${
        query.length > 50 ? "..." : ""
      }"`
    );

    // Make sure the index is initialized
    if (!pineconeIndex) {
      console.log("Pinecone index not initialized, initializing now...");
      pineconeIndex = await initPineconeVectorStore();
    }

    // Generate embedding for the query
    console.log("Generating embedding for query...");
    const embedding = await embedText(query);
    console.log(`Generated embedding with length: ${embedding.length}`);

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

    console.log(`Found ${matches.length} matches`);

    // Filter by minimum score and map to result format
    const results = matches
      .filter((match) => match.score >= minScore)
      .map((match) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata,
        text: match.metadata.text
      }));

    console.log(
      `Returning ${results.length} results after filtering by minimum score (${minScore})`
    );
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
    console.log(`Deleting ${ids.length} records from Pinecone...`);

    // Convert all IDs to strings
    const stringIds = ids.map((id) => id.toString());

    // Delete the vectors
    const deleteResponse = await pineconeIndex.delete({
      ids: stringIds
    });

    console.log("Vectors deleted successfully:", deleteResponse);
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
    console.log(`Fetching vector with ID: ${id}`);

    // Fetch the vector
    const fetchResponse = await pineconeIndex.fetch([id.toString()]);

    if (fetchResponse.vectors[id.toString()]) {
      console.log("Vector found successfully.");
      return fetchResponse.vectors[id.toString()];
    } else {
      console.log(`Vector with ID ${id} not found.`);
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
