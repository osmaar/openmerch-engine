import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { languages, translations } from '../db/schema.js';
import { eq, inArray, sql } from 'drizzle-orm';
import { errorResponseSchema, successResponseSchema, uuidIdParamSchema } from '../schemas/common.js';

const languageSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    code: { type: 'string' },
    name: { type: 'string' },
    flag: { type: 'string' },
    active: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'code', 'name', 'flag', 'active', 'createdAt'],
} as const;

const translationSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    languageCode: { type: 'string' },
    originalText: { type: 'string' },
    translatedText: { type: 'string' },
  },
  required: ['id', 'languageCode', 'originalText', 'translatedText'],
} as const;

const createLanguageBodySchema = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    name: { type: 'string' },
    flag: { type: 'string' },
    active: { type: 'boolean' },
  },
  required: ['code', 'name', 'flag'],
} as const;

const updateLanguageBodySchema = {
  type: 'object',
  properties: {
    active: { type: 'boolean' },
  },
} as const;

const activeLanguagesResponseSchema = {
  type: 'object',
  additionalProperties: {
    type: 'object',
    properties: {
      code: { type: 'string' },
      name: { type: 'string' },
      flag: { type: 'string' },
      translations: { type: 'object', additionalProperties: { type: 'string' } },
    },
    required: ['code', 'name', 'flag', 'translations'],
  },
} as const;

const languageCodeParamSchema = {
  type: 'object',
  properties: {
    code: { type: 'string' },
  },
  required: ['code'],
} as const;

const upsertTranslationsBodySchema = {
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          originalText: { type: 'string' },
          translatedText: { type: 'string' },
        },
        required: ['originalText', 'translatedText'],
      },
    },
  },
  required: ['entries'],
} as const;

export async function languageRoutes(app: FastifyInstance) {
  app.get(
    '/api/v1/languages',
    {
      schema: {
        tags: ['Languages'],
        summary: 'List all languages',
        response: { 200: { type: 'array', items: languageSchema } },
      },
    },
    async () => {
      return db.select().from(languages);
    },
  );

  app.post<{ Body: { code: string; name: string; flag: string; active?: boolean } }>(
    '/api/v1/languages',
    {
      schema: {
        tags: ['Languages'],
        summary: 'Create a language',
        body: createLanguageBodySchema,
        response: { 200: languageSchema },
      },
    },
    async (req) => {
      const [item] = await db.insert(languages).values({
        code: req.body.code,
        name: req.body.name,
        flag: req.body.flag,
        active: req.body.active ?? false,
      }).returning();
      return item;
    },
  );

  app.put<{ Params: { id: string }; Body: { active?: boolean } }>(
    '/api/v1/languages/:id',
    {
      schema: {
        tags: ['Languages'],
        summary: 'Update a language (activate/deactivate)',
        params: uuidIdParamSchema,
        body: updateLanguageBodySchema,
        response: { 200: languageSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const updates: Record<string, unknown> = {};
      if (req.body.active !== undefined) updates.active = req.body.active;
      const [item] = await db.update(languages).set(updates).where(eq(languages.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Language not found', code: 'NOT_FOUND' });
      return item;
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/v1/languages/:id',
    {
      schema: {
        tags: ['Languages'],
        summary: 'Delete a language',
        params: uuidIdParamSchema,
        response: { 200: successResponseSchema, 404: errorResponseSchema },
      },
    },
    async (req, reply) => {
      const [item] = await db.delete(languages).where(eq(languages.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Language not found', code: 'NOT_FOUND' });
      return { success: true };
    },
  );

  app.get(
    '/api/v1/languages/active',
    {
      schema: {
        tags: ['Languages'],
        summary: 'Get active languages with translations',
        description: 'Public endpoint: returns active languages with their translations as a map, keyed by language code.',
        response: { 200: activeLanguagesResponseSchema },
      },
    },
    async () => {
      const active = await db.select().from(languages).where(eq(languages.active, true));
      const result: Record<string, { code: string; name: string; flag: string; translations: Record<string, string> }> = {};
      if (active.length === 0) return result;

      const activeCodes = active.map((l) => l.code);
      const allTranslations = await db.select().from(translations).where(inArray(translations.languageCode, activeCodes));

      const translationsByCode = new Map<string, Record<string, string>>();
      for (const t of allTranslations) {
        let map = translationsByCode.get(t.languageCode);
        if (!map) {
          map = {};
          translationsByCode.set(t.languageCode, map);
        }
        map[t.originalText] = t.translatedText;
      }

      for (const lang of active) {
        result[lang.code] = {
          code: lang.code,
          name: lang.name,
          flag: lang.flag,
          translations: translationsByCode.get(lang.code) ?? {},
        };
      }
      return result;
    },
  );

  app.get<{ Params: { code: string } }>(
    '/api/v1/languages/:code/translations',
    {
      schema: {
        tags: ['Languages'],
        summary: 'List translations for a language',
        params: languageCodeParamSchema,
        response: { 200: { type: 'array', items: translationSchema } },
      },
    },
    async (req) => {
      return db.select().from(translations).where(eq(translations.languageCode, req.params.code));
    },
  );

  app.put<{ Params: { code: string }; Body: { entries: { originalText: string; translatedText: string }[] } }>(
    '/api/v1/languages/:code/translations',
    {
      schema: {
        tags: ['Languages'],
        summary: 'Bulk upsert translations for a language',
        params: languageCodeParamSchema,
        body: upsertTranslationsBodySchema,
        response: { 200: { type: 'array', items: translationSchema } },
      },
    },
    async (req) => {
      const code = req.params.code;
      const entries = req.body.entries;
      if (entries.length > 0) {
        await db.transaction(async (tx) => {
          await tx
            .insert(translations)
            .values(entries.map((entry) => ({ languageCode: code, originalText: entry.originalText, translatedText: entry.translatedText })))
            .onConflictDoUpdate({
              target: [translations.languageCode, translations.originalText],
              set: { translatedText: sql`excluded.translated_text` },
            });
        });
      }
      return db.select().from(translations).where(eq(translations.languageCode, code));
    },
  );
}
