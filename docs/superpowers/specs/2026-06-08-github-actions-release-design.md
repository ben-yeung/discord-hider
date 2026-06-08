# GitHub Actions: CI + tagged releases — design

**Date:** 2026-06-08
**Status:** Approved

## Goal

Automate building the Discord Hider extension into a downloadable, versioned
release zip whenever a release tag is pushed, and validate every PR/main commit
so breakage is caught before a release is cut. Standard open-source flow.

## Background

Discord Hider is a Chrome MV3 extension built with Vite. `npm run build`
produces `dist/` containing `manifest.json`, `content.js`, `popup.html`,
`settings.html`, `icons/`, and `assets/`. A committed `package-lock.json`
exists, so `npm ci` is the correct install command in CI.

Per project memory: vitest tests do **not** type-check, so `tsc --noEmit` must
run as its own step.

## Workflows

Two files under `.github/workflows/`.

### 1. `ci.yml` — validation

- **Triggers:** `pull_request` targeting `main`; `push` to `main`.
- **Job `build-and-test`** (ubuntu-latest):
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` — Node 20, `cache: npm`
  3. `npm ci`
  4. `npm test`
  5. `npx tsc --noEmit`
  6. `npm run build`
- **Purpose:** fail fast on broken tests, type errors, or build failures
  before a release is ever tagged.

### 2. `release.yml` — build + publish

- **Trigger:** `push` on tags matching `v*.*.*`.
- **Permissions:** `contents: write` (create the GitHub Release), scoped to the
  job.
- **Job `release`** (ubuntu-latest):
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` — Node 20, `cache: npm`
  3. **Verify version:** strip leading `v` from the tag to get `$VERSION`; read
     `.version` from `manifest.json`; if they differ, print both and exit 1.
     The tag is the source of truth; this guard prevents shipping a zip whose
     internal manifest version disagrees with the release.
  4. `npm ci`
  5. `npm test`
  6. `npx tsc --noEmit`
  7. `npm run build`
  8. **Package:** zip the *contents* of `dist/` (manifest at zip root, as
     Chrome/Edge expect) into `discord-hider-v$VERSION.zip`.
  9. **Publish:** `softprops/action-gh-release` — create a Release for the tag,
     auto-generate release notes, attach the zip as an asset.

## Release procedure (documented for maintainers)

1. Bump `version` in `manifest.json` **and** `package.json`; merge to `main`.
2. `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. The action builds, verifies, zips, and publishes the release with
   `discord-hider-vX.Y.Z.zip` attached.

## Out of scope

- Hard "tag must be an ancestor of main" check — deliberately skipped; tagging is
  controlled by maintainers, standard for open-source release flows.
- Auto-bumping versions or rewriting `manifest.json` — versions are bumped by
  hand and verified, not generated.
- Publishing to the Chrome Web Store — only a downloadable zip artifact.
