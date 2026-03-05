import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileNode } from '../../../shared/types';
import './FileTree.css';

const FILE_ICONS: Record<string, string> = {
  ts: '🔷', tsx: '⚛️', js: '🟡', jsx: '⚛️', html: '🌐', css: '🎨',
  json: '📋', md: '📝', py: '🐍', rs: '🦀', go: '🐹', java: '☕',
  sh: '⚡', yml: '⚙️', yaml: '⚙️', png: '🖼️', jpg: '🖼️', svg: '🖼️',
  txt: '📄', env: '🔒', gitignore: '🔒',
};

function getIcon(node: FileNode): string {
  if (node.type === 'directory') return '📁';
  return FILE_ICONS[node.extension || ''] || '📄';
}

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  activeFilePath: string | null;
  onFileClick: (path: string, name: string) => void;
  onRefresh: () => void;
  workspaceRoot: string;
}

function FileTreeNode({ node, depth, activeFilePath, onFileClick, onRefresh, workspaceRoot }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const [children, setChildren] = useState<FileNode[]>(node.children || []);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(node.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const loadChildren = useCallback(async () => {
    if (node.type === 'directory') {
      const items = await window.electronAPI.fs.readDirectory(node.path);
      setChildren(items);
    }
  }, [node]);

  const toggleExpanded = async () => {
    if (node.type !== 'directory') return;
    if (!expanded) await loadChildren();
    setExpanded((v) => !v);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleNewFile = async () => {
    closeContextMenu();
    const dirPath = node.type === 'directory' ? node.path : node.path.split('/').slice(0, -1).join('/');
    const name = prompt('New file name:');
    if (name) {
      await window.electronAPI.fs.createFile(`${dirPath}/${name}`);
      onRefresh();
    }
  };

  const handleNewFolder = async () => {
    closeContextMenu();
    const dirPath = node.type === 'directory' ? node.path : node.path.split('/').slice(0, -1).join('/');
    const name = prompt('New folder name:');
    if (name) {
      await window.electronAPI.fs.createFolder(`${dirPath}/${name}`);
      onRefresh();
    }
  };

  const handleDelete = async () => {
    closeContextMenu();
    if (confirm(`Delete "${node.name}"?`)) {
      await window.electronAPI.fs.deleteItem(node.path);
      onRefresh();
    }
  };

  const startRename = () => {
    closeContextMenu();
    setRenaming(true);
    setTimeout(() => renameInputRef.current?.select(), 50);
  };

  const commitRename = async () => {
    setRenaming(false);
    if (newName !== node.name && newName.trim()) {
      const dir = node.path.split('/').slice(0, -1).join('/');
      await window.electronAPI.fs.renameItem(node.path, `${dir}/${newName.trim()}`);
      onRefresh();
    }
  };

  useEffect(() => {
    if (contextMenu) {
      const handler = () => closeContextMenu();
      window.addEventListener('click', handler);
      return () => window.removeEventListener('click', handler);
    }
  }, [contextMenu]);

  const isActive = node.type === 'file' && node.path === activeFilePath;

  return (
    <div className="tree-node-wrapper">
      <div
        className={`tree-node ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (node.type === 'file') onFileClick(node.path, node.name);
          else toggleExpanded();
        }}
        onContextMenu={handleContextMenu}
      >
        {node.type === 'directory' && (
          <span className="expand-icon">{expanded ? '▾' : '▸'}</span>
        )}
        <span className="file-icon">{getIcon(node)}</span>
        {renaming ? (
          <input
            ref={renameInputRef}
            className="rename-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="file-name">{node.name}</span>
        )}
      </div>

      {node.type === 'directory' && expanded && (
        <div className="tree-children">
          {children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFilePath={activeFilePath}
              onFileClick={onFileClick}
              onRefresh={onRefresh}
              workspaceRoot={workspaceRoot}
            />
          ))}
          {children.length === 0 && (
            <div className="tree-empty" style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}>
              Empty folder
            </div>
          )}
        </div>
      )}

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {node.type === 'directory' && <button onClick={handleNewFile}>New File</button>}
          {node.type === 'directory' && <button onClick={handleNewFolder}>New Folder</button>}
          <button onClick={startRename}>Rename</button>
          <div className="context-divider" />
          <button className="danger" onClick={handleDelete}>Delete</button>
        </div>
      )}
    </div>
  );
}

interface FileTreeProps {
  workspaceRoot: string | null;
  onOpenFolder: () => void;
  onFileClick: (path: string, name: string) => void;
  activeFilePath: string | null;
}

export default function FileTree({ workspaceRoot, onOpenFolder, onFileClick, activeFilePath }: FileTreeProps) {
  const [rootNodes, setRootNodes] = useState<FileNode[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    if (!workspaceRoot) return;
    window.electronAPI.fs.readDirectory(workspaceRoot).then(setRootNodes);
  }, [workspaceRoot, refreshKey]);

  if (!workspaceRoot) {
    return (
      <div className="file-tree empty-tree">
        <div className="tree-header">EXPLORER</div>
        <div className="open-folder-prompt">
          <p>No folder opened</p>
          <button className="open-folder-btn" onClick={onOpenFolder}>
            Open Folder
          </button>
        </div>
      </div>
    );
  }

  const rootName = workspaceRoot.split('/').pop() || workspaceRoot;

  return (
    <div className="file-tree">
      <div className="tree-header">
        <span>EXPLORER</span>
        <button className="tree-refresh-btn" onClick={refresh} title="Refresh">↻</button>
      </div>
      <div className="tree-root-label">{rootName.toUpperCase()}</div>
      <div className="tree-content">
        {rootNodes.map((node) => (
          <FileTreeNode
            key={node.path}
            node={node}
            depth={0}
            activeFilePath={activeFilePath}
            onFileClick={onFileClick}
            onRefresh={refresh}
            workspaceRoot={workspaceRoot}
          />
        ))}
      </div>
    </div>
  );
}
