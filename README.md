# GTM Data Processing App

A Node.js application that processes unstructured Go-To-Market (GTM) data, extracts structured information using OpenAI, and stores it in both PostgreSQL and Pinecone vector databases.

## Features

- Extract structured data from unstructured text using OpenAI GPT-4
- Store customer and deal information in PostgreSQL using a normalized database schema
- Advanced history tracking with categorization and importance classification
- History-aware vector embeddings for temporal semantic search
- Deal signing date tracking with timeline visualization
- Create vector embeddings and store them in Pinecone
- Search for similar information using semantic search
- REST API for accessing and updating customer data
- Timeline visualization of entity change history
- Generate random CRM updates for testing

## Database Design

The application uses a simplified database structure with built-in history tracking:

- **Single Tables per Entity**: Each entity (companies, contacts, deals) is stored in a single table
- **JSONB History Tracking**: Previous values are stored in a JSONB field when important data changes
- **Deal Timeline Tracking**: Expected and actual signing dates are tracked for deal progress visualization
- **User Prompt Logs**: All raw user inputs are logged in the user_prompt_logs table
- **Denormalized Fields**: For better reporting, key fields like company_name are denormalized in related tables

For more details, see the [Database Structure Documentation](docs/database-structure.md), [History Tracking Implementation](docs/HistoryTrackingImplementation.md), and [Deal Signing Date Features](docs/DealSigningDates.md).

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
   PORT=3000 # Optional, defaults to 3000
   ```
4. Run database migrations:
   ```
   node src/db/migrateDatabases.js
   ```

## Usage

Run the main application:

```
node src/main.js
```

Start the API server:

```
node src/api.js
```

## API Endpoints

- `GET /api/companies` - Get all companies (latest state)
- `GET /api/companies/:companyId` - Get company state by ID
- `GET /api/companies/:companyId/history` - Get company interaction history
- `POST /api/customer-updates` - Process new customer data

## Project Structure

The project follows a modular structure:

- `src/` - Main source code directory
  - `main.js` - Main application logic
  - `api.js` - REST API endpoints
  - `generateRandomCRMUpdate.js` - Utility for generating test data
  - `components/` - UI components
  - `schemas/` - Data schemas for OpenAI function calling
    - `customerObjectSchema.js` - Schema for customer data extraction with improved date handling
  - `db/` - Database-related code
    - `db.js` - PostgreSQL database connection
    - `postgresqlLogic.js` - Database operations with normalized schema
    - `migrateDatabases.js` - Database migration script
    - `migrations/` - Database migration files
      - `01_create_tables.sql` - Initial table creation
      - `05_add_company_product_names.sql` - Add denormalized company and product names
      - `06_create_customer_data_table.sql` - Contact logging table
      - `09_create_user_prompt_logs.sql` - User input logging table
      - `11_add_is_primary_to_contacts.sql` - Primary contact tracking
      - `12_add_company_name_to_contacts.sql` - Add denormalized company name to contacts
  - `utils/` - Utility functions
    - `embeddingService.js` - OpenAI embedding generation
    - `pineconeVectorStore.js` - Pinecone vector store operations
    - `openAIVectorStore.js` - OpenAI vector store operations
  - `gtm_constants/` - Constants used for GTM data processing
    - `productArray.js` - List of available products
    - `dealStages.js` - Deal pipeline stages definition
- `tests/` - Test files
- `docs/` - Documentation files

## Database Tables

- `companies` - Stores company information
- `contacts` - Stores contact information with company relationships
- `deals` - Stores deal information with company and product relationships
- `products` - Stores product catalog
- `user_prompt_logs` - Logs of all raw user inputs with references to related entities
- `migrations` - Tracks applied database migrations

## License

MIT
