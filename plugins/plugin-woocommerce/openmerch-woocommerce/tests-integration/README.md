# WP core integration tests

Second, separate test suite from `../tests/` (Brain Monkey - mocks every
WP/WC function, no real database, fast). This one runs against a real
WordPress install, real WooCommerce, and a real (throwaway) MySQL database,
using `WP_UnitTestCase` - WordPress core's own test base class. It exists to
catch bugs Brain Monkey's mocks structurally cannot: does a value actually
survive a save/reload round-trip through `wp_postmeta`, does
`render_variation_fields()`'s real HTML output actually contain what it's
supposed to, does `Openmerch_Webhook::activate()` actually create a working
`WC_Webhook` row (not just call functions that look right when mocked).

## One-time setup

From inside the `wordpress` container (see this project's root
`docker-compose.yml`, service `wordpress`, profile `woocommerce-dev`):

```sh
docker compose --profile woocommerce-dev exec wordpress \
  sh wp-content/plugins/openmerch-woocommerce/tests-integration/install.sh
```

This downloads (once, into the gitignored `.wp-tests/` folder):

- WordPress core's bundled PHPUnit test library, matching the WordPress
  version actually running in the container - fetched via `curl` from a
  GitHub tag, since neither the `wordpress` nor `wordpress-cli` images ship
  `svn` (the standard `wp scaffold plugin-tests` / `install-wp-tests.sh` flow
  depends on `svn co develop.svn.wordpress.org`, which isn't an option here)
- `phpunit.phar` 9.6.35 - **deliberately not** the PHPUnit 10 already
  installed via composer for the `tests/` suite. WordPress core's bundled
  test suite (as of WP 7.0.x) still calls a PHPUnit 9-era internal API
  (`PHPUnit\Util\Test::parseTestMethodAnnotations()`) that PHPUnit 10 removed
  - confirmed by trying it. Two suites, two PHPUnit versions, on purpose.
- `yoast/phpunit-polyfills` - the compatibility shim WP core's
  `abstract-testcase.php` requires, fetched as a plain tarball (it ships its
  own composer-free autoloader, `phpunitpolyfills-autoload.php`) since
  `composer` isn't available in these images either

It also creates a throwaway `wordpress_test` database using the MySQL root
credentials already known to this project's dev `docker-compose.yml`
(`MYSQL_ROOT_PASSWORD`) - override `WP_TESTS_DB_ROOT_PASSWORD` (and the other
`WP_TESTS_DB_*` env vars) if your setup differs, or set
`WP_TESTS_SKIP_DB_CREATE=1` if someone already created it for you.

## Running

```sh
docker compose --profile woocommerce-dev exec wordpress sh -c \
  "cd wp-content/plugins/openmerch-woocommerce && \
   php tests-integration/.wp-tests/phpunit.phar \
     --bootstrap tests-integration/bootstrap.php \
     -c tests-integration/phpunit.xml.dist"
```

(Or, on a machine that does have composer: `composer test-integration-install`
once, then `composer test-integration`.)

Expected: `OK (4 tests, ...)`. If it instead fails to find `.wp-tests/...`,
re-run `install.sh` - most likely this is a fresh container that never ran
setup.
