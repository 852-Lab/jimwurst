# Ravioli Frontend Components

This directory contains the UI components and modular architecture for the Ravioli frontend.

## Architecture & Structure

We follow a strict separation of concerns within each component to maximize maintainability, testability, and clarity. Each major feature area is divided into the following files:

- \`[ComponentName].ts\`: The main entry point. Orchestrates the initial rendering of the UI and integrates with global state.
- \`interactions.ts\`: Handles all DOM events, user interactions, form submissions, and API integrations.
- \`templates.ts\`: Contains pure, declarative HTML string templates used to construct the UI.
- \`state.ts\` (optional): Manages isolated, component-level state (if the state shouldn't be global).
- \`utils.ts\` (optional): Component-specific utility functions (e.g., notebook parsing, knowledge block generation).

### Directory Layout

- \`create-analysis/\`: UI for bootstrapping new insights (Quick & Deep Dive modes).
- \`data/\`: Data source ingestion, management, and preview tables.
- \`governance/\`: User management, team administration, and intelligence verification workflows.
- \`insights/\`: The main dashboard for finalized insights, including lineage tracing trees.
- \`knowledge/\`: Notion-like knowledge base management with blocks and metadata.
- \`notebook/\`: Jupyter-like interface for interactive SQL/Python cells and rich rendering.
- \`settings/\`: Global application configurations, including AI Model (Ollama) and Data Warehouse (Motherduck) integrations.

## Shared Utilities (\`utils/\`)

To avoid duplicating common UI and security logic, we extract reusable patterns into the \`utils/\` directory.

### \`dom.ts\`
Provides standardized helpers for common DOM manipulations to ensure consistent UX and animations across the app.
- **\`withButtonLoading(btn, loadingHtml, callback)\`**: Wraps async operations. Disables the button, swaps in a loading state/spinner, executes the async task, and cleanly restores the button regardless of success or failure.
- **\`createModal(html)\` / \`closeModal(modalElement, removeDelay)\`**: Standardizes the creation and teardown of full-screen, backdrop-blurred modals with proper CSS animations (slide-in, zoom-in).
- **\`showInlineModal(modal)\` / \`hideInlineModal(modal)\`**: Manages inline panels using CSS opacity and translate transitions instead of raw \`display: none\`.
- **\`bindInlineEdit(container, onSave)\`**: Standardizes the "click-text-to-edit" pattern, converting a span into an input field on click and saving the value on blur/enter.

### \`security.ts\`
Shared helpers for preventing XSS and ensuring data injection safety.
- **\`escapeHTML(str)\`**: Sanitizes untrusted strings before rendering them into the DOM.
- **\`sanitizeImageUrl(url)\`**: Validates URLs to ensure they only contain safe protocols (http/https) and don't execute inline scripts.

## Adding a New Component

1. Create a new folder \`src/components/[feature-name]\`.
2. Define the pure HTML in \`templates.ts\`.
3. Wire up the buttons, forms, and API calls in \`interactions.ts\`. Use \`withButtonLoading\` for any API calls!
4. Export the root \`render[Feature]()\` function from \`[Feature].ts\`.
5. Import and mount it in the main application router (\`main.ts\` or `Sidebar.ts`).
