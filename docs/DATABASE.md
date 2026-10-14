# Optional MongoDB metadata database

MongoDB is optional. Without `MONGODB_URI`, the app starts in its original no-database mode. If configured, the backend writes only aggregate transfer metadata to `transfer_metadata`; it never writes file bytes, names, MIME types, room IDs, sender/receiver tokens, IP addresses, or SDP/ICE data.

## Collection

Each transfer document has `transferId` (random UUID), `sizeBytes`, `state`, `createdAt`, and `expiresAt`. On completion the backend additionally records `updatedAt`, `completedAt`, `durationMs`, and `averageBps`. Status values include offered, accepted, declined, and completed. A unique transfer ID index prevents duplicate records; a TTL index expires records after the configured retention period (MongoDB removes expired documents asynchronously).

The room registry and authorization tokens remain in memory only and disappear when the Node process restarts. The database is not used to resume transfers or reconstruct rooms. The file name is not persisted, even though it is disclosed transiently to the receiver for consent.

This release does not expose a public history API or history page. The collection is intended for operator-side aggregate records and retention; do not grant clients direct database access. Add an authenticated, authorized history API only if you need a user-facing history feature.

## Configure

Set these environment variables on the backend host (not in the frontend build):

```env
MONGODB_URI=mongodb+srv://<db-user>:<encoded-password>@<cluster-host>/<database>?retryWrites=true&w=majority
MONGODB_DB_NAME=nexusdrop
METADATA_RETENTION_DAYS=30
```

Create a MongoDB database user with only the permissions needed for the `nexusdrop` database's `transfer_metadata` collection. Restrict network access to the backend host, store the URI in the host's secret manager, and never commit it to GitHub or print it to logs. Use a separate local development database and rotate credentials if exposed. If MongoDB is configured but unreachable at startup, the backend deliberately fails to start instead of silently losing intended records.

For local use, copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI`; the `.env` file is ignored by Git. No MongoDB container or account is required for frontend/backend operation. The backend `/api/status` response reports only `metadataDatabase: true/false`, never the URI or database credentials.
