# Database Structure Documentation

This document describes the simplified database structure for storing enriched customer data with history tracking.

## Overview

The database is designed with the following principles:

1. **Normalized Structure**: Separate tables for companies, contacts, deals, and products
2. **Built-in History Tracking**: Each entity stores its own change history in JSONB fields
3. **Referential Integrity**: Company ID serves as the primary key across related tables
4. **Rich Customer Data**: Comprehensive schema for storing detailed company, contact, and deal information

## Tables

### Main Entity Tables

- `companies`: Company data with detailed business information and change history
- `contacts`: Contact data with roles, contact methods, and change history
- `deals`: Deal data with comprehensive deal lifecycle tracking and change history
- `products`: Product catalog
- `customer_data`: Raw interaction logs linking companies, contacts, and deals

## History Tracking

Instead of using separate tables for current state, each entity table includes a `change_history` JSONB field that stores previous values when important fields change:

- For companies: When key company information changes
- For contacts: When contact details are updated
- For deals: When deal stage or amount changes

This approach provides:

1. Simpler database structure
2. Built-in history tracking without additional tables
3. Easy access to historical values when needed
4. Efficient queries for current data

## Data Models

### Company Data Model

The company tables store rich information about each company:

- **Basic Info**: Name, description, website
- **Classification**: Industry vertical, sub-industry, B2B/B2C, size
- **Geography**: Headquarters country, other operating countries
- **Business Metrics**: Revenue, employee count
- **Organizational**: Company hierarchy, child companies, legal entity
- **GTM-specific**: Customer segment label, account team, decision country
- **Tracking**: Created at, updated at, change history

### Contact Data Model

The contact tables store detailed information about company contacts:

- **Identity**: Name, email, phone
- **Professional**: Title, influence role
- **Relationships**: Company association
- **Tracking**: Created at, updated at, change history

### Deal Data Model

The deal tables track detailed information about sales opportunities:

- **Deal Lifecycle**: Deal ID, deal state, stage, health
- **Financial**: Deal amount, currency, payment frequency, payment status
- **Temporal**: Start date, end date, policy state
- **GTM Data**: Acquisition channel, campaign source, deal activity
- **Tracking**: Created at, updated at, change history

## Workflow

When new customer data is received:

1. Data is parsed according to the schema
2. Entities are created or updated in their respective tables
3. Important changes are tracked in the change_history JSONB field
4. Raw input is logged in the `customer_data` table

For dashboard queries, all tables provide efficient access to the current state of all entities, while the JSONB history fields maintain contextual history for each record.

## Data Merge Strategy

The system uses a smart merge strategy when updating records:

1. For new data points in an update, these values are added to the record
2. For fields where a value already exists, the new value takes precedence if provided
3. The `COALESCE` function is used to ensure data is preserved when updates contain partial information
4. Previous values of significant fields are stored in the change_history JSONB array

This approach ensures that incomplete updates don't overwrite existing data while still allowing for field-by-field updates and maintaining a history of important changes.

## Indexes

Indexes are created on frequently queried columns to improve performance:

- Company names and industry classifications
- Country and geographic data
- Deal stages and statuses
- Company IDs across related tables
- Timestamps for historical queries

## Entity Relationships

- A company can have multiple contacts
- A company can have multiple deals
- A deal can reference a product
- All interactions are logged in the `customer_data` table
