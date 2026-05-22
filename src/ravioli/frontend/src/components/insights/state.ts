import type { InsightsSummary, LineageResponse } from '../../types';

export const state = {
  activeDays: 7,
  activeView: 'feed' as 'feed' | 'lineage',
  summaryCache: new Map<number, InsightsSummary>(),
  currentLineageData: null as LineageResponse | null,
  selectedNodeId: null as string | null,
  focusedInsightId: null as string | null,
  maxUpstreamCount: 5,
  maxDownstreamCount: 5,
};

export const clearInsightsCache = () => {
  state.summaryCache.clear();
  state.currentLineageData = null;
  state.selectedNodeId = null;
  state.focusedInsightId = null;
  state.maxUpstreamCount = 5;
  state.maxDownstreamCount = 5;
};

export const DAY_OPTIONS = [1, 3, 7, 14, 28, 30];
