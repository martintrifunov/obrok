---
title: Obrok Documentation
description: Technical documentation for Obrok's architecture, backend, frontend, deployment, and design patterns.
---

# Obrok Documentation

## Public Summary

Obrok scrapes product prices from Macedonian market chains (Vero, Ramstore, Stokomak, KAM), lets users search ingredients and meals across them, and shows the markets on a map with routes. It consists of:

- A React client (Vite) organized by feature.
- An Express API with controller, service and repository layers, plus cron jobs for scraping and analytics cleanup.
- MongoDB for all application data.
- A self-hosted OSRM server for routing.
- Docker Compose for development and production.

## Where To Go

| Section | Covers |
| --- | --- |
| [How It Works](/concepts/overview) | Plain-language explanation of search, geolocation and routing |
| [Architecture](/architecture/overview) | System map and request flows |
| [Backend](/backend/overview) | API modules, auth, scraping, search, jobs |
| [Frontend](/frontend/overview) | Routing, state, map and dashboard features |
| [Deployment](/deployment/overview) | Dev and prod environments, docs hosting, runbooks |
| [Patterns](/patterns/catalog) | Pattern catalog and ADRs |
| [Contributing](/contributing/docs-process) | When and how to update these docs |

Suggested reading paths and the page structure are in [How To Read This Site](/overview/how-to-read). Writing rules are in the [Documentation Charter](/overview/docs-charter).

## Out Of Scope

- End-user manuals.
- Translations.
- Generated API reference (OpenAPI).
