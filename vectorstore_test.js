// upload-to-openai-vector-store.js

// Import dependencies
require("dotenv").config(); // Load environment variables from .env
const fs = require("fs"); // For reading the file to upload
const path = require("path"); // For file path resolution
const { OpenAI } = require("openai"); // OpenAI SDK

// Initialize OpenAI client with API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// === CONFIG ===
const filePath = path.join(__dirname, "my-notes.txt"); // Change this to your file
const filePurpose = "assistants"; // Required for vector-store/retrieval use

async function uploadFileToOpenAI() {
  try {
    console.log("⏫ Uploading file to OpenAI...");

    // Upload the file
    const response = await openai.files.create({
      file: fs.createReadStream(filePath),
      purpose: filePurpose
    });

    console.log("✅ Upload successful!");
    console.log("📄 File ID:", response.id);
    console.log(
      "🧠 The file is now embedded and stored in OpenAI's vector store."
    );
    console.log(
      "👉 Use this file ID when attaching to a retrieval-enabled Assistant."
    );
  } catch (err) {
    console.error(
      "❌ Error uploading file:",
      err.response?.data || err.message
    );
  }
}

// Run it
uploadFileToOpenAI();
