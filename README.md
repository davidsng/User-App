# GTM Data Processing App

A Node.js application that processes unstructured Go-To-Market (GTM) data, extracts structured information using OpenAI, and stores it in both PostgreSQL and Pinecone vector databases.

## Features

- Extract structured data from unstructured text using OpenAI GPT-4
- Store customer and deal information in PostgreSQL
- Create vector embeddings and store them in Pinecone
- Search for similar information using semantic search
- Generate random CRM updates for testing

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Pinecone account with an API key
- OpenAI API key

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with the following variables:
   ```
   OPENAI_API_KEY=your_openai_api_key
   PG_CONNECTION_STRING=your_postgresql_connection_string
   PINECONE_API_KEY=your_pinecone_api_key
   PINECONE_ENV=your_pinecone_environment (e.g., us-east-1)
   PINECONE_INDEX=your_pinecone_index_name
   ```

## Usage

Run the main application:

```
node main.js
```

## Project Structure

- `main.js` - Main application logic
- `db.js` - PostgreSQL database connection
- `customerRepo.js` - Customer data operations
- `embeddingService.js` - OpenAI embedding generation
- `pineconeVectorStore.js` - Pinecone vector store operations
- `generateRandomCRMUpdate.js` - Generate random CRM updates

## License

MIT
