---
sidebar_position: 1
---

# Introduction to Ravioli

Welcome to the **Ravioli** documentation! 

Ravioli is a modern, high-performance local data warehouse tool powered by **DuckDB**. It helps data engineers build, test, and orchestrate SQL transformation pipelines on local files (Parquet, CSV, JSON) and remote databases seamlessly.

## Key Features

- ⚡ **Lightning Fast Execution**: Built on top of DuckDB, giving you vectorized execution speeds.
- 🥞 **Modular SQL Models**: Define models with standard SELECT queries and easily reference other models.
- 🛡️ **Built-in Quality Controls**: Declare constraints and data tests alongside your models.
- 🧩 **Zero Infrastructure Overhead**: Run everything locally on your machine with minimal config.

## Quick Start in 3 Steps

### 1. Initialize your project

Run the initializer script to bootstrap your directories and configure duckdb settings:

```bash
ravioli init my_dwh
cd my_dwh
```

### 2. Create your first model

Create a SQL model file `models/stg_users.sql`:

```sql
-- models/stg_users.sql
SELECT 
    id as user_id,
    name as user_name,
    email,
    created_at
FROM read_parquet('data/raw_users.parquet')
```

### 3. Run and compile

Transform and materialize your models into DuckDB tables:

```bash
ravioli run
```

Ready to learn more? Start customizing your own documentation by adding markdown files directly in the `docs/` folder!
