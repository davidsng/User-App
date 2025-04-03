import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Creates an embedding using OpenAI's text-embedding-ada-002
export async function embedText(text) {
  try {
    console.log(
      `Calling OpenAI embeddings API with text of length: ${text.length}`
    );

    // Ensure text is not empty
    if (!text || text.trim().length === 0) {
      console.error("Warning: Empty text provided to embedText function");
      text = "Empty text";
    }

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      dimensions: 1536
    });

    if (!response?.data?.[0]?.embedding) {
      console.error(
        "Error: Invalid response from OpenAI embeddings API:",
        response
      );
      throw new Error("Failed to generate embedding: Invalid API response");
    }

    const embedding = response.data[0].embedding;
    console.log(
      `Embedding generated successfully. Dimension: ${embedding.length}`
    );

    // Validate embedding is an array of numbers
    if (
      !Array.isArray(embedding) ||
      embedding.length === 0 ||
      typeof embedding[0] !== "number"
    ) {
      console.error("Error: Invalid embedding format:", embedding);
      throw new Error("Failed to generate valid embedding format");
    }

    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    console.error("Error details:", error.error || error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    throw error;
  }
}
