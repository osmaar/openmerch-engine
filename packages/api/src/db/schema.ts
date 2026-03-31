import { pgTable, uuid, varchar, text, jsonb, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

// Products table
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  zones: jsonb('zones').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Designs table
export const designs = pgTable('designs', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  name: varchar('name', { length: 255 }).default('Untitled Design'),
  designData: jsonb('design_data').notNull(), // Full Design JSON
  thumbnailUrl: text('thumbnail_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Assets table (uploaded images)
export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  filename: varchar('filename', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  size: integer('size').notNull(),
  url: text('url').notNull(),
  storageKey: text('storage_key').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Production jobs table
export const productionJobs = pgTable('production_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  designId: uuid('design_id').references(() => designs.id).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('queued'), // queued, processing, completed, failed
  format: varchar('format', { length: 20 }).notNull(), // png, svg, dst, pes
  outputUrl: text('output_url'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Settings table (API keys, config)
export const settings = pgTable('settings', {
  key: varchar('key', { length: 255 }).primaryKey(),
  value: text('value').notNull(),
  isSecret: boolean('is_secret').default(false),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
