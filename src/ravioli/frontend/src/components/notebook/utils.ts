import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

export type CellType = 'python' | 'sql' | 'chat' | 'markdown';

export function parseCellType(value: string | null): CellType | null {
  return value === 'python' || value === 'sql' || value === 'chat' || value === 'markdown' ? value : null;
}

export function parseAfterLogId(value: string | null): string | null {
  if (!value) return null;
  if (value === '__first__') return value;
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : null;
}

export function highlightSQL(code: string): string {
  if (!code) return '';
  
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  const sqlRegex = /(--[^\n]*)|((['"])(?:[^\\]|\\.)*?\3)|(\b\d+\b)|(\b(?:SELECT|FROM|WHERE|AND|OR|NOT|LIMIT|OFFSET|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|JOIN|INNER|LEFT|RIGHT|OUTER|ON|GROUP|BY|ORDER|HAVING|AS|IN|IS|NULL|LIKE|ILIKE|WITH|UNION|ALL|CASE|WHEN|THEN|ELSE|END|COUNT|SUM|AVG|MIN|MAX|CAST|COALESCE|DISTINCT)\b)/gi;

  return html.replace(sqlRegex, (match, comment, stringVal, quote, numberVal, keyword) => {
    if (comment) {
      return `<span class="text-neutral-500 italic">${comment}</span>`;
    }
    if (stringVal) {
      return `<span class="text-emerald-400">${stringVal}</span>`;
    }
    if (numberVal) {
      return `<span class="text-amber-400">${numberVal}</span>`;
    }
    if (keyword) {
      return `<span class="text-sky-400 font-bold">${keyword}</span>`;
    }
    return match;
  });
}

export function highlightPython(code: string): string {
  if (!code) return '';

  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Order: comments, strings, numbers, decorators, keywords, builtins
  const pyRegex = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^\\"]|\\.)*"|'(?:[^\\']|\\.)*')|((?<!\\w)\\d+\\.?\\d*(?:[eE][+-]?\\d+)?(?![a-zA-Z_]))|(@[\\w.]+)|(\\b(?:False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\\b)|(\\b(?:abs|all|any|bool|bytes|callable|chr|dict|dir|divmod|enumerate|eval|exec|filter|float|format|getattr|globals|hasattr|hash|help|hex|id|input|int|isinstance|issubclass|iter|len|list|locals|map|max|memoryview|min|next|object|oct|open|ord|pow|print|property|range|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|vars|zip|pd|np|plt|con|df|execute|fetchone|fetchall|fetchdf|pl)\\b)/gm;

  return html.replace(pyRegex, (match, comment, stringVal, numberVal, decorator, keyword, builtin) => {
    if (comment)   return `<span class="text-neutral-500 italic">${comment}</span>`;
    if (stringVal) return `<span class="text-amber-300">${stringVal}</span>`;
    if (numberVal) return `<span class="text-violet-400">${numberVal}</span>`;
    if (decorator) return `<span class="text-pink-400">${decorator}</span>`;
    if (keyword)   return `<span class="text-sky-400 font-bold">${keyword}</span>`;
    if (builtin)   return `<span class="text-emerald-300">${builtin}</span>`;
    return match;
  });
}

export function toggleComment(textarea: HTMLTextAreaElement) {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  
  const before = value.substring(0, start);
  const after = value.substring(start);
  
  const lineStartIdx = before.lastIndexOf('\n') + 1;
  const nextNewline = after.indexOf('\n');
  const lineEndIdx = nextNewline !== -1 ? start + nextNewline : value.length;
  
  const currentLine = value.substring(lineStartIdx, lineEndIdx);
  
  let newLine: string;
  let offset: number;
  
  if (/^\s*--/.test(currentLine)) {
    newLine = currentLine.replace(/^(\s*)--\s?/, '$1');
    offset = newLine.length - currentLine.length;
  } else {
    newLine = currentLine.replace(/^(\s*)/, '$1-- ');
    offset = newLine.length - currentLine.length;
  }
  
  textarea.value = value.substring(0, lineStartIdx) + newLine + value.substring(lineEndIdx);
  
  textarea.selectionStart = start + (start >= lineStartIdx + (currentLine.match(/^\s*/)?.[0].length || 0) ? offset : 0);
  textarea.selectionEnd = end + (end >= lineStartIdx + (currentLine.match(/^\s*/)?.[0].length || 0) ? offset : 0);
}

export function updateLineNumbers(textarea: HTMLTextAreaElement) {
  const idStr = textarea.id.replace('cell-input-', '');
  const parent = textarea.closest('.glass-panel');
  if (parent) {
    const gutter = parent.querySelector(`#cell-gutter-${idStr}`) as HTMLElement;
    if (gutter) {
      const lines = textarea.value.split('\n');
      const lineNumbers = lines.map((_, i) => i + 1).join('\n');
      gutter.textContent = lineNumbers;
      gutter.scrollTop = textarea.scrollTop;
    }

    const highlight = parent.querySelector(`#cell-highlight-${idStr}`) as HTMLElement;
    if (highlight) {
      const tool = highlight.getAttribute('data-tool');
      if (tool === 'sql') {
        highlight.innerHTML = highlightSQL(textarea.value);
      } else if (tool === 'python') {
        highlight.innerHTML = highlightPython(textarea.value);
      } else {
        highlight.textContent = textarea.value;
      }
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    }
  }
}

export function updateLineGutterScroll(textarea: HTMLTextAreaElement) {
  const idStr = textarea.id.replace('cell-input-', '');
  const parent = textarea.closest('.glass-panel');
  if (parent) {
    const gutter = parent.querySelector(`#cell-gutter-${idStr}`) as HTMLElement;
    if (gutter) {
      gutter.scrollTop = textarea.scrollTop;
    }

    const highlight = parent.querySelector(`#cell-highlight-${idStr}`) as HTMLElement;
    if (highlight) {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    }
  }
}
