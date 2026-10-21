# The public web image: nginx serving the client bundle and the docs site.
# Build from the repository root after building the docs (apps/docs: npm run docs:build);
# the release workflow does both.
FROM node:24-alpine AS client

WORKDIR /app

COPY apps/client/package.json apps/client/package-lock.json ./

RUN npm ci

COPY apps/client/ ./

# Vite bakes these into the bundle; they're public values, not secrets.
ARG VITE_API_URL
ARG VITE_OSRM_URL
ARG VITE_DEFAULT_VISIBLE_CHAINS
ARG VITE_RELEASE_VERSION

RUN npm run build

FROM nginx:alpine

LABEL org.opencontainers.image.source=https://github.com/martintrifunov/obrok

COPY --from=client /app/dist /usr/share/nginx/html
COPY apps/docs/.vitepress/dist /var/www/docs

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
