import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { languages, translations } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export async function languageRoutes(app: FastifyInstance) {
  // Languages CRUD
  app.get('/api/v1/languages', async () => {
    return db.select().from(languages);
  });

  app.post<{ Body: { code: string; name: string; flag: string; active?: boolean } }>('/api/v1/languages', async (req) => {
    const [item] = await db.insert(languages).values({
      code: req.body.code,
      name: req.body.name,
      flag: req.body.flag,
      active: req.body.active ?? false,
    }).returning();
    return item;
  });

  app.put<{ Params: { id: string }; Body: { active?: boolean } }>(
    '/api/v1/languages/:id',
    async (req, reply) => {
      const updates: Record<string, unknown> = {};
      if (req.body.active !== undefined) updates.active = req.body.active;
      const [item] = await db.update(languages).set(updates).where(eq(languages.id, req.params.id)).returning();
      if (!item) return reply.code(404).send({ error: 'Language not found', code: 'NOT_FOUND' });
      return item;
    },
  );

  app.delete<{ Params: { id: string } }>('/api/v1/languages/:id', async (req, reply) => {
    const [item] = await db.delete(languages).where(eq(languages.id, req.params.id)).returning();
    if (!item) return reply.code(404).send({ error: 'Language not found', code: 'NOT_FOUND' });
    return { success: true };
  });

  // Public endpoint: returns active languages with their translations as a map
  app.get('/api/v1/languages/active', async () => {
    const allLanguages = await db.select().from(languages);
    const active = allLanguages.filter((l) => l.active);
    const result: Record<string, { code: string; name: string; flag: string; translations: Record<string, string> }> = {};
    for (const lang of active) {
      const trans = await db.select().from(translations).where(eq(translations.languageCode, lang.code));
      const map: Record<string, string> = {};
      for (const t of trans) map[t.originalText] = t.translatedText;
      result[lang.code] = { code: lang.code, name: lang.name, flag: lang.flag, translations: map };
    }
    return result;
  });

  // Translations
  app.get<{ Params: { code: string } }>('/api/v1/languages/:code/translations', async (req) => {
    return db.select().from(translations).where(eq(translations.languageCode, req.params.code));
  });

  // Bulk upsert translations
  app.put<{ Params: { code: string }; Body: { entries: { originalText: string; translatedText: string }[] } }>(
    '/api/v1/languages/:code/translations',
    async (req) => {
      const code = req.params.code;
      for (const entry of req.body.entries) {
        const [existing] = await db.select().from(translations).where(
          and(eq(translations.languageCode, code), eq(translations.originalText, entry.originalText)),
        );
        if (existing) {
          await db.update(translations).set({ translatedText: entry.translatedText }).where(eq(translations.id, existing.id));
        } else {
          await db.insert(translations).values({ languageCode: code, originalText: entry.originalText, translatedText: entry.translatedText });
        }
      }
      return db.select().from(translations).where(eq(translations.languageCode, code));
    },
  );
}
