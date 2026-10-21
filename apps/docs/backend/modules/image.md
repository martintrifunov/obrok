---
title: Image Module
---

# Image Module

## Public Summary

Image uploads stored on disk with a metadata record in MongoDB. One shared library serves chain logos and product images.

## Internal Details

### Files

| File | Role |
|------|------|
| `image.routes.js` / `image.controller.js` | Routes and HTTP handlers |
| `image.service.js` | Upload, delete, `deleteIfUnused` |
| `image.model.js` / `image.repository.js` | Schema and data access, incl. reference counts |
| `file.service.js` | Deletes files, builds `/uploads/<filename>` URLs |

### Endpoints

Mounted at `/api/images`. "Admin" means `verifyJWT` + `verifyAdmin`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/images` | Admin | List. `page`, `limit` via `paginationWithAllSchema` (default 10, max 100, `limit=0` returns all with `pagination: null`) |
| `GET` | `/images/:id` | Public | Image record |
| `POST` | `/images` | Admin | Upload one file in multipart field `image` |
| `DELETE` | `/images` | Admin | Delete record and file. Body: `id` |

### Data Model

```
title    : String (required)  // original filename, or chain-<key> for seeded logos
filename : String (required)  // <timestamp>-<12 hex chars><ext>
url      : String (required)  // /uploads/<filename>
mimeType : String (required)
size     : Number (required)
createdAt, updatedAt          // timestamps
```

### Upload Flow

1. Multer (`config/multerConfig.js`) accepts JPEG, PNG and WebP up to 10 MB and writes the file to `apps/server/src/uploads/`. Other types get 400 `{ message }`; an oversized file gets 400 "File is too large. The maximum size is 10 MB."
2. No file in the request: 400 `{ message: "Image file is required." }`.
3. The service creates the record with a relative `url` of `/uploads/<filename>`.
4. If the record can't be saved, the uploaded file is deleted.

### Deletion Rules

| Path | Behavior |
|------|----------|
| `DELETE /images` (admin) | 409 while any chain or product uses the image; the message gives the counts. Otherwise deletes file and record, including seeded `chain-<key>` logos. |
| Chain or product delete (`deleteIfUnused`) | Deletes that chain's or product's image only if nothing else uses it and it is not a seeded `chain-<key>` logo. |

Seeded logos are created at server start by `seedChainImages` (`infrastructure/database/seed-chain-images.js`) from `src/data/chain-images/<key>.(png|jpg|jpeg|webp|svg)` for `vero`, `ramstore`, `stokomak` and `kam`, if no image with that title exists. The scraper needs them: a chain run fails if its `chain-<key>` image is missing. An admin-deleted logo is reseeded at the next restart.

### File Serving

Express serves `src/uploads` statically at `/uploads`. In production nginx proxies `/uploads/` to the API container, and `docker-compose.prod.yml` bind-mounts the folder from the host so files survive redeploys.

## Source Anchors

| Path | Relevance |
|------|-----------|
| `apps/server/src/modules/image/image.service.js` | Upload, delete, seeded-logo protection |
| `apps/server/src/modules/image/image.repository.js` | Reference counts (chains, products) |
| `apps/server/src/config/multerConfig.js` | File types, size limit, filenames |
| `apps/server/src/infrastructure/database/seed-chain-images.js` | Seeded chain logos |
| `apps/server/src/uploads/` | Stored files |
| `apps/nginx/nginx.conf` | `/uploads/` proxy in production |

## Risks and Trade-offs

- Files live on the API host's disk, not object storage, so scaling to several API instances would need shared storage.
- File deletion is fire-and-forget: a failed unlink is only logged, leaving a file without a record.
- Seeded logos are recognized by title alone (`chain-<key>`).
- Changing a chain's image or clearing a product's image does not delete the old one; it stays in the library until an admin deletes it.
