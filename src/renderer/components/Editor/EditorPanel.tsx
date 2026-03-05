import React from 'react';
import MonacoEditor from '@monaco-editor/react';
import { OpenTab } from '../../pages/IDE';
import './EditorPanel.css';

interface EditorPanelProps {
  tabs: OpenTab[];
  activeTabPath: string | null;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
  onContentChange: (path: string, content: string) => void;
  onSave: () => void;
}

const EDITOR_OPTIONS = {
  suggestOnTriggerCharacters: false,
  quickSuggestions: false,
  parameterHints: { enabled: false },
  wordBasedSuggestions: 'off' as const,
  acceptSuggestionOnEnter: 'off' as const,
  tabCompletion: 'off' as const,
  snippetSuggestions: 'none' as const,
  codeLens: false,
  minimap: { enabled: true },
  automaticLayout: true,
  fontSize: 14,
  lineHeight: 22,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
  fontLigatures: true,
  scrollBeyondLastLine: false,
  renderWhitespace: 'none' as const,
  cursorBlinking: 'smooth' as const,
  smoothScrolling: true,
  padding: { top: 12 },
};

export default function EditorPanel({
  tabs, activeTabPath, onTabClick, onTabClose, onContentChange, onSave
}: EditorPanelProps) {
  const activeTab = tabs.find((t) => t.path === activeTabPath);

  if (tabs.length === 0) {
    return (
      <div className="editor-panel empty">
        <div className="editor-empty-state">
          <div className="editor-empty-icon">⌨</div>
          <h3>No file open</h3>
          <p>Open a file from the file tree to start editing</p>
          <div className="editor-shortcuts">
            <div className="shortcut"><kbd>Ctrl</kbd>+<kbd>S</kbd> Save file</div>
            <div className="shortcut"><kbd>Ctrl</kbd>+<kbd>W</kbd> Close tab</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-panel">
      {/* Tab Bar */}
      <div className="tab-bar">
        {tabs.map((tab) => (
          <div
            key={tab.path}
            className={`tab ${tab.path === activeTabPath ? 'active' : ''}`}
            onClick={() => onTabClick(tab.path)}
          >
            <span className="tab-name">{tab.name}</span>
            {tab.isDirty && <span className="dirty-dot" title="Unsaved changes">●</span>}
            <button
              className="tab-close"
              onClick={(e) => { e.stopPropagation(); onTabClose(tab.path); }}
              title="Close"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Editor */}
      {activeTab && (
        <div className="editor-wrapper">
          <MonacoEditor
            height="100%"
            language={activeTab.language}
            value={activeTab.content}
            theme="vs-dark"
            options={EDITOR_OPTIONS}
            onChange={(value) => {
              if (value !== undefined) onContentChange(activeTab.path, value);
            }}
            path={activeTab.path}
          />
        </div>
      )}
    </div>
  );
}
