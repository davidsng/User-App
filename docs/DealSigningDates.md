# Deal Signing Date Features

This document explains the implementation and usage of the deal signing date fields added to the system.

## Overview

Two new date fields have been added to the deal tracking system:

1. **Expected Signing Date (`deal_expected_signing_date`)**: The projected date when a deal is expected to be signed.
2. **Actual Signing Date (`deal_signing_date`)**: The date when the deal was actually signed.

These fields enable better tracking of deal progress and allow for timeline visualization and improved reporting.

## Database Implementation

Both fields are implemented as `DATE` type columns in the `deals` table:

```sql
ALTER TABLE deals ADD COLUMN deal_expected_signing_date DATE;
ALTER TABLE deals ADD COLUMN deal_signing_date DATE;
```

For efficient querying, indexes have been created on both fields:

```sql
CREATE INDEX idx_deals_expected_signing_date ON deals(deal_expected_signing_date);
CREATE INDEX idx_deals_signing_date ON deals(deal_signing_date);
```

## History Tracking Integration

Changes to signing dates are tracked in the history system with:

- **Change Category**: `DEAL_TIMELINE`
- **Importance**: `MAJOR`

When signing dates change, the system automatically generates appropriate summaries:

- For expected signing date changes: "Expected signing date updated to [NEW_DATE]"
- For actual signings: "Deal was signed on [SIGNING_DATE]"

## User Interface

The signing dates are displayed in the Company History component with a dedicated "Deal Timeline" tab. The UI includes:

1. **Date Display**: Clear visualization of both expected and actual signing dates
2. **Timeline Visualization**: Visual representation of progress toward signing
3. **Status Indicators**: Color-coded elements showing if a deal has been signed

The deal timeline UI is particularly useful for tracking progress across multiple deals and identifying delays in the signing process.

## Vector Search Integration

The signing date fields are integrated into the vector search system, enabling queries like:

- "Deals expected to close this month"
- "Deals with updated signing dates"
- "Deals signed last quarter"

Both dates are included in the text embedding for semantic search and are also added to the vector metadata.

## Typical Usage

### Setting Expected Signing Date

Expected signing dates are typically set during deal negotiation:

```javascript
await updateCompany(
  companyId,
  {
    deal: {
      deal_id: "DEAL-123",
      stage: "negotiation",
      deal_expected_signing_date: "2023-07-15" // YYYY-MM-DD format
    }
  },
  {
    userId: "sales-rep",
    userName: "Sales Rep",
    source: "Sales Pipeline Update"
  }
);
```

### Recording Actual Signing

When a deal is signed, record the actual date:

```javascript
await updateCompany(
  companyId,
  {
    deal: {
      deal_id: "DEAL-123",
      stage: "closed_won",
      deal_signing_date: "2023-07-10" // YYYY-MM-DD format
    }
  },
  {
    userId: "sales-rep",
    userName: "Sales Rep",
    source: "Deal Closure"
  }
);
```

## Reporting Capabilities

These new fields enable several useful reports:

1. **Time-to-Close Analysis**: Average time between expected and actual signing dates
2. **Pipeline Accuracy**: How well expected dates predict actual closures
3. **Seasonal Trends**: Identification of patterns in signing dates throughout the year
4. **Deal Closing Efficiency**: Tracking which deals close faster than expected
