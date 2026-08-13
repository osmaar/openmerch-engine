CREATE TABLE "order_designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"design_id" uuid,
	"design_key" varchar(255) NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"design_url" text,
	"design_filename" varchar(255),
	"design_dimensions" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "order_designs_order_design_key_unique" UNIQUE("order_id","design_key")
);
--> statement-breakpoint
-- Carry forward any existing single-design-per-order data before the old columns are dropped below.
INSERT INTO "order_designs" ("order_id", "design_id", "design_key", "product_name", "design_url", "design_filename", "design_dimensions")
SELECT "id", "design_id", COALESCE("design_files"->>'designKey', "id"::text), "product_name", "design_files"->>'url', "design_files"->>'filename', "design_files"->>'dimensions'
FROM "orders"
WHERE "product_name" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_design_id_designs_id_fk";
--> statement-breakpoint
DROP INDEX "orders_design_id_idx";--> statement-breakpoint
ALTER TABLE "designs" ADD COLUMN "source" varchar(20);--> statement-breakpoint
ALTER TABLE "order_designs" ADD CONSTRAINT "order_designs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_designs" ADD CONSTRAINT "order_designs_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_designs_order_id_idx" ON "order_designs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_designs_design_id_idx" ON "order_designs" USING btree ("design_id");--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "product_name";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "design_id";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "design_files";