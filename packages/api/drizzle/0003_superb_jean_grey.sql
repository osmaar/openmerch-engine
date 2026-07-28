CREATE INDEX "designs_product_id_idx" ON "designs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "orders_design_id_idx" ON "orders" USING btree ("design_id");--> statement-breakpoint
CREATE INDEX "translations_language_code_idx" ON "translations" USING btree ("language_code");