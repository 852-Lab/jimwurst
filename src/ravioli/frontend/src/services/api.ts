import type { User, UserRole, UserGroup, Analysis, AnalysisCreate, AnalysisLog, DataSource, QuickInsightResponse, WFSLayer, Insight, InsightStats, InsightsSummary, KnowledgePage, KnowledgePageCreate, KnowledgePageUpdate, LineageResponse } from '../types';

const API_BASE = '/api/v1';

export const api = {
  async listAnalyses(): Promise<Analysis[]> {
    const response = await fetch(`${API_BASE}/analyses/`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch analyses');
    return response.json();
  },

  async createAnalysis(data: AnalysisCreate): Promise<Analysis> {
    const response = await fetch(`${API_BASE}/analyses/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to create analysis');
    return response.json();
  },

  async approveAnalysis(id: string): Promise<Analysis> {
    const response = await fetch(`${API_BASE}/analyses/${id}/approve`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to approve analysis');
    return response.json();
  },

  async deleteAnalysis(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/analyses/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to delete analysis');
  },

  async listLogs(analysisId: string): Promise<AnalysisLog[]> {
    const response = await fetch(`${API_BASE}/analysis-logs/analysis/${analysisId}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch logs');
    return response.json();
  },

  async askQuestion(analysisId: string, question: string): Promise<void> {
    const response = await fetch(`${API_BASE}/analyses/${analysisId}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to ask question');
  },
  
  streamQuestion(analysisId: string, question: string, replaceLogId: string | null, insertAfterLogId: string | null, onMessage: (token: string) => void, onComplete: () => void, onError: (err: any) => void) {
    let url = `${API_BASE}/analyses/${analysisId}/stream?question=${encodeURIComponent(question)}`;
    if (replaceLogId) {
      url += `&replace_log_id=${encodeURIComponent(replaceLogId)}`;
    }
    if (insertAfterLogId) {
      url += `&insert_after_log_id=${encodeURIComponent(insertAfterLogId)}`;
    }
    const eventSource = new EventSource(url);
    
    eventSource.onmessage = (event) => {
      if (event.data === '[DONE]') {
        eventSource.close();
        onComplete();
      } else {
        onMessage(event.data);
      }
    };
    
    eventSource.onerror = (err) => {
      eventSource.close();
      onError(err);
    };

    return () => eventSource.close();
  },

  async executeSql(analysisId: string, code: string, replaceLogId: string | null, insertAfterLogId: string | null): Promise<any> {
    const response = await fetch(`${API_BASE}/analyses/${analysisId}/execute-sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, replace_log_id: replaceLogId, insert_after_log_id: insertAfterLogId }),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to execute SQL cell');
    return response.json();
  },

  async executePython(analysisId: string, code: string, replaceLogId: string | null, insertAfterLogId: string | null): Promise<any> {
    const response = await fetch(`${API_BASE}/analyses/${analysisId}/execute-python`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, replace_log_id: replaceLogId, insert_after_log_id: insertAfterLogId }),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to execute Python cell');
    return response.json();
  },
  
  async executeMarkdown(analysisId: string, code: string, replaceLogId: string | null, insertAfterLogId: string | null): Promise<any> {
    const response = await fetch(`${API_BASE}/analyses/${analysisId}/execute-markdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, replace_log_id: replaceLogId, insert_after_log_id: insertAfterLogId }),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to save Markdown cell');
    return response.json();
  },
  
  async getSuggestedPrompts(analysisId: string): Promise<string[]> {
    const response = await fetch(`${API_BASE}/analyses/${analysisId}/suggested-prompts`, { credentials: 'include' });
    if (!response.ok) return [];
    return response.json();
  },

  async getTablePreview(fullTableName: string): Promise<any[]> {
    const response = await fetch(`${API_BASE}/data/preview/${encodeURIComponent(fullTableName)}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch table preview');
    return response.json();
  },

  async getJupyterStatus(analysisId: string): Promise<{ status: string }> {
    const response = await fetch(`${API_BASE}/analyses/${analysisId}/jupyter-status`, { credentials: 'include' });
    if (!response.ok) return { status: 'not_started' };
    return response.json();
  },

  async generateQuickInsight(file: File): Promise<QuickInsightResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/analyses/quick-insight`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to generate quick insight');
    return response.json();
  },

  async generateQuickInsightFromExisting(fileId: string): Promise<QuickInsightResponse> {
    const response = await fetch(`${API_BASE}/analyses/quick-insight/existing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to generate quick insight');
    return response.json();
  },

  async listFiles(): Promise<DataSource[]> {
    const response = await fetch(`${API_BASE}/data/files`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch files');
    return response.json();
  },

  async uploadFile(file: File, context?: string): Promise<DataSource> {
    const formData = new FormData();
    formData.append('file', file);
    if (context) formData.append('context', context);

    const response = await fetch(`${API_BASE}/data/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to upload file');
    return response.json();
  },

  streamUpload(file: File, onLog: (msg: string) => void, context?: string): Promise<DataSource> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      if (context) formData.append('context', context);

      fetch(`${API_BASE}/data/upload-stream`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      }).then(async (response) => {
        if (!response.ok) throw new Error('Upload failed');
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        
        if (!reader) {
          reject(new Error('No response body'));
          return;
        }

        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';
          
          for (const chunk of chunks) {
            if (chunk.startsWith('data: ')) {
              const content = chunk.substring(6);
              if (content.startsWith('LOG:')) {
                onLog(content.substring(4));
              } else if (content.startsWith('PING:')) {
                // Keep-alive ping, just ignore or log to console
                console.debug('Stream PING: keep-alive');
              } else if (content.startsWith('DONE:')) {
                resolve(JSON.parse(content.substring(5)));
              } else if (content.startsWith('ERROR:')) {
                reject(new Error(content.substring(6)));
              }
            }
          }
        }
      }).catch(reject);
    });
  },

  async getPreview(tableName: string): Promise<any[]> {
    const response = await fetch(`${API_BASE}/data/preview/${tableName}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch preview');
    return response.json();
  },

  async deleteFile(fileId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/data/files/${fileId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to delete file');
  },

  async updateFileDescription(fileId: string, description: string): Promise<DataSource> {
    const response = await fetch(`${API_BASE}/data/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to update file description');
    return response.json();
  },

  async togglePIITag(fileId: string, hasPII: boolean): Promise<DataSource> {
    const response = await fetch(`${API_BASE}/data/files/${fileId}/pii`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ has_pii: hasPII }),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to update PII status');
    return response.json();
  },

  async generateFileDescription(fileId: string): Promise<DataSource> {
    const response = await fetch(`${API_BASE}/data/files/${fileId}/generate-description`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!response.ok) {
      let detail: string;
      try {
        const errorData = await response.json();
        detail = errorData.detail || response.statusText;
      } catch (e) {
        detail = response.statusText;
      }
      throw new Error(detail);
    }
    return response.json();
  },

  async getFileDiff(fileId: string): Promise<{total_local: number, total_remote: number, added: number, removed: number, status: string, error?: string}> {
    const response = await fetch(`${API_BASE}/data/files/${fileId}/diff`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch file diff');
    return response.json();
  },

  async syncFile(fileId: string, direction: 'push' | 'pull'): Promise<{total_local: number, total_remote: number, added: number, removed: number, status: string, error?: string}> {
    const response = await fetch(`${API_BASE}/data/files/${fileId}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Sync failed');
    return response.json();
  },

  async getSetting(key: string): Promise<any> {
    const response = await fetch(`${API_BASE}/settings/${key}`, { credentials: 'include' });
    if (response.status === 404) return { key, value: {} };
    if (!response.ok) throw new Error('Failed to fetch setting');
    return response.json();
  },

  async updateSetting(key: string, value: Record<string, any>): Promise<any> {
    const response = await fetch(`${API_BASE}/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to update setting');
    return response.json();
  },

  async testOllamaConnection(): Promise<{status: string, message: string, models?: string[]}> {
    const response = await fetch(`${API_BASE}/settings/ollama/test`, { credentials: 'include' });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Connection test failed');
    }
    return response.json();
  },

  async testMotherduckConnection(): Promise<{status: string, message: string}> {
    const response = await fetch(`${API_BASE}/settings/motherduck/test`, { credentials: 'include' });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Motherduck connection test failed');
    }
    return response.json();
  },

  async pushAllToMotherduck(): Promise<any> {
    const response = await fetch(`${API_BASE}/settings/motherduck/push`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Push all failed');
    return response.json();
  },

  async pullAllFromMotherduck(): Promise<any> {
    const response = await fetch(`${API_BASE}/settings/motherduck/pull`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Pull all failed');
    return response.json();
  },

  async getInsightStats(): Promise<InsightStats> {
    const response = await fetch(`${API_BASE}/insights/stats`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch insight stats');
    return response.json();
  },

  async getInsightsSummary(days: number): Promise<InsightsSummary> {
    const response = await fetch(`${API_BASE}/insights/summary?days=${days}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch insights summary');
    return response.json();
  },

  async getReviewQueue(): Promise<Insight[]> {
    const response = await fetch(`${API_BASE}/insights/review-queue`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch review queue');
    return response.json();
  },

  async getInsightsFeed(days: number = 30): Promise<Insight[]> {
    const response = await fetch(`${API_BASE}/insights/feed?days=${days}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch insights feed');
    return response.json();
  },

  async verifyInsight(id: string): Promise<Insight> {
    const response = await fetch(`${API_BASE}/insights/${id}/verify`, { method: 'PATCH', credentials: 'include' });
    if (!response.ok) throw new Error('Failed to verify insight');
    return response.json();
  },

  async rejectInsight(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/insights/${id}/reject`, { method: 'PATCH', credentials: 'include' });
    if (!response.ok) throw new Error('Failed to reject insight');
  },

  async getWFSLayers(url: string): Promise<WFSLayer[]> {
    const response = await fetch(`${API_BASE}/data/wfs/layers?url=${encodeURIComponent(url)}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch WFS layers');
    return response.json();
  },

  async ingestWFSLayer(url: string, layer?: string): Promise<DataSource> {
    const response = await fetch(`${API_BASE}/data/wfs/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, ...(layer ? { layer } : {}) }),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to ingest WFS layer');
    return response.json();
  },
  
  async listKnowledgePages(): Promise<KnowledgePage[]> {
    const response = await fetch(`${API_BASE}/knowledge/`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch knowledge pages');
    return response.json();
  },

  async getKnowledgePage(id: string): Promise<KnowledgePage> {
    const response = await fetch(`${API_BASE}/knowledge/${id}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch knowledge page');
    return response.json();
  },

  async createKnowledgePage(data: KnowledgePageCreate): Promise<KnowledgePage> {
    const response = await fetch(`${API_BASE}/knowledge/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to create knowledge page');
    return response.json();
  },

  async updateKnowledgePage(id: string, data: KnowledgePageUpdate): Promise<KnowledgePage> {
    const response = await fetch(`${API_BASE}/knowledge/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to update knowledge page');
    return response.json();
  },

  async deleteKnowledgePage(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/knowledge/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to delete knowledge page');
  },

  // --- Auth & User Management ---

  async login(credentials: { email: string, password: string }): Promise<User> {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      credentials: 'include'
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Login failed');
    }
    const user = await response.json();
    localStorage.setItem('ravioli_user', JSON.stringify(user));
    return user;
  },

  async signup(data: { name: string, email: string, password: string }): Promise<User> {
    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Signup failed');
    }
    const user = await response.json();
    localStorage.setItem('ravioli_user', JSON.stringify(user));
    return user;
  },

  async getMe(): Promise<User | null> {
    try {
      // First try to get user using cookie (browser sends it automatically)
      // If we have a stored user, we can pass email as backup, but the cookie is primary
      const stored = localStorage.getItem('ravioli_user');
      const cachedUser = stored ? JSON.parse(stored) : null;
      
      const url = cachedUser 
        ? `${API_BASE}/auth/me?email=${encodeURIComponent(cachedUser.email)}`
        : `${API_BASE}/auth/me`;
        
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('ravioli_user');
        }
        return null;
      }
      const updated = await response.json();
      localStorage.setItem('ravioli_user', JSON.stringify(updated));
      return updated;
    } catch {
      // Return cached user if offline
      const stored = localStorage.getItem('ravioli_user');
      return stored ? JSON.parse(stored) : null;
    }
  },

  logout() {
    localStorage.removeItem('ravioli_user');
    // Clear session cookie by setting past expiration
    document.cookie = "ravioli_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  },

  async listUsers(): Promise<User[]> {
    const response = await fetch(`${API_BASE}/users/`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },

  async createUser(data: { name: string, email: string, role: UserRole }): Promise<User> {
    const response = await fetch(`${API_BASE}/users/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to create user');
    }
    return response.json();
  },

  async updateUser(id: string, data: { name?: string, role?: string, status?: string }): Promise<User> {
    const response = await fetch(`${API_BASE}/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to update user');
    }
    return response.json();
  },

  async listGroups(): Promise<UserGroup[]> {
    const response = await fetch(`${API_BASE}/users/groups`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch groups');
    return response.json();
  },

  async createGroup(data: { name: string, description?: string }): Promise<UserGroup> {
    const response = await fetch(`${API_BASE}/users/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to create group');
    return response.json();
  },

  async updateGroup(id: string, data: { name?: string, description?: string }): Promise<UserGroup> {
    const response = await fetch(`${API_BASE}/users/groups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to update group');
    return response.json();
  },

  async deleteGroup(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/users/groups/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to delete group');
  },

  async listGroupMembers(groupId: string): Promise<User[]> {
    const response = await fetch(`${API_BASE}/users/groups/${groupId}/members`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch group members');
    return response.json();
  },

  async addGroupMember(groupId: string, userId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/users/groups/${groupId}/members/${userId}`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to add member to group');
  },

  async removeGroupMember(groupId: string, userId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/users/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to remove member from group');
  },

  async deleteUser(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to delete user');
    }
  },

  async getInsightsLineage(): Promise<LineageResponse> {
    const response = await fetch(`${API_BASE}/insights/lineage`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch insights lineage');
    return response.json();
  }
};


