#!/bin/sh
# Sets up the WordPress core PHPUnit integration test suite for this plugin -
# a *second*, separate test setup from tests/ (which uses Brain Monkey to mock
# WP/WC functions with no real database). This one runs against a real
# WordPress install, real WooCommerce, and a real (throwaway) MySQL database,
# using WP_UnitTestCase - the same base class WordPress core itself uses.
#
# Run this ONCE per environment (a fresh container, a new dev machine, CI).
# It downloads ~60MB (WordPress core source, used only for its bundled test
# helpers) into tests-integration/.wp-tests/, which is gitignored - nothing
# this script downloads is meant to be committed.
#
# Usage (from inside the `wordpress` container - see docker-compose.yml,
# service `wordpress`, profile `woocommerce-dev`):
#
#   docker compose --profile woocommerce-dev exec wordpress sh \
#     wp-content/plugins/openmerch-woocommerce/tests-integration/install.sh
#
# Why this can't just be `wp scaffold plugin-tests` + install-wp-tests.sh:
# that standard flow shells out to `svn` to check out the WP core test
# library, and neither the `wordpress` nor `wordpress-cli` images in this
# project's docker-compose.yml ship svn, git, or composer - only curl, php,
# and (in wordpress-cli) wp-cli. This script does the same job with curl +
# tar instead of svn, and a directly-downloaded phpunit.phar instead of a
# composer-managed one.
#
# WordPress core's bundled PHPUnit test suite (as of WP 7.0.x) does not
# support PHPUnit 10+ (it calls PHPUnit\Util\Test::parseTestMethodAnnotations(),
# removed in PHPUnit 10) - so this suite deliberately uses its own PHPUnit 9.6,
# separate from the PHPUnit 10 this plugin's composer.json installs for the
# Brain Monkey suite in tests/. Two suites, two PHPUnit versions, on purpose.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WP_TESTS_WORK_DIR="$SCRIPT_DIR/.wp-tests"

# WordPress core version to fetch the matching bundled test library for.
# Defaults to whatever version is actually running in this container, so the
# test helpers always match the WordPress install they're testing against.
if [ -z "$WP_VERSION" ]; then
	WP_VERSION="$(php -r "require '/var/www/html/wp-includes/version.php'; echo \$wp_version;")"
fi

PHPUNIT_VERSION="${PHPUNIT_VERSION:-9.6.35}"
POLYFILLS_VERSION="${POLYFILLS_VERSION:-1.1.5}"

# Test database - a separate throwaway database on the same MySQL server
# WordPress itself uses, so no extra service is needed. Matches this
# project's docker-compose.yml `wordpress-mysql` service by default; override
# via env vars if your setup differs.
WP_TESTS_DB_NAME="${WP_TESTS_DB_NAME:-wordpress_test}"
WP_TESTS_DB_HOST="${WP_TESTS_DB_HOST:-wordpress-mysql}"
WP_TESTS_DB_USER="${WP_TESTS_DB_USER:-wordpress}"
WP_TESTS_DB_PASSWORD="${WP_TESTS_DB_PASSWORD:-wordpress}"

echo "==> WordPress core version detected: $WP_VERSION"
mkdir -p "$WP_TESTS_WORK_DIR"
cd "$WP_TESTS_WORK_DIR"

if [ ! -d "wordpress-develop-$WP_VERSION" ]; then
	echo "==> Downloading WordPress core test library ($WP_VERSION) via curl (no svn available)..."
	curl -sL "https://github.com/WordPress/wordpress-develop/archive/refs/tags/${WP_VERSION}.tar.gz" -o wp-develop.tar.gz
	tar xzf wp-develop.tar.gz "wordpress-develop-${WP_VERSION}/tests/phpunit"
	rm wp-develop.tar.gz
else
	echo "==> WordPress core test library already present, skipping download."
fi

if [ ! -f "phpunit.phar" ]; then
	echo "==> Downloading phpunit.phar $PHPUNIT_VERSION..."
	curl -sL "https://phar.phpunit.de/phpunit-${PHPUNIT_VERSION}.phar" -o phpunit.phar
	chmod +x phpunit.phar
