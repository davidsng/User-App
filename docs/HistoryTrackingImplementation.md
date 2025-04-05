# History Tracking Implementation

This document details the implementation of history tracking in the database and its applications for vector search and UI visualization.

## Overview

Our history tracking system offers:

- Simplified database schema using JSONB fields to store history directly within entity tables
- Rich history metadata that categorizes and classifies changes
- Integration of history-aware vector embeddings for enhanced search capabilities
- UI visualization component that displays a timeline of changes

## Database Implementation

Each entity table (companies, contacts, deals) includes a `change_history` JSONB field that stores an array of history entries. Each history entry has the following structure:

```json
{
  "timestamp": "2023-06-15T14:22:31Z",
  "user_id": "user123",
  "user_name": "John Smith",
  "source": "API Update",
  "change_type": "update",
  "change_category": "classification",
  "importance": "major",
  "changed_fields": ["industry", "company_size"],
  "summary": "Updated company classification from Small Tech to Large Healthcare",
  "previous_values": {
    "industry": "Technology",
    "company_size": "11-50"
  },
  "current_values": {
    "industry": "Healthcare",
    "company_size": "1000+"
  },
  "vector_text": "Company changed from Technology industry (Small) to Healthcare industry (Large)"
}
```

## Change Detection and Categorization

The `createHistoryEntry()` function in `postgresqlLogic.js` implements the following process:

1. **Identify Changed Fields**: Compare previous and current entity states
2. **Categorize Changes**: Group changes into categories like "contact_info", "classification", "deal_status", "deal_timeline"
3. **Classify Importance**: Determine if changes are "minor", "standard", or "major" based on business rules
4. **Generate Summary**: Create a human-readable summary of the changes
5. **Create Vector-Optimized Text**: Format change data for optimal semantic search

### Change Categories

The system automatically categorizes changes based on the fields that were modified:

| Entity  | Category               | Fields                                        | Importance |
| ------- | ---------------------- | --------------------------------------------- | ---------- |
| Company | COMPANY_CLASSIFICATION | industry_vertical, size                       | MAJOR      |
| Company | COMPANY_METRICS        | revenue, employee_size                        | MAJOR      |
| Company | COMPANY_DETAILS        | website_url, country_hq                       | STANDARD   |
| Contact | CONTACT_INFO           | email, phone                                  | STANDARD   |
| Contact | CONTACT_ROLE           | title, influence_role                         | MAJOR      |
| Deal    | DEAL_STAGE             | stage, deal_state                             | MAJOR      |
| Deal    | DEAL_VALUE             | deal_amount                                   | MAJOR      |
| Deal    | DEAL_TIMELINE          | deal_expected_signing_date, deal_signing_date | MAJOR      |
| Any     | GENERAL_UPDATE         | Any other fields                              | MINOR      |

## Enhanced Vector Embeddings

History data is integrated into vector search through:

1. **Text Inclusion**: History entries are formatted and included in text embeddings
2. **Metadata Enhancement**: Vector records include metadata about history:
   - `has_history`: Boolean flag indicating history presence
   - `history_count`: Number of history entries
   - `latest_change`: Timestamp of most recent change
   - `change_categories`: Array of categories present in history
3. **Query Support**: Semantic search supports queries like "companies that changed industries", "deals that increased in value", or "deals with updated signing dates"

## UI Visualization

The `CompanyHistory` React component provides:

1. **Timeline View**: Chronological display of company changes
2. **Major Change Highlighting**: Visual emphasis on significant changes
3. **Before/After Values**: Display of previous and current values for changed fields
4. **Change Categorization**: Color-coded badges for different change types
5. **Summary View**: Overview of company history metrics

## Usage

### Tracking Changes

Changes are automatically tracked when an entity is updated:

```javascript
// Update a company with history tracking
const updatedCompany = await updateCompany(companyId, newData, {
  userId: "user123",
  userName: "John Smith",
  source: "Manual Update"
});
```

### Retrieving History

History can be retrieved for vector search or complete entity data:

```javascript
// Get history optimized for vector search
const vectorHistory = await getEntityHistoryForVectorSearch(
  "company",
  companyId
);

// Get complete company data including history
const companyWithHistory = await getCompanyById(companyId, {
  includeHistory: true
});
```

## Benefits

1. **Data Integrity**: Complete history stored with each entity
2. **Semantic Search**: Enhanced search capabilities using temporal data
3. **User Experience**: Timeline visualization for better data exploration
4. **Auditability**: Track who made changes and when
5. **Simplified Architecture**: No separate state/history tables needed
