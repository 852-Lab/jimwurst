---
sidebar_position: 3
title: DLT Ingestion
---

# DLT Ingestion

:::info Upcoming Feature
Additional personal and corporate connectors are currently on the upcoming roadmap. This page outlines the planned pipeline architectures.
:::

Ravioli plans to leverage the **dlt** (data load tool) library to support schema-evolution-resilient pipelines.

---

## Planned Connectors

- **Apple Health**: Workout tracks, active energy levels, and heart rate distributions.
- **Spotify**: Streaming lists, favorite tracks, and listening durations.
- **LinkedIn**: Personal network growth statistics, profile views, and message volumes.
- **Substack**: Subscriber counts, email open rates, and click engagement logs.

---

## Schema Orchestration

- **Namespace Isolation**: Each connector will load data into isolated schemas (e.g. `s_spotify`) to avoid database catalog collisions.
- **Progress SSE**: Long-running API extractions will stream progress steps using Server-Sent Events (SSE).
