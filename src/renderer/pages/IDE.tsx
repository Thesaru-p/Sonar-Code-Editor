import React, { useState, useEffect, useCallback } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { useAuth } from '../context/AuthContext';
import FileTree from '../components/FileTree/FileTree';
import EditorPanel from '../components/Editor/EditorPanel';
import PreviewPanel from '../components/Preview/PreviewPanel';
import Toolbar from '../components/Sidebar/Toolbar';
import { useMonitoring } from '../hooks/useMonitoring';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import './IDE.css';

export interface OpenTab {
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  language: string;
}

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  html: 'html', css: 'css', json: 'json', md: 'markdown',
  py: 'python', rs: 'rust', go: 'go', java: 'java', c: 'c', cpp: 'cpp',
  sh: 'shell', yml: 'yaml', yaml: 'yaml', xml: 'xml', sql: 'sql',
};

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return LANGUAGE_MAP[ext] || 'plaintext';
}

export default function IDE() {
  const { user, logout } = useAuth();
  const isOnline = useNetworkStatus();
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  useMonitoring(user, isOnline, activeTabPath || '');

  const activeTab = tabs.find((t) => t.path === activeTabPath) || null;

  const openFile = useCallback(async (filePath: string, fileName: string) => {
    const existing = tabs.find((t) => t.path === filePath);
    if (existing) {
      setActiveTabPath(filePath);
      return;
    }
    try {
      const content = await window.electronAPI.fs.readFile(filePath);
      const tab: OpenTab = {
        path: filePath,
        name: fileName,
        content,
        isDirty: false,
        language: getLanguage(fileName),
      };
      setTabs((prev) => [...prev, tab]);
      setActiveTabPath(filePath);
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  }, [tabs]);

  const closeTab = useCallback((path: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === path);
      const next = prev.filter((t) => t.path !== path);
      if (activeTabPath === path) {
        const newActive = next[Math.min(idx, next.length - 1)]?.path || null;
        setActiveTabPath(newActive);
      }
      return next;
    });
  }, [activeTabPath]);

  const saveFile = useCallback(async () => {
    if (!activeTab) return;
    try {
      await window.electronAPI.fs.writeFile(activeTab.path, activeTab.content);
      setTabs((prev) => prev.map((t) =>
        t.path === activeTab.path ? { ...t, isDirty: false } : t
      ));
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  }, [activeTab]);

  const updateContent = useCallback((path: string, content: string) => {
    setTabs((prev) => prev.map((t) =>
      t.path === path ? { ...t, content, isDirty: true } : t
    ));
  }, []);

  const openFolder = useCallback(async () => {
    const folderPath = await window.electronAPI.fs.openFolderDialog();
    if (folderPath) setWorkspaceRoot(folderPath);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeTabPath) closeTab(activeTabPath);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveFile, closeTab, activeTabPath]);

  return (
    <div className="ide-container">
      <Toolbar
        teamName={user?.teamName || ''}
        isOnline={isOnline}
        onOpenFolder={openFolder}
        onSave={saveFile}
        onTogglePreview={() => setShowPreview((v) => !v)}
        showPreview={showPreview}
        onLogout={logout}
        isDirty={activeTab?.isDirty || false}
      />
      <div className="ide-body">
        <PanelGroup direction="horizontal" autoSaveId="ide-layout">
          <Panel defaultSize={20} minSize={15} maxSize={40}>
            <FileTree
              workspaceRoot={workspaceRoot}
              onOpenFolder={openFolder}
              onFileClick={openFile}
              activeFilePath={activeTabPath}
            />
          </Panel>
          <PanelResizeHandle className="resize-handle" />
          <Panel defaultSize={showPreview ? 50 : 80} minSize={30}>
            <EditorPanel
              tabs={tabs}
              activeTabPath={activeTabPath}
              onTabClick={setActiveTabPath}
              onTabClose={closeTab}
              onContentChange={updateContent}
              onSave={saveFile}
            />
          </Panel>
          {showPreview && (
            <>
              <PanelResizeHandle className="resize-handle" />
              <Panel defaultSize={30} minSize={20}>
                <PreviewPanel activeTab={activeTab} allTabs={tabs} />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
}
