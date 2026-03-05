import * as fs from 'fs';
import * as path from 'path';
import { IpcMain, Dialog } from 'electron';
import { FileNode } from '../shared/types';
import { IPC_CHANNELS } from '../shared/constants';

function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function readDirectoryRecursive(dirPath: string, deep = false): FileNode[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries
    .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
    .map((entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return {
          name: entry.name,
          type: 'directory' as const,
          path: fullPath,
          children: deep ? readDirectoryRecursive(fullPath) : [],
        };
      } else {
        return {
          name: entry.name,
          type: 'file' as const,
          path: fullPath,
          extension: getExtension(entry.name),
        };
      }
    })
    .sort((a, b) => {
      if (a.type === 'directory' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
}

export function registerFsHandlers(ipcMain: IpcMain, dialog: Dialog): void {
  ipcMain.handle(IPC_CHANNELS.FS_READ_DIR, async (_event, dirPath: string) => {
    try {
      return readDirectoryRecursive(dirPath);
    } catch (err) {
      throw new Error(`Failed to read directory: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_READ_FILE, async (_event, filePath: string) => {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      throw new Error(`Failed to read file: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_WRITE_FILE, async (_event, filePath: string, content: string) => {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
    } catch (err) {
      throw new Error(`Failed to write file: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_CREATE_FILE, async (_event, filePath: string) => {
    try {
      fs.writeFileSync(filePath, '', 'utf-8');
    } catch (err) {
      throw new Error(`Failed to create file: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_CREATE_FOLDER, async (_event, folderPath: string) => {
    try {
      fs.mkdirSync(folderPath, { recursive: true });
    } catch (err) {
      throw new Error(`Failed to create folder: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_DELETE_ITEM, async (_event, itemPath: string) => {
    try {
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        fs.rmSync(itemPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(itemPath);
      }
    } catch (err) {
      throw new Error(`Failed to delete item: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_RENAME_ITEM, async (_event, oldPath: string, newPath: string) => {
    try {
      fs.renameSync(oldPath, newPath);
    } catch (err) {
      throw new Error(`Failed to rename item: ${(err as Error).message}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FS_OPEN_FOLDER_DIALOG, async (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender);
    try {
      const result = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory'],
        title: 'Open Folder',
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    } catch (err) {
      throw new Error(`Failed to open dialog: ${(err as Error).message}`);
    }
  });
}
