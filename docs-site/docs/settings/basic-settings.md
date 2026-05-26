---
sidebar_position: 1
title: Basic Settings
---

# Basic Settings

The **Basic Settings** page handles individual user configuration, profile details, and personalization configurations. It allows team members to manage their identity and custom interaction preferences within the Ravioli platform.

---

## User Profile Configuration

The **General** tab of the settings menu provides self-service management of the active profile:

- **User Name**: The display name of the user, used across the system for logging attribution, comment feeds, and activity summaries.
- **Work Email**: The primary corporate email address used for identification, authenticating external integrations, and routing alerts.
- **Profile Signature**: Automatic metadata attachments that are appended to any generated draft insights or comments for audit purposes.

### Profile Updates (UI Interaction)

To update your display name:
1. Navigate to the **Settings** menu via the sidebar.
2. Select the **General** tab.
3. Edit the **Name** input field.
4. Click **Save Profile**. The UI will display a temporary confirmation spinner and update your profile state globally across all active dashboards.

---

## Personal Prompts & AI Customization

A core component of individual productivity is defining how the AI analyst, **Kowalski**, communicates with you.

### Personal Prompts (Upcoming)

This planned feature allows users to define custom persona rules and model instructions at the user level. It enables individual analysts to shape AI response characteristics without altering system-wide policies:

- **Style Directives**: Force Kowalski to respond in specific formats (e.g., "Use bullet points and summaries", "Output raw DuckDB SQL first, followed by explanation", or "Structure findings like a formal executive brief").
- **Statistical Thresholds**: Set default confidence interval requirements for data claims (e.g., "Flag any statistical claims with a p-value > 0.05").
- **Context Grounding**: Specify individual interest areas or default schemas to prioritize when generating code cells or quick insights.