else
	echo "==> phpunit.phar already present, skipping download."
fi

if [ ! -d "PHPUnit-Polyfills-$POLYFILLS_VERSION" ]; then
	echo "==> Downloading yoast/phpunit-polyfills $POLYFILLS_VERSION (composer-free, self-contained autoloader)..."
	curl -sL "https://github.com/Yoast/PHPUnit-Polyfills/archive/refs/tags/${POLYFILLS_VERSION}.tar.gz" -o polyfills.tar.gz
	tar xzf polyfills.tar.gz
	rm polyfills.tar.gz
else
	echo "==> phpunit-polyfills already present, skipping download."
fi

echo "==> Writing wp-tests-config.php..."
cat > "$WP_TESTS_WORK_DIR/wp-tests-config.php" <<CONFIG
<?php
define( 'DB_NAME', '$WP_TESTS_DB_NAME' );
define( 'DB_USER', '$WP_TESTS_DB_USER' );
define( 'DB_PASSWORD', '$WP_TESTS_DB_PASSWORD' );
define( 'DB_HOST', '$WP_TESTS_DB_HOST' );
define( 'DB_CHARSET', 'utf8' );
define( 'DB_COLLATE', '' );

\$table_prefix = 'wptests_';

define( 'WP_TESTS_DOMAIN', 'localhost' );
define( 'WP_TESTS_EMAIL', 'admin@example.com' );
define( 'WP_TESTS_TITLE', 'Test Blog' );

define( 'WP_PHP_BINARY', 'php' );
define( 'WPLANG', '' );

define( 'ABSPATH', '/var/www/html/' );
CONFIG

# The regular WORDPRESS_DB_USER (e.g. "wordpress") only has privileges on its
# own database (that's how the official mysql image's auto-provisioning
# works) - it cannot CREATE DATABASE on its own. Creating the throwaway test
# database therefore needs root, once. Matches this project's
# docker-compose.yml `wordpress-mysql` service's MYSQL_ROOT_PASSWORD by
# default; override if your setup differs, or skip entirely
# (WP_TESTS_SKIP_DB_CREATE=1) if someone with access already created it and
# granted $WP_TESTS_DB_USER rights on it.
WP_TESTS_DB_ROOT_USER="${WP_TESTS_DB_ROOT_USER:-root}"
WP_TESTS_DB_ROOT_PASSWORD="${WP_TESTS_DB_ROOT_PASSWORD:-openmerch}"

if [ -z "$WP_TESTS_SKIP_DB_CREATE" ]; then
	echo "==> Creating test database '$WP_TESTS_DB_NAME' as root (via PHP mysqli - no mysql CLI in this image)..."
	php -r "
	\$link = mysqli_connect('$WP_TESTS_DB_HOST', '$WP_TESTS_DB_ROOT_USER', '$WP_TESTS_DB_ROOT_PASSWORD');
	if (!\$link) { fwrite(STDERR, 'Could not connect as root: ' . mysqli_connect_error() . PHP_EOL); exit(1); }
	if (!mysqli_query(\$link, 'CREATE DATABASE IF NOT EXISTS \`$WP_TESTS_DB_NAME\`')) {
	    fwrite(STDERR, 'Could not create database: ' . mysqli_error(\$link) . PHP_EOL); exit(1);
	}
	if (!mysqli_query(\$link, \"GRANT ALL PRIVILEGES ON \`$WP_TESTS_DB_NAME\`.* TO '$WP_TESTS_DB_USER'@'%'\")) {
	    fwrite(STDERR, 'Could not grant privileges: ' . mysqli_error(\$link) . PHP_EOL); exit(1);
	}
	mysqli_query(\$link, 'FLUSH PRIVILEGES');
	echo 'OK' . PHP_EOL;
	"
else
	echo "==> WP_TESTS_SKIP_DB_CREATE set, assuming '$WP_TESTS_DB_NAME' already exists with the right grants."
fi

echo "==> Done. Run the suite with:"
echo "    php $WP_TESTS_WORK_DIR/phpunit.phar --bootstrap tests-integration/bootstrap.php -c tests-integration/phpunit.xml.dist"
