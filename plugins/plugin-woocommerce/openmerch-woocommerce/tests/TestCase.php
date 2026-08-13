<?php

namespace OpenMerch\Tests;

use Brain\Monkey;
use PHPUnit\Framework\TestCase as PHPUnitTestCase;

/**
 * Base class wiring Brain Monkey's setUp()/tearDown() around every test - Brain Monkey patches
 * WordPress core functions per-test and must be torn down after each one so stubs don't leak
 * between tests.
 */
abstract class TestCase extends PHPUnitTestCase {

	protected function setUp(): void {
		parent::setUp();
		Monkey\setUp();
	}

	protected function tearDown(): void {
		Monkey\tearDown();
		parent::tearDown();
	}
}
