import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from './db/index.js';
import { languages, translations } from './db/schema.js';
import { eq, and } from 'drizzle-orm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEEDS_DIR = join(__dirname, '..', 'seeds', 'translations');

async function seedTranslations() {
  console.log(`\n📚 Seeding translations from ${SEEDS_DIR}`);

  const files = readdirSync(SEEDS_DIR).filter((f) => f.endsWith('.json'));
  console.log(`   Found ${files.length} language file(s): ${files.join(', ')}`);

  for (const file of files) {
    const raw = readFileSync(join(SEEDS_DIR, file), 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    const meta = data._meta as { code: string; name: string; flag: string } | undefined;

    if (!meta || !meta.code || !meta.name || !meta.flag) {
      console.warn(`   ⚠️  ${file}: missing _meta, skipping`);
      continue;
    }

    // Insert or update language
    const [existing] = await db.select().from(languages).where(eq(languages.code, meta.code));
    if (!existing) {
      await db.insert(languages).values({ code: meta.code, name: meta.name, flag: meta.flag, active: true });
      console.log(`   ✓ Language created: ${meta.flag} ${meta.name} (${meta.code})`);
    } else {
      console.log(`   ✓ Language exists: ${meta.flag} ${meta.name} (${meta.code})`);
    }

    // Insert/update translations (skip _meta and any _* keys)
    let count = 0;
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('_')) continue;
      if (typeof value !== 'string') continue;

      const [existingTrans] = await db.select().from(translations)
        .where(and(eq(translations.languageCode, meta.code), eq(translations.originalText, key)));

      if (existingTrans) {
        // Don't overwrite existing translations on re-seed unless they are empty
        if (!existingTrans.translatedText) {
          await db.update(translations).set({ translatedText: value }).where(eq(translations.id, existingTrans.id));
          count++;
        }
      } else {
        await db.insert(translations).values({ languageCode: meta.code, originalText: key, translatedText: value });
        count++;
      }
    }
    console.log(`   ✓ ${count} translation(s) added/updated for ${meta.code}`);
  }

  console.log('\n✅ Seed complete\n');
}

seedTranslations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });
