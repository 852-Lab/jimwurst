# Insights Domain Architecture

This document describes the structure and domain modeling of Insights within Ravioli.

## What is an Insight?

An **Insight** is the finalized, distilled output generated from an **Analysis** (such as a Notebook or Quick Insight session). 

While an **Analysis** is the active "workspace" or sandbox where a user explores data, chats with the AI, writes SQL, and runs Python code, an **Insight** represents the curated result, report, or conclusion derived from that exploration.

Insights are published to the global Insights dashboard (Feed & Summary) and form the company's shared intelligence layer.

## Governance and Review Queue

Before an Insight can be published for broader consumption (i.e., visible to teams other than the owner), it must go through a **Review Queue**. System administrators or designated reviewers must verify and approve the Insight to ensure accuracy and compliance before it becomes part of the shared intelligence layer.

## Lineage Tracking

Insights maintain strict **Lineage** tracing. Through the lineage map, an Insight can be traced back to:
- The exact **Analysis** session that generated it.
- The **Data Sources** (e.g., tables, warehouses) used during the analysis.
- The **Knowledge Pages** (context, wiki docs) that informed the AI's understanding.

