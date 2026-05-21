import { renderContent, loadInitialData } from './settings/interactions';
import { clearSettingsState } from './settings/state';

export function renderSettings() {
  clearSettingsState();
  const container = document.createElement('div');
  container.className = 'flex-1 ml-64 bg-surface-container-lowest flex flex-col h-full overflow-y-auto text-on-surface custom-scrollbar';

  renderContent(container);
  loadInitialData(container, renderContent);

  return container;
}
