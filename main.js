import OpenAI from "openai";
import dotenv from "dotenv";
import { pgClient, initDB } from "./db.js";
import { upsertCustomer, getCustomerById } from "./customerRepo.js";
import { openai } from "./embeddingService.js";
import {
  initPineconeVectorStore,
  upsertVectorRecord,
  searchVectors,
  batchUpsertVectorRecords
} from "./pineconeVectorStore.js";
import { Pinecone } from "@pinecone-database/pinecone";
import { generateRandomCRMUpdate } from "./generateRandomCRMUpdate.js";
import { customerObjectSchema } from "./schemas/customerObjectSchema.js";

// Load environment variables
dotenv.config();

async function main() {
  try {
    console.log("Starting application...");

    // 1) Initialize database connection
    try {
      console.log("Initializing database connection...");
      await initDB();
      console.log("Database initialized successfully");
    } catch (dbError) {
      console.error("Error initializing database:", dbError);
      throw dbError;
    }

    // 2) Init (or retrieve) Pinecone Vector Store
    try {
      console.log("Initializing Pinecone Vector Store...");
      await initPineconeVectorStore();
      console.log("Pinecone Vector Store initialized successfully");
    } catch (pineconeError) {
      console.error("Error initializing Pinecone Vector Store:", pineconeError);
      console.error(
        "Error details:",
        pineconeError.error || pineconeError.message
      );
      throw pineconeError;
    }

    // 3) Extract structured data from unstructured text
    try {
      const unstructuredText =
        "Met Lauren from Shopback and negotiating a new deal for $35K for Radar product";
      //     const unstructuredText = await generateRandomCRMUpdate();
      //   console.log(
      //     "Calling OpenAI to extract data from text:",
      //     unstructuredText
      //   );

      // 4) GPT system prompt
      const systemPrompt =
        "You are an AI data extraction assistant specialized in go-to-market (GTM) data extraction. " +
        "Your task is to convert unstructured input—specifically containing GTM-related details such " +
        "as sales pipeline information, lead sources, acquisition channels, customer engagement metrics, " +
        "and related financial and operational data—into a structured JSON object that exactly conforms " +
        "to our unified GTM Customer Data Model.";

      // Note: TBC if I want to define the list of products and the deal stages and use as enum
      const product_array = ["payments", "analytics", "infrastructure"];
      const deal_stage_array = [
        "discovery",
        "negotiation",
        "closed_won",
        "closed_lost"
      ];

      let extractedData;
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: unstructuredText }
          ],
          functions: [customerObjectSchema],
          function_call: { name: "customer_update" }
        });

        extractedData = JSON.parse(
          response.choices[0].message.function_call.arguments
        );
        console.log("Extracted Data:", extractedData);
      } catch (aiError) {
        console.error("Error calling OpenAI:", aiError);
        throw aiError;
      }

      // 6) Store the extracted data in PostgreSQL
      console.log("Upserting extracted data to PostgreSQL...");
      const recordId = await upsertCustomer(
        extractedData.company_name,
        extractedData.contact.name,
        extractedData.contact.email || null,
        extractedData.deal.value,
        extractedData.deal.product,
        extractedData.deal.stage,
        extractedData.raw_input
      );
      console.log("Data upserted to PostgreSQL. Record ID:", recordId);

      // 7) Prepare metadata for vector storage
      console.log("Preparing data for Pinecone Vector Store...");
      const textForEmbedding = `COMPANY: ${extractedData.company_name}
CONTACT: ${extractedData.contact.name}
DEAL VALUE: ${extractedData.deal.value}
PRODUCT: ${extractedData.deal.product}
STAGE: ${extractedData.deal.stage}
NOTES: ${extractedData.raw_input}`;

      const metadata = {
        company_name: extractedData.company_name,
        contact_name: extractedData.contact.name,
        deal_value: extractedData.deal.value,
        deal_product: extractedData.deal.product,
        deal_stage: extractedData.deal.stage,
        raw_input: extractedData.raw_input,
        record_id: recordId
      };

      // 8) Store in Pinecone Vector Store
      console.log("Storing data in Pinecone Vector Store...");
      try {
        const result = await upsertVectorRecord(
          recordId,
          textForEmbedding,
          metadata
        );
        console.log("Data stored in Pinecone successfully:", result);
      } catch (storeError) {
        console.error("Error storing data in Pinecone:", storeError);
        console.error("Error details:", storeError.error || storeError.message);
        console.log("Will continue with additional operations...");
      }

      // 9) Search Pinecone for stored information
      try {
        const query = "What deal do we have with ABC Company?";
        console.log("Searching Pinecone for:", query);

        // Search with minimum score filter
        const results = await searchVectors(query, 5, 0.5);
        console.log("Search Results:", JSON.stringify(results, null, 2));

        // Process search results
        if (results.length > 0) {
          console.log("Top match score:", results[0].score);
          console.log("Top match metadata:", results[0].metadata);
        } else {
          console.log(
            "No matches found in Pinecone. This might indicate the vector was not stored successfully."
          );
        }
      } catch (searchError) {
        console.error("Error searching Pinecone:", searchError);
        console.error(
          "Error details:",
          searchError.error || searchError.message
        );
      }

      // 10) Fetch from PostgreSQL for verification
      console.log("Fetching data from PostgreSQL for verification...");
      try {
        const pgData = await getCustomerById(recordId);
        console.log("Fetched from Postgres:", pgData);
      } catch (pgFetchError) {
        console.error("Error fetching from PostgreSQL:", pgFetchError);
      }
    } catch (error) {
      console.error("Error extracting structured data:", error);
      throw error;
    }
  } catch (error) {
    console.error("Main application error:", error);
  } finally {
    // Close database connection
    try {
      await pgClient.end();
      console.log("PostgreSQL connection closed");
    } catch (e) {
      console.error("Error closing PostgreSQL connection:", e);
    }
    console.log("Application execution completed");
  }
}

main();
