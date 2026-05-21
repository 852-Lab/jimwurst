import { store } from '../store';
import { getTableAndModalHTML } from './data/templates';
import { bindDataInteractions } from './data/interactions';

export function renderData() {
  const container = document.createElement('main');
  container.className = 'flex-1 ml-64 h-full overflow-y-auto bg-surface flex flex-col p-8 pt-12 relative';

  const sources = store.getDataSources();

  container.innerHTML = getTableAndModalHTML(sources);

  bindDataInteractions(container);
  
  return container;
}
