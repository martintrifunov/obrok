---
title: docs.obrok.net Hosting
---

# docs.obrok.net Hosting

## Public Summary

This site is a VitePress project in `apps/docs`. Each release builds it on the VPS into `apps/docs/.vitepress/dist`, and the production Nginx container serves that folder as static files for `docs.obrok.net`.

## Internal Details

### Build

| Command (in `apps/docs`) | Purpose |
| --- | --- |
| `npm run docs:dev` | Dev server (the `docs` Compose service runs it on port `5173`) |
| `npm run docs:build` | Static build into `.vitepress/dist` |
| `npm run docs:preview` | Serve the built output locally |

Site configuration (navigation, sidebar, local search, Mermaid via `vitepress-plugin-mermaid`, clean URLs, sitemap for `https://docs.obrok.net`, "last updated" from git) lives in `apps/docs/.vitepress/config.mts`. A page that is not in the sidebar there is reachable only by direct link.

### How It Ships

1. On a pull request that touches `apps/docs/**`, `.github/workflows/docs-ci.yml` runs `npm ci` and `npm run docs:build` on Node 24. A broken build fails the check.
2. On a published release, `.github/workflows/deploy.yml` runs on the VPS: `npm ci`, `rm -rf .vitepress/cache`, `npm run docs:build` in `apps/docs`, then `docker restart obrok_nginx` after the containers are rebuilt.
3. `docker-compose.prod.yml` mounts `./apps/docs/.vitepress/dist` read-only at `/var/www/docs` in `obrok_nginx`.

There is no separate artifact upload: the build output exists only on the VPS.

### Nginx Server Block

The `docs.obrok.net` block in `apps/nginx/nginx.conf`:

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name docs.obrok.net;

    ssl_certificate /etc/letsencrypt/live/obrok.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/obrok.net/privkey.pem;
    # ... protocols and security headers as for obrok.net

    root /var/www/docs;
    index index.html;

    location / {
        try_files $uri $uri.html $uri/ =404;
        error_page 404 /404.html;
    }

    location ~* ^/assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

- `$uri.html` serves VitePress clean URLs (`cleanUrls: true`). Unknown paths return VitePress's `404.html`, not an SPA fallback.
- The certificate is the shared `obrok.net` certificate, which `init-ssl.sh` requests for both domains. HTTP to HTTPS redirection and the ACME challenge path are handled by the shared port 80 block.

## Source Anchors

| Path | Relevance |
| --- | --- |
| `apps/docs/package.json` | Docs scripts |
| `apps/docs/.vitepress/config.mts` | Site configuration and sidebar |
| `apps/docs/Dockerfile.dev` | Dev docs container |
| `apps/nginx/nginx.conf` | `docs.obrok.net` server block |
| `docker-compose.prod.yml` | Read-only mount of the build output |
| `.github/workflows/docs-ci.yml` | Build check on pull requests |
| `.github/workflows/deploy.yml` | Build on release |
| `init-ssl.sh` | Certificate covering both domains |

## Risks and Trade-offs

- Docs are built only on release, so documentation merged to `main` is not live until the next release.
- The build runs on the VPS with the host's Node (via `nvm`), which is outside Docker and can drift from the Node 24 used in CI.
- Sharing one certificate keeps renewal simple; dropping either domain from `init-ssl.sh` would break HTTPS for it on the next issuance.
