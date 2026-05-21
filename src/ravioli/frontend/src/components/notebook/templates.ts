import MarkdownIt from 'markdown-it';
import Chart from 'chart.js/auto';
import hljs from 'highlight.js';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight: function (str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' +
               hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
               '</code></pre>';
      } catch (__) {}
    }

    return ''; // use external default escaping
  }
});

export function renderMarkdown(content: string) {
  if (!content) return '';
  
  // Transform GitHub style alerts: > [!TYPE]
  // This regex matches the blockquote with alert marker
  let transformed = content.replace(/^> \\[!(IMPORTANT|NOTE|TIP|WARNING|CAUTION)\\]\n((?:>.*\n?)+)/gm, (_match, type, body) => {
    const lowerType = type.toLowerCase();
    const icon = type === 'IMPORTANT' ? 'priority_high' : 'info';
    // Remove the leading '>' from each line of the body
    const cleanBody = body.split('\n').map((line: string) => line.replace(/^>\s?/, '')).join('\n');
    return `
<div class="markdown-alert markdown-alert-${lowerType}">
  <div class="markdown-alert-title">
    <span class="material-symbols-outlined text-sm" data-icon="${icon}">${icon}</span>
    <span>${type}</span>
  </div>
  <div class="markdown-alert-content">
    ${md.render(cleanBody.trim())}
  </div>
</div>
`;
  });

  return md.render(transformed);
}

export function renderChart(canvasId: string, vizData: any) {
  const ctx = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!ctx) return;

  new Chart(ctx, {
    type: vizData.chart_type,
    data: vizData.data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 10 }
          }
        },
        title: {
          display: true,
          text: vizData.title,
          color: '#f8fafc',
          font: { family: 'Inter', size: 14, weight: 'bold' }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', font: { size: 10 } }
        }
      }
    }
  });
}

export function renderRichOutput(output: any): string {
  if (!output) return '';
  
  if (output.type === 'stream') {
    const isStderr = output.name === 'stderr';
    const textColor = isStderr ? 'text-rose-400' : 'text-neutral-300';
    return `
      <div class="font-mono text-xs ${textColor} bg-surface-container-lowest/40 p-3 rounded-lg border border-outline-variant/5 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        ${output.text}
      </div>
    `;
  }
  
  if (output.type === 'execute_result' || output.type === 'display_data') {
    const data = output.data || {};
    if (data['image/png']) {
      return `
        <div class="mt-2 glass-panel p-4 rounded-2xl border-outline-variant/10 bg-surface-container-lowest/30 flex justify-center overflow-hidden">
          <img src="data:image/png;base64,${data['image/png'].trim()}" alt="Plot Output" class="max-w-full h-auto rounded-lg" />
        </div>
      `;
    }
    if (data['text/html']) {
      return `
        <div class="mt-2 overflow-x-auto custom-scrollbar bg-surface-container-lowest/50 rounded-2xl border border-outline-variant/10 max-h-96">
          <div class="prose prose-invert max-w-none text-xs font-mono p-4 table-rendering-wrapper">
            ${data['text/html']}
          </div>
        </div>
      `;
    }
    if (data['text/plain']) {
      return `
        <div class="font-mono text-xs text-emerald-300 bg-surface-container-lowest/40 p-3 rounded-lg border border-outline-variant/5 overflow-x-auto whitespace-pre leading-relaxed">
          ${data['text/plain']}
        </div>
      `;
    }
  }
  
  if (output.type === 'error') {
    const traceback = output.traceback || [];
    const tracebackHtml = traceback.length > 0 
      ? `<div class="mt-2 p-3 font-mono text-[11px] bg-red-950/20 text-rose-300/80 rounded-lg border border-red-500/10 overflow-x-auto whitespace-pre leading-relaxed">${traceback.join('\n')}</div>`
      : '';
    return `
      <div class="mt-2 glass-panel p-4 rounded-2xl border-rose-500/20 bg-rose-500/5 text-rose-200">
        <div class="flex items-center gap-2 text-rose-400 font-bold text-sm">
          <span class="material-symbols-outlined text-lg">error</span>
          <span>${output.ename || 'Execution Error'}: ${output.evalue || 'Something went wrong'}</span>
        </div>
        ${tracebackHtml}
      </div>
    `;
  }
  
  if (output.type === 'table') {
    const rows = output.data || [];
    if (rows.length === 0) {
      return `
        <div class="flex flex-col items-center justify-center p-6 text-outline bg-surface-container-lowest/30 rounded-2xl border border-outline-variant/5">
          <span class="material-symbols-outlined text-3xl mb-1 opacity-40">draft</span>
          <span class="text-xs">No records returned</span>
        </div>
      `;
    }
    
    const keys = Object.keys(rows[0]);
    return `
      <div class="mt-2 overflow-x-auto custom-scrollbar bg-surface-container-lowest/50 rounded-2xl border border-outline-variant/10 max-h-96">
        <table class="w-full text-left border-collapse text-xs font-mono">
          <thead class="bg-surface-container-highest text-xs uppercase tracking-wider text-primary sticky top-0 shadow-sm z-10">
            <tr>
              ${keys.map(k => `<th class="px-4 py-2.5 font-medium whitespace-nowrap border-b border-primary/20">${k}</th>`).join('')}
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/10">
            ${rows.map((row: any) => `
              <tr class="hover:bg-surface-container-low/70 transition-colors">
                ${keys.map(k => {
                  let val = row[k];
                  if (val === null || val === undefined) return '<td class="px-4 py-2 text-outline/40 italic text-[11px]">null</td>';
                  if (typeof val === 'object') val = JSON.stringify(val);
                  return `<td class="px-4 py-2 text-on-surface-variant truncate max-w-sm" title="${val}">${val}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  
  return '';
}
