import OpenAI from "openai";
const client = new OpenAI();

const vector_store = await client.vectorStores.create({
  // Create vector store
  name: "Support FAQ"
});

await client.vector_store.files.create_and_poll({
  vector_store_id: "vs_123",
  file_id: "file_123"
});
