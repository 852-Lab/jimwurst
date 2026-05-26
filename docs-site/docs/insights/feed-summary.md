---
sidebar_position: 1
title: Feed & Summary
---

# Feed & Summary

The **Insights Feed** aggregates all published and verified findings into a single, collaborative feed for business teams and analysts.

---

## Technical Endpoints

The frontend dashboard communicates with the following backend routers under `/api/v1/insights`:
- **`/feed?days=30`**: Returns a chronological list of insights published over the selected duration (defaults to 30 days). The feed returns content snippets, original file origins, and verification tags.
- **`/stats`**: Returns high-level metrics representing the status of the repository, including counts of total analyses run, active draft insights, and total verified insights published.

---

## Features

- **Attribution Cards**: Each insight displays display names (e.g., "Created by Kowalski, Verified by Jimmy Pang").
- **Asset Filtering**: Filter feed listings by data source type, owner role, or date range.
- **Direct Link back to Notebooks**: Click any insight card to open the custom notebook that originally compiled it.
