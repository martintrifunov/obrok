---
title: Docs Process
---

# Docs Process

## Public Summary

Docs change in the same pull request as the code they describe. This page lists when an update is required, what to check before merging, and how to run the site locally. Writing rules and page ownership are in the [Documentation Charter](/overview/docs-charter).

## Internal Details

### When To Update Docs

- Routes, auth or permission behavior.
- Scraping, search, report or cron behavior.
- Deployment topology, SSL, environment variables, npm scripts or the release process.
- Frontend state management, routing or guards.

### Pull Request Checklist

- The relevant pages are updated, and new pages are added to the sidebar in `apps/docs/.vitepress/config.mts`.
- Paths, commands and env variable names were checked against the code.
- Diagrams are updated if a flow changed.
- New risks or trade-offs are recorded.
- `npm run docs:build` passes.

### Running The Site Locally

In `apps/docs`:

```bash
npm ci
npm run docs:dev       # http://localhost:5173
npm run docs:build     # output in .vitepress/dist
npm run docs:preview
```

Or from the repository root with Docker: `docker compose -f docker-compose.dev.yml up --build docs`.

### What CI Does

- Pull requests touching `apps/docs/**` run `.github/workflows/docs-ci.yml`, which fails if the build fails.
- Docs go live only when a release is published. Details in [docs.obrok.net Hosting](/deployment/docs-obrok-net#how-it-ships).

## Source Anchors

| Path | Relevance |
| --- | --- |
| `apps/docs/package.json` | Docs scripts |
| `apps/docs/.vitepress/config.mts` | Navigation and sidebar |
| `.github/workflows/docs-ci.yml` | Pull request build check |

## Risks and Trade-offs

- CI checks only that the site builds (VitePress fails on dead internal links). It does not catch wrong facts or file paths in prose, so the review checklist above matters.
