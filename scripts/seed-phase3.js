#!/usr/bin/env node

/**
 * Seed Script for Phase 3 Test Data
 * Populates test data for coupons, rules, and operation_logs collections
 */

const { MongoClient } = require('mongodb');

// Environment variables
const mongoUri = process.env.DEFAULT_MONGO_URI || 'mongodb://localhost:27017/ccrc_test';
const dbName = process.env.DEFAULT_MONGO_DB_NAME || 'ccrc_test';

async function seedData() {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(dbName);

    console.log('Connected to MongoDB for seeding');

    // Seed coupons data
    const couponsCollection = db.collection('coupons');
    const couponsData = [
      {
        id: 'coupon-001',
        code: 'WELCOME10',
        type: 'percentage',
        value: 10,
        priority: 1,
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2024-12-31'),
        usageLimit: 1000,
        usedCount: 0,
        usedBy: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'coupon-002',
        code: 'RENEWAL20',
        type: 'percentage',
        value: 20,
        priority: 2,
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2024-12-31'),
        usageLimit: null,
        usedCount: 0,
        usedBy: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await couponsCollection.insertMany(couponsData);
    console.log('Seeded coupons data');

    // Seed rules data
    const rulesCollection = db.collection('rules');
    const rulesData = [
      {
        id: 'rule-001',
        name: 'Grace Period Rule',
        description: 'Apply 7-day grace period for failed payments',
        conditions: {
          paymentStatus: 'failed',
          failureReason: { $in: ['insufficient_funds', 'card_declined'] }
        },
        actions: {
          gracePeriodDays: 7,
          notificationEnabled: true
        },
        priority: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'rule-002',
        name: 'Renewal Discount Rule',
        description: 'Apply renewal discount for subscriptions older than 1 year',
        conditions: {
          subscriptionAgeMonths: { $gte: 12 },
          isRenewal: true
        },
        actions: {
          discountPercentage: 15,
          discountType: 'renewal'
        },
        priority: 2,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await rulesCollection.insertMany(rulesData);
    console.log('Seeded rules data');

    console.log('Seeding completed successfully');

  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

seedData();