import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from './db/index.js';
import { languages, translations, products } from './db/schema.js';
import { eq, and } from 'drizzle-orm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRANSLATIONS_DIR = join(__dirname, '..', 'seeds', 'translations');
const PRODUCTS_FILE = join(__dirname, '..', 'seeds', 'products', 'catalog.json');

async function seedTranslations() {
  console.log(`\n📚 Seeding translations from ${TRANSLATIONS_DIR}`);

  const files = readdirSync(TRANSLATIONS_DIR).filter((f) => f.endsWith('.json'));
  console.log(`   Found ${files.length} language file(s): ${files.join(', ')}`);

  for (const file of files) {
    const raw = readFileSync(join(TRANSLATIONS_DIR, file), 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    const meta = data._meta as { code: string; name: string; flag: string } | undefined;

    if (!meta || !meta.code || !meta.name || !meta.flag) {
      console.warn(`   ⚠️  ${file}: missing _meta, skipping`);
      continue;
    }

    const [existing] = await db.select().from(languages).where(eq(languages.code, meta.code));
    if (!existing) {
      await db.insert(languages).values({ code: meta.code, name: meta.name, flag: meta.flag, active: true });
      console.log(`   ✓ Language created: ${meta.flag} ${meta.name} (${meta.code})`);
    } else {
      console.log(`   ✓ Language exists: ${meta.flag} ${meta.name} (${meta.code})`);
    }

    let count = 0;
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('_')) continue;
      if (typeof value !== 'string') continue;

      const [existingTrans] = await db.select().from(translations)
        .where(and(eq(translations.languageCode, meta.code), eq(translations.originalText, key)));

      if (existingTrans) {
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
}

interface ProductSeed {
  name: string;
  slug: string;
  description: string;
  price: number;
  categories: string[];
  printingTechniques: string[];
  zones: unknown[];
  variants?: unknown[];
  variantLabel?: string;
}

async function seedProducts() {
  if (!existsSync(PRODUCTS_FILE)) {
    console.log('\n📦 No product catalog found, skipping');
    return;
  }

  console.log('\n📦 Seeding products from catalog.json');

  const raw = readFileSync(PRODUCTS_FILE, 'utf-8');
  const catalog = JSON.parse(raw) as ProductSeed[];

  let created = 0;
  let skipped = 0;

  for (const product of catalog) {
    const [existing] = await db.select().from(products).where(eq(products.slug, product.slug));
    if (existing) {
      skipped++;
      continue;
    }

    await db.insert(products).values({
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      categories: product.categories,
      printingTechniques: product.printingTechniques,
      zones: product.zones,
      variants: product.variants ?? [],
      variantLabel: product.variantLabel ?? null,
      active: true,
    });
    created++;
    console.log(`   ✓ ${product.name} (${product.zones.length} zone(s))`);
  }

  console.log(`   ${created} product(s) created, ${skipped} already existed`);
}

async function main() {
  await seedTranslations();
  await seedProducts();
  console.log('\n✅ Seed complete\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });
