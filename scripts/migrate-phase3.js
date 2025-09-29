#!/usr/bin/env node

/**
 * Database Migration Script for Phase 3
 * Creates new collections: coupons, operation_logs, rules
 */

const { MongoClient } = require('mongodb');

// Environment variables
const mongoUri = process.env.DEFAULT_MONGO_URI || 'mongodb://localhost:27017/ccrc_test';
const dbName = process.env.DEFAULT_MONGO_DB_NAME || 'ccrc_test';

async function createCollections() {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(dbName);

    console.log('Connected to MongoDB');

    // Create coupons collection
    const couponsCollection = await db.createCollection('coupons');
    console.log('Created coupons collection');

    // Create indexes for coupons
    await couponsCollection.createIndex({ code: 1 }, { unique: true });
    await couponsCollection.createIndex({ validUntil: 1 });
    await couponsCollection.createIndex({ priority: 1 });
    console.log('Created indexes for coupons collection');

    // Create operation_logs collection
    const operationLogsCollection = await db.createCollection('operation_logs');
    console.log('Created operation_logs collection');

    // Create indexes for operation_logs
    await operationLogsCollection.createIndex({ subscriptionId: 1 });
    await operationLogsCollection.createIndex({ operatorId: 1 });
    await operationLogsCollection.createIndex({ timestamp: 1 });
    await operationLogsCollection.createIndex({ action: 1 });
    console.log('Created indexes for operation_logs collection');

    // Create rules collection
    const rulesCollection = await db.createCollection('rules');
    console.log('Created rules collection');

    // Create indexes for rules
    await rulesCollection.createIndex({ name: 1 }, { unique: true });
    await rulesCollection.createIndex({ priority: 1 });
    await rulesCollection.createIndex({ isActive: 1 });
    console.log('Created indexes for rules collection');

    console.log('Migration completed successfully');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

createCollections();