/**
 * OpenAI Assistants API integration for vector storage and retrieval
 * This approach uses OpenAI's Assistants API instead of a hypothetical Vector Store API
 */

import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { embedText } from "./embeddingService.js";

// Initialize OpenAI client
const openai = new OpenAI();

// Global variables to store our assistant and thread
let assistant = null;
let thread = null;

/**
 * Initializes an OpenAI Assistant to use for vector storage and retrieval
 * @param {string} assistantName - The name of the assistant
 */
export async function initOpenAIVectorStore(
  assistantName = "GTM Customer Data Assistant"
) {
  try {
    console.log(`Initializing OpenAI Assistant: ${assistantName}`);

    // Check if we already have an assistant with this name
    console.log("Listing existing assistants...");
    const assistants = await openai.beta.assistants.list({
      limit: 100
    });

    const existingAssistant = assistants.data.find(
      (a) => a.name === assistantName
    );

    if (existingAssistant) {
      console.log(
        `Found existing assistant with name "${assistantName}". ID: ${existingAssistant.id}`
      );
      assistant = existingAssistant;
    } else {
      // Create a new assistant
      console.log(`Creating new assistant with name "${assistantName}"...`);
      assistant = await openai.beta.assistants.create({
        name: assistantName,
        instructions:
          "You are a GTM customer data assistant. Your role is to store and retrieve information about customer interactions, deals, and sales opportunities. " +
          "You'll be given information about companies, contacts, deal values, products, and stages. " +
          "When asked about specific companies or deals, provide all relevant information you have stored.",
        model: "gpt-4-turbo-preview",
        tools: [{ type: "retrieval" }]
      });
      console.log(`Created new assistant with ID: ${assistant.id}`);
    }

    // Create a new thread for our interactions
    console.log("Creating a new thread...");
    thread = await openai.beta.threads.create();
    console.log(`Created new thread with ID: ${thread.id}`);

    return { assistant, thread };
  } catch (error) {
    console.error("Error initializing OpenAI Assistant:", error);
    throw error;
  }
}

/**
 * Creates a temporary file with the data and uploads it to the assistant
 * @param {string} recordId - Unique identifier for the record
 * @param {string} text - The text data to store
 * @param {Object} metadata - Additional metadata
 */
