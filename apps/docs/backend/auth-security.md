---
title: Auth And Security
---

# Auth And Security

## Public Summary

Authentication uses JWT access tokens and refresh tokens with cookie transport. Core security controls include helmet headers, CORS controls, and centralized error handling.

## Internal Details

### Token Flow

```mermaid
sequenceDiagram
  participant U as User
  participant API as Auth API
  participant DB as MongoDB
  U->>API: Login credentials
  API->>DB: Validate user and password hash
  DB-->>API: User record
  API-->>U: Access token + refresh cookie
  U->>API: Protected request with access token
  API-->>U: 200 or 401
  U->>API: Refresh request (cookie)
  API-->>U: New access token
```

### Security Controls

- Helmet enabled with production CSP behavior.
- Allowed origins enforced by CORS options: only `CLIENT_ORIGIN` and requests without an `Origin` header pass; any other origin gets a 403 before a route runs, so a foreign page can't trigger cookie-authenticated routes such as refresh or logout.
- JWT verification middleware protects private routes.
- Error middleware converts internal failures to structured responses.

### Hardening Backlog

- Expand rate limiting beyond login.
- Add stronger upload content verification.
- Add operational alerting for abnormal auth failure patterns.

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/server/src/modules/auth/` | Auth module (controller, service, routes, model) |
| `apps/server/src/modules/auth/middleware/` | JWT verification, admin check |
| `apps/server/src/config/corsOptions.js` | CORS origin enforcement |
| `apps/server/src/shared/middleware/errorHandler.js` | Centralized error handler |
| `apps/server/src/config/multerConfig.js` | File upload configuration |

## Risks and Trade-offs

- Refresh-token strategy balances usability and security, but multi-device token management requires strict monitoring and revocation practices.
