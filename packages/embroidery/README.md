# @openmerch/embroidery (placeholder)

**Status: not built.** This folder is an empty placeholder (`.gitkeep` only) — no code exists here yet.

## What this would be

A Python microservice (FastAPI + [pyembroidery](https://github.com/EmbroidePy/pyembroidery)) that converts a finished design into embroidery machine files — DST and PES — as part of the production pipeline, alongside the existing PNG/SVG output for sublimation and screen printing.

## Why it's not being built right now

It's explicitly marked **Post-MVP** in [docs/ROADMAP.md](../../docs/ROADMAP.md#post-mvp--explicitly-out-of-scope-for-now) and is not on the maintainer's active roadmap. Beyond the general scope of the microservice itself, validating DST/PES output correctly requires running it on real embroidery machines (Tajima, Brother, Barudan) — hardware the maintainer doesn't have access to.

## How to contribute

Contributors with access to embroidery hardware are especially welcome. See [CONTRIBUTING.md](../../CONTRIBUTING.md) for the general process, and the embroidery entry in [docs/ROADMAP.md](../../docs/ROADMAP.md#post-mvp--explicitly-out-of-scope-for-now) for current context on scope and status.
