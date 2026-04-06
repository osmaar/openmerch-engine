import { pgTable, uuid, varchar, text, jsonb, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

// Products table
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  price: integer('price').notNull().default(0), // cents
  categories: jsonb('categories').notNull().default('[]'),
  printingTechniques: jsonb('printing_techniques').notNull().default('[]'),
  active: boolean('active').notNull().default(true),
  zones: jsonb('zones').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Designs table
export const designs = pgTable('designs', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  name: varchar('name', { length: 255 }).default('Untitled Design'),
  designData: jsonb('design_data').notNull(),
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

// Templates table
export const templates = pgTable('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  categories: jsonb('categories').notNull().default('[]'),
  tags: jsonb('tags').notNull().default('[]'),
  fileUrl: text('file_url'),
  fileName: varchar('file_name', { length: 255 }),
  price: integer('price').notNull().default(0),
  featured: boolean('featured').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Cliparts table
export const cliparts = pgTable('cliparts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  categories: jsonb('categories').notNull().default('[]'),
  tags: jsonb('tags').notNull().default('[]'),
  fileUrl: text('file_url'),
  price: integer('price').notNull().default(0),
  featured: boolean('featured').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Shapes table
export const shapes = pgTable('shapes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  svgContent: text('svg_content').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Fonts table
export const fonts = pgTable('fonts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 500 }).default('The quick brown fox jumps over the lazy dog'),
  fileUrl: text('file_url'),
  isGoogle: boolean('is_google').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Printing types table
export const printingTypes = pgTable('printing_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  thumbnailUrl: text('thumbnail_url'),
  active: boolean('active').notNull().default(true),
  calculationMethod: varchar('calculation_method', { length: 50 }).notNull().default('elements'),
  pricingConfig: jsonb('pricing_config').notNull().default('{}'),
  resourcePermissions: jsonb('resource_permissions').notNull().default('{}'),
  layoutConfig: jsonb('layout_config').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Orders table
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: varchar('order_id', { length: 50 }).notNull().unique(),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  designId: uuid('design_id').references(() => designs.id),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  total: integer('total').notNull().default(0),
  designFiles: jsonb('design_files'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Languages table
export const languages = pgTable('languages', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 10 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  flag: varchar('flag', { length: 10 }).notNull(),
  active: boolean('active').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Translations table
export const translations = pgTable('translations', {
  id: uuid('id').primaryKey().defaultRandom(),
  languageCode: varchar('language_code', { length: 10 }).notNull(),
  originalText: text('original_text').notNull(),
  translatedText: text('translated_text').notNull().default(''),
});

// Production jobs table
export const productionJobs = pgTable('production_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  designId: uuid('design_id').references(() => designs.id).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('queued'),
  format: varchar('format', { length: 20 }).notNull(),
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
