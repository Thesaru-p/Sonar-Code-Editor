import React from 'react';
import './Toolbar.css';

interface ToolbarProps {
  teamName: string;
  isOnline: boolean;
  onOpenFolder: () => void;
  onSave: () => void;
  onTogglePreview: () => void;
  showPreview: boolean;
  onLogout: () => void;
  isDirty: boolean;
}

export default function Toolbar({
  teamName, isOnline, onOpenFolder, onSave, onTogglePreview, showPreview, onLogout, isDirty
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-logo">⌨ DevWatch IDE</span>
        <button className="toolbar-btn" onClick={onOpenFolder} title="Open Folder">
          📁 Open
        </button>
        <button
          className={`toolbar-btn ${isDirty ? 'dirty' : ''}`}
          onClick={onSave}
          title="Save (Ctrl+S)"
        >
          💾 Save {isDirty ? '●' : ''}
        </button>
        <button
          className={`toolbar-btn ${showPreview ? 'active' : ''}`}
          onClick={onTogglePreview}
          title="Toggle Preview"
        >
          👁 Preview
        </button>
      </div>
      <div className="toolbar-right">
        <div className="connection-status">
          <span className={`dot ${isOnline ? 'online' : 'offline'}`} />
          <span className="status-text">{isOnline ? 'Online' : 'Offline'}</span>
        </div>
        <div className="team-badge">
          <span className="team-icon">👤</span>
          <span>{teamName}</span>
        </div>
        <button className="toolbar-btn logout-btn" onClick={onLogout}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
