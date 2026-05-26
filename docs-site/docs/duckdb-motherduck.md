---
sidebar_position: 7
title: DuckDB & MotherDuck Integration
---

# DuckDB & MotherDuck Integration

Ravioli is built on a hybrid OLAP/OLTP architecture. Fast, relational transaction metadata (users, settings, logging) is managed in PostgreSQL, while all heavy analytical queries run in **DuckDB**—either locally on disk or synced to the cloud via **MotherDuck**.

```mermaid
graph LR
    subgraph Local Machine
        UI[Frontend UI] <--> API[FastAPI Backend]
        API <--> PG[(Postgres: Metadata)]
        API <--> LDB[(Local DuckDB: OLAP)]
    </td>
    subgraph Cloud
        API <-->|Secure Token| MD[(MotherDuck: Cloud OLAP)]
    end
```

---

## Local DuckDB Manager (`DuckDBManager`)

Ravioli uses a custom `DuckDBManager` to connect to and interact with the local `.duckdb` database file:

### Ephemeral Connection Pattern
DuckDB uses file-level locking, meaning only one process or thread can hold a write lock on a local database file at a time. To prevent API endpoints from blocking each other or causing database crashes, Ravioli uses an **ephemeral connection pattern**:
- Database operations open a connection, run their statements (query, table creation), and immediately close the connection.
- A context manager is provided via `duckdb_manager.connect()` to guarantee safety.
- An eager initialization thread (`_pre_init_duckdb`) fires during FastAPI startup to perform WAL replays and create the database file early.

---

## MotherDuck Cloud Integration

For collaborative analytics, dashboard hosting, or backing up local work, Ravioli provides a native integration with **MotherDuck** (DuckDB in the cloud).

### 1. Token Configuration & Connection
Users can add their MotherDuck API Token in the **Integrations** tab in settings. The token is encrypted using AES-256 before being saved to the PostgreSQL configuration tables.
When a token is present, `DuckDBManager` automatically initializes the MotherDuck extension during startup:
```sql
INSTALL motherduck;
LOAD motherduck;
SET motherduck_token='<decrypted_token>';
SET motherduck_attach_mode='multi';
```

### 2. Workspace Database Mounting
Ravioli automatically mounts the cloud database namespace:
- It creates a remote cloud database called `ravioli` if it does not exist.
- It attempts to attach it using the alias: `ATTACH 'md:ravioli' AS ravioli`.
- If the remote database is missing or deleted, it recreates it from scratch automatically.

### 3. Pushing and Pulling Tables
Endpoints exist to synchronize table data between local disk and the cloud:
- **Push**: Synchronizes local tables to MotherDuck using:
  `CREATE OR REPLACE TABLE ravioli."<schema>"."<table>" AS SELECT * FROM "<schema>"."<table>"`
- **Pull**: Synchronizes remote tables back to the local database file.
- **Diff Tracking**: Calculates differences in row counts between local and remote using the SQL `EXCEPT` clause to show additions and deletions.

### 4. Bulk Sanitized Upload (Non-PII Push)
To prevent sensitive PII data from leaking into the cloud, Ravioli implements a bulk push pattern:
1. A clean, temporary database is attached: `ATTACH 'temp_clean.duckdb' AS temp_clean_db`.
2. Only tables explicitly marked as containing **no PII** are copied into the temporary database.
3. The temporary database is detached.
4. The entire cleaned database file is uploaded to MotherDuck in a single block upload:
   `CREATE OR REPLACE DATABASE "ravioli" FROM 'temp_clean.duckdb'`
5. The temporary file is safely purged from local disk.
