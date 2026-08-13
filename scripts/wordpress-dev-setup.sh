#!/bin/sh
# One-shot setup for the local WordPress + WooCommerce test environment used
# to exercise plugins/plugin-woocommerce/openmerch-woocommerce/ end to end.
# Runs inside the `wordpress-cli` service (docker-compose.yml, `woocommerce-dev`
# profile) against the same `wordpress`/`wordpress-mysql` containers. Idempotent
# — safe to re-run (e.g. `docker compose --profile woocommerce-dev up wordpress-cli`
# again after a fresh volume) without creating duplicate installs/products.
set -eu

WP="wp --path=/var/www/html --allow-root"

echo "[wordpress-dev-setup] waiting for the database..."
# `wp db check` shells out to mariadb-check, which (unlike wp core is-installed/
# install, both plain mysqli via wp-config.php) hits a client/server TLS default
# mismatch against this MySQL 8 container and never succeeds — so poll with a
# real wp-cli DB command instead. `wp core is-installed` fails cleanly (exit 1,
# no error) once the DB is reachable but WordPress isn't installed yet, which is
# exactly the "ready" signal this loop needs; any other exit code means the DB
# genuinely isn't reachable yet.
tries=0
while true; do
  # Deliberately used as an `if` condition (not a bare statement) — under
  # `set -e`, a bare `$WP core is-installed` would silently kill the whole
  # script the instant it (correctly, expectedly) exits 1 for "not installed
  # yet", since only commands used as if/while/until/&&/|| conditions are
  # exempt from set -e's abort-on-nonzero-exit behavior.
  if $WP core is-installed >/dev/null 2>&1; then
    status=0
  else
    status=$?
  fi
  if [ "$status" -eq 0 ] || [ "$status" -eq 1 ]; then
    break
  fi
  tries=$((tries + 1))
  if [ "$tries" -ge 30 ]; then
    echo "[wordpress-dev-setup] database still unreachable after 60s, giving up." >&2
    exit 1
  fi
  sleep 2
done

if ! $WP core is-installed >/dev/null 2>&1; then
  echo "[wordpress-dev-setup] installing WordPress core..."
  $WP core install \
    --url="http://localhost:8090" \
    --title="OpenMerch WooCommerce Dev" \
    --admin_user=admin \
    --admin_password=admin \
    --admin_email=admin@example.com \
    --skip-email
else
  echo "[wordpress-dev-setup] WordPress core already installed, skipping."
fi

echo "[wordpress-dev-setup] installing/activating WooCommerce..."
$WP plugin install woocommerce --activate

# Storefront (WooCommerce's own official theme) rather than a modern block/FSE
# theme (WordPress's own default, e.g. Twenty Twenty-Five). This plugin's
# product-page override (class-openmerch-editor-embed.php) works by
# remove_action()-ing the classic `woocommerce_single_product_summary` hook —
# block themes instead render Add to Cart via the WooCommerce Blocks
# "Add to Cart Form" block, which does not go through that hook at all, so the
# classic button stays visible alongside the iframe. Supporting block themes
# is real additional scope (filtering `render_block` for the Woo block, or a
# dedicated block variation) — not implemented in v1, see readme.txt. Using
# Storefront here keeps this local test environment representative of what
# the plugin actually supports today, matching by far the most common
# real-world WooCommerce/theme pairing.
echo "[wordpress-dev-setup] installing/activating the Storefront theme (classic hooks — see readme.txt's block-theme caveat)..."
$WP theme install storefront --activate

echo "[wordpress-dev-setup] activating the OpenMerch plugin (mounted from plugins/plugin-woocommerce/openmerch-woocommerce)..."
$WP plugin activate openmerch-woocommerce

# Skips WooCommerce's own first-run setup wizard redirect — this is a
# scripted/headless install, nobody is there to click through it.
$WP option update woocommerce_onboarding_profile '{"skipped":true}' --format=json
$WP option update woocommerce_task_list_hidden_lists '["setup_experiment"]' --format=json

# Fixed dev-only shared secret so the WooCommerce webhook and the OpenMerch
# API agree on it automatically, with no manual copy/paste step. NEVER reuse
# this value outside local testing — see the matching WOOCOMMERCE_WEBHOOK_SECRET
# comment on the `api` service in docker-compose.yml.
#
# demo_url points at the host's own localhost:3000 (apps/demo, run via
# `pnpm --filter @openmerch/demo dev` — not dockerized) because it's loaded
# by the *customer's browser*, not by PHP; api_url uses the docker-network
# service name `api` (only reachable from other containers) because it's only
# ever called server-side (webhook delivery, the "Test connection" button).
$WP option update openmerch_wc_options '{"demo_url":"http://localhost:3000","api_url":"http://api:3001","webhook_secret":"openmerch-dev-secret-change-in-production"}' --format=json

echo "[wordpress-dev-setup] ensuring the WooCommerce webhook exists..."
$WP eval 'if (class_exists("Openmerch_Webhook")) { Openmerch_Webhook::activate(); echo "synced\n"; }'

# Creates one real, purchasable test product already mapped to a real
# OpenMerch product (packages/api/seeds/products/catalog.json's
# "classic-tshirt") — so the whole flow (iframe -> design -> cart -> checkout
# -> webhook -> production files) can be tested without hand-configuring
# anything in wp-admin first.
EXISTING_ID=$($WP post list --post_type=product --field=ID --posts_per_page=1 2>/dev/null || true)
if [ -z "$EXISTING_ID" ]; then
  echo "[wordpress-dev-setup] creating a test product..."
  PRODUCT_ID=$($WP wc product create --user=admin --porcelain \
    --name="Custom T-Shirt (OpenMerch)" \
    --type=simple \
    --regular_price=25.00 \
    --manage_stock=false \
    --status=publish)
  $WP post meta update "$PRODUCT_ID" _openmerch_product_id "classic-tshirt"
  echo "[wordpress-dev-setup] test product #$PRODUCT_ID created and mapped to classic-tshirt."
else
  echo "[wordpress-dev-setup] a product already exists (#$EXISTING_ID), skipping test product creation."
fi

echo ""
echo "[wordpress-dev-setup] done."
echo "  Store:     http://localhost:8090"
echo "  wp-admin:  http://localhost:8090/wp-admin  (admin / admin)"
echo "  Settings:  http://localhost:8090/wp-admin/admin.php?page=openmerch-woocommerce"
