---
title: Documentation Charter
---

# Documentation Charter

## Public Summary

The rules for writing Obrok documentation: what every claim must be based on, how pages are structured, and who keeps each section current. The workflow for changing docs is in [Docs Process](/contributing/docs-process).

## Internal Details

### Principles

1. Every technical statement must be traceable to code or configuration. If it cannot be verified, leave it out.
2. A change to flows, module boundaries, configuration or deployment updates the docs in the same change.
3. Each page has one job. Link to the page that owns a topic instead of repeating it.
4. Explain trade-offs, not only intent.

### Page Template

Technical pages use these sections, in order:

1. Public Summary
2. Internal Details
3. Source Anchors
4. Risks and Trade-offs
5. Next Extension Points (optional)

### Diagrams

- Use Mermaid for architecture, lifecycle and flow diagrams.
- Use full names for nodes, not abbreviations.
- At most one main diagram per page, and only when it matches the code.

### Code References

- Reference files by repository path, and make sure the path exists.
- Prefer stable entry points (`apps/server/src/app.js`, `apps/server/src/container.js`, route files) over internals.
- When describing behavior, name at least one concrete route, hook or service function.
- Commands must run as written, for example `docker exec obrok_api npm run scrape kam`.

### Ownership

| Pages | Owner |
| --- | --- |
| Backend | Backend maintainers |
| Frontend | Frontend maintainers |
| Deployment | Release and operations maintainers |
| Patterns and ADRs | Architecture owners |
