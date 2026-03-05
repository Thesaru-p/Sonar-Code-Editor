import React, { useRef, useEffect, useState, useCallback } from 'react';
import { OpenTab } from '../../pages/IDE';
import './PreviewPanel.css';

interface PreviewPanelProps {
  activeTab: OpenTab | null;
  allTabs?: OpenTab[];
}

/**
 * Resolve relative `<script src="...">` and `<link href="...">` references
 * by reading the files from disk and inlining their content.
 * This is necessary because `srcDoc` iframes have no base URL.
 */
async function resolveRelativeAssets(
  html: string,
  filePath: string,
  openTabs: OpenTab[],
): Promise<string> {
  // Get directory of the current HTML file
  const dir = filePath.substring(0, filePath.lastIndexOf('/'));

  // Helper: resolve a relative path against the HTML file's directory
  const resolve = (rel: string) => {
    if (rel.startsWith('http://') || rel.startsWith('https://') || rel.startsWith('data:') || rel.startsWith('blob:')) {
      return null; // skip absolute URLs
    }
    // Simple path resolution
    const parts = dir.split('/');
    for (const seg of rel.split('/')) {
      if (seg === '..') parts.pop();
      else if (seg !== '.' && seg !== '') parts.push(seg);
    }
    return parts.join('/');
  };

  // Helper: read file content — check open tabs first, then disk
  const readContent = async (absPath: string): Promise<string | null> => {
    const tab = openTabs.find((t) => t.path === absPath);
    if (tab) return tab.content;
    try {
      return await window.electronAPI.fs.readFile(absPath);
    } catch {
      return null;
    }
  };

  let result = html;

  // Inline <script src="..."> tags
  const scriptRegex = /<script\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>\s*<\/script>/gi;
  const scriptMatches = [...html.matchAll(scriptRegex)];
  for (const match of scriptMatches) {
    const relPath = match[2];
    const absPath = resolve(relPath);
    if (!absPath) continue;
    const content = await readContent(absPath);
    if (content !== null) {
      result = result.replace(match[0], `<script>\n${content}\n</script>`);
    }
  }

  // Inline <link rel="stylesheet" href="..."> tags
  const linkRegex = /<link\s+([^>]*?)href=["']([^"']+)["']([^>]*?)\/?>/gi;
  const linkMatches = [...html.matchAll(linkRegex)];
  for (const match of linkMatches) {
    const fullTag = match[0];
    // Only inline stylesheet links
    if (!/rel=["']stylesheet["']/i.test(fullTag)) continue;
    const relPath = match[2];
    const absPath = resolve(relPath);
    if (!absPath) continue;
    const content = await readContent(absPath);
    if (content !== null) {
      result = result.replace(match[0], `<style>\n${content}\n</style>`);
    }
  }

  return result;
}

/** Inject a console forwarder so iframe console output appears in DevTools */
function injectConsoleForwarder(html: string): string {
  const script = `<script>
(function() {
  var _log = console.log, _warn = console.warn, _error = console.error, _info = console.info;
  function send(level, args) {
    try { window.parent.postMessage({ __preview_console: true, level: level, args: Array.from(args).map(function(a) { try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return String(a); } }) }, '*'); } catch(e) {}
  }
  console.log   = function() { send('log',   arguments); return _log.apply(console, arguments); };
  console.warn  = function() { send('warn',  arguments); return _warn.apply(console, arguments); };
  console.error = function() { send('error', arguments); return _error.apply(console, arguments); };
  console.info  = function() { send('info',  arguments); return _info.apply(console, arguments); };
})();
</script>`;
  // Insert right after <head> or at the beginning
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => m + '\n' + script);
  }
  return script + '\n' + html;
}

export default function PreviewPanel({ activeTab, allTabs = [] }: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [resolvedHtml, setResolvedHtml] = useState<string>('');
  const [key, setKey] = useState(0);

  const isHtml = activeTab?.language === 'html';
  const isCss = activeTab?.language === 'css';

  // Resolve assets and update preview (debounced)
  useEffect(() => {
    if (!activeTab || (!isHtml && !isCss)) {
      setResolvedHtml('');
      return;
    }

    const timer = setTimeout(async () => {
      let html: string;
      if (isHtml) {
        html = await resolveRelativeAssets(activeTab.content, activeTab.path, allTabs);
      } else {
        html = `<!DOCTYPE html><html><head><style>${activeTab.content}</style></head><body><p style="font-family: sans-serif; padding: 20px; color: #666">CSS Preview — add HTML to see full layout</p></body></html>`;
      }
      html = injectConsoleForwarder(html);
      setResolvedHtml(html);
      setKey((k) => k + 1);
    }, 800);

    return () => clearTimeout(timer);
  }, [activeTab?.content, activeTab?.path, isHtml, isCss]);

  // Listen for console messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data && e.data.__preview_console) {
        const { level, args } = e.data;
        const prefix = '[Preview]';
        (console as any)[level]?.(prefix, ...args);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const refresh = useCallback(() => {
    setKey((k) => k + 1);
  }, []);

  if (!activeTab) {
    return (
      <div className="preview-panel empty">
        <div className="preview-empty">
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>👁</div>
          <p>No file selected</p>
          <small>Open an HTML file to see a live preview</small>
        </div>
      </div>
    );
  }

  if (!isHtml && !isCss) {
    return (
      <div className="preview-panel empty">
        <div className="preview-empty">
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>👁</div>
          <p>Preview not available</p>
          <small>Open an HTML or CSS file for live preview</small>
        </div>
      </div>
    );
  }

  return (
    <div className="preview-panel">
      <div className="preview-toolbar">
        <span className="preview-title">Live Preview — {activeTab.name}</span>
        <button className="preview-refresh-btn" onClick={refresh} title="Refresh">↻</button>
      </div>
      <div className="preview-content">
        <iframe
          key={key}
          ref={iframeRef}
          className="preview-iframe"
          srcDoc={resolvedHtml}
          sandbox="allow-scripts allow-modals allow-same-origin allow-forms"
          title="Preview"
        />
      </div>
    </div>
  );
}