export async function upsertVectorRecord(recordId, text, metadata = {}) {
  if (!assistant || !thread) {
    throw new Error(
      "Assistant not initialized. Call initOpenAIVectorStore first."
    );
  }

  try {
    console.log(`Upserting record with ID: ${recordId}`);

    // Format the data as JSON
    const data = {
      id: recordId.toString(),
      content: text,
      metadata: metadata
    };

    // Create a temporary file with the data
    const tempFilePath = path.join(process.cwd(), `record_${recordId}.json`);
    fs.writeFileSync(tempFilePath, JSON.stringify(data, null, 2));
    console.log(`Created temporary file: ${tempFilePath}`);

    // Upload the file to OpenAI
    console.log("Uploading file to OpenAI...");
    const file = await openai.files.create({
      file: fs.createReadStream(tempFilePath),
      purpose: "assistants"
    });
    console.log(`File uploaded. File ID: ${file.id}`);

    // Attach the file to the assistant
    console.log(`Attaching file to assistant ${assistant.id}...`);
    const attachedFile = await openai.beta.assistants.files.create(
      assistant.id,
      { file_id: file.id }
    );
    console.log(
      `File attached to assistant. Attachment ID: ${attachedFile.id}`
    );

    // Also add the information as a message in the thread
    console.log(`Adding information to thread ${thread.id}...`);
    const message = await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Please store the following customer information:\n\n${text}`
    });
    console.log(`Message added to thread. Message ID: ${message.id}`);

    // Clean up temporary file
    fs.unlinkSync(tempFilePath);
    console.log(`Temporary file ${tempFilePath} removed`);

    return { fileId: file.id, messageId: message.id };
  } catch (error) {
    console.error(`Error upserting record ${recordId}:`, error);
    throw error;
  }
}

/**
 * Search for information using the assistant
 * @param {string} query - The search query
 * @param {number} maxResults - Maximum number of results to return (note: not directly controllable with Assistants API)
 */
export async function searchVectors(query, maxResults = 5) {
  if (!assistant || !thread) {
    throw new Error(
      "Assistant not initialized. Call initOpenAIVectorStore first."
    );
  }

  try {
    console.log(`Searching for: "${query}"`);

    // Add the search query as a message to the thread
    console.log(`Adding search query to thread ${thread.id}...`);
    const message = await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `${query} Please provide up to ${maxResults} most relevant matches, formatted as a JSON array.`
    });
    console.log(`Search query added. Message ID: ${message.id}`);

    // Run the assistant to process the query
    console.log(`Running assistant to process query...`);
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
      instructions: `Search for information related to: "${query}". Return a JSON array with the most relevant ${maxResults} results. Include fields: id, content, metadata where available. Format as a valid JSON array.`
    });

    // Poll for completion
    console.log(`Waiting for assistant to process query. Run ID: ${run.id}`);
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

    while (runStatus.status !== "completed" && runStatus.status !== "failed") {
      console.log(`Current run status: ${runStatus.status}`);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    if (runStatus.status === "failed") {
      console.error(
        `Run failed: ${runStatus.last_error?.message || "Unknown error"}`
      );
      throw new Error(
        `Assistant run failed: ${
          runStatus.last_error?.message || "Unknown error"
        }`
      );
    }

    console.log(`Run completed. Retrieving messages...`);

    // Get the assistant's response
    const messages = await openai.beta.threads.messages.list(thread.id, {
      order: "desc",
      limit: 1
    });

    const responseMessage = messages.data[0];
    console.log(`Retrieved response: ${responseMessage.content[0].text.value}`);

    // Try to parse the response as JSON
    try {
      const responseText = responseMessage.content[0].text.value;
      // Find JSON content (may be surrounded by markdown code blocks)
      const jsonMatch =
        responseText.match(/```(?:json)?\s*(\[.+?\])\s*```/s) ||
        responseText.match(/\[.+?\]/s);

      const jsonContent = jsonMatch
        ? jsonMatch[1] || jsonMatch[0]
        : responseText;
      const results = JSON.parse(jsonContent);

      console.log(`Found ${results.length} results`);
      return results;
    } catch (parseError) {
      console.error("Error parsing response as JSON:", parseError);
      // Return the raw text as a single result if parsing fails
      return [
        {
          content: responseMessage.content[0].text.value,
          id: "parse_error",
          metadata: { query }
        }
      ];
    }
  } catch (error) {
    console.error(`Error searching for "${query}":`, error);
    throw error;
  }
}

/**
 * Upload a file to the assistant for knowledge retrieval
 * @param {string} filePath - Path to the file to upload
 */
export async function uploadFileToVectorStore(filePath) {
  if (!assistant) {
    throw new Error(
      "Assistant not initialized. Call initOpenAIVectorStore first."
    );
  }

  try {
    console.log(`Uploading file: ${filePath} to OpenAI...`);

    // Upload file to OpenAI
    const file = await openai.files.create({
      file: fs.createReadStream(filePath),
      purpose: "assistants"
    });
    console.log(`File uploaded. File ID: ${file.id}`);

    // Attach file to the assistant
    console.log(`Attaching file to assistant ${assistant.id}...`);
    const assistantFile = await openai.beta.assistants.files.create(
      assistant.id,
      { file_id: file.id }
    );
    console.log(
      `File attached to assistant. Attachment ID: ${assistantFile.id}`
    );

    return { fileId: file.id, assistantFileId: assistantFile.id };
  } catch (error) {
    console.error(`Error uploading file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Creates a temporary file with multiple records and uploads it
 * @param {Array} records - Array of {id, text, metadata} objects
 */
export async function createAndUploadVectorsFile(records) {
  if (!assistant) {
    throw new Error(
      "Assistant not initialized. Call initOpenAIVectorStore first."
    );
  }

  try {
    console.log(`Creating JSONL file with ${records.length} records...`);

    // Format as JSON Lines for better processing
    const jsonContent = records
      .map((record) =>
        JSON.stringify({
          id: record.id.toString(),
          content: record.text,
          metadata: record.metadata
        })
      )
      .join("\n");

    // Write to temporary file
    const tempFilePath = path.join(process.cwd(), "temp_records.jsonl");
    fs.writeFileSync(tempFilePath, jsonContent);
    console.log(`JSONL file created at ${tempFilePath}`);

    // Upload to OpenAI
    const result = await uploadFileToVectorStore(tempFilePath);

    // Clean up temporary file
    fs.unlinkSync(tempFilePath);
    console.log(`Temporary file ${tempFilePath} removed`);

    return result;
  } catch (error) {
    console.error("Error creating and uploading vectors file:", error);
    throw error;
  }
}
