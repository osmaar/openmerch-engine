ALTER TABLE "products" ADD COLUMN "variants" jsonb DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "variant_label" varchar(50);