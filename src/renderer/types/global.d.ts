import { ElectronAPI } from '../../shared/types';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    electronEvents: {
      onHeartbeat: (callback: (payload: import('../../shared/types').HeartbeatPayload) => void) => void;
      onFlushQueue: (callback: (queue: import('../../shared/types').HeartbeatPayload[]) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
