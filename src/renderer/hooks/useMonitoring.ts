import { useEffect, useRef } from 'react';
import { Team } from '../../shared/types';
import { createActivityLog, upsertSession, updateSessionLastSeen } from '../services/appwrite';
import { enqueueLog, getQueue, clearQueue } from '../services/localStore';
import { HeartbeatPayload } from '../../shared/types';

export function useMonitoring(user: Team | null, isOnline: boolean, currentFile: string) {
  const currentFileRef = useRef(currentFile);

  useEffect(() => {
    currentFileRef.current = currentFile;
    if (window.electronAPI?.monitoring) {
      window.electronAPI.monitoring.setCurrentFile(currentFile);
    }
  }, [currentFile]);

  useEffect(() => {
    if (!user) return;

    // Start monitoring
    if (window.electronAPI?.monitoring) {
      window.electronAPI.monitoring.start(user.teamName, user.$id!);
    }

    // Listen to heartbeats from main process
    const eventsAPI = (window as unknown as { electronEvents?: { onHeartbeat: (cb: (p: HeartbeatPayload) => void) => void; onFlushQueue: (cb: (q: HeartbeatPayload[]) => void) => void; removeAllListeners: (ch: string) => void } }).electronEvents;

    if (eventsAPI) {
      eventsAPI.onHeartbeat(async (payload: HeartbeatPayload) => {
        if (isOnline) {
          await createActivityLog(payload);
          await updateSessionLastSeen(payload.teamId);
        } else {
          enqueueLog({ type: 'activityLog', payload, queuedAt: new Date().toISOString() });
        }
      });

      eventsAPI.onFlushQueue(async (queue: HeartbeatPayload[]) => {
        for (const item of queue) {
          if (isOnline) {
            await createActivityLog(item).catch(() => {});
          }
        }
      });
    }

    return () => {
      if (eventsAPI) {
        eventsAPI.removeAllListeners('monitoring:heartbeat');
        eventsAPI.removeAllListeners('monitoring:flushQueue');
      }
      if (window.electronAPI?.monitoring) {
        window.electronAPI.monitoring.stop();
      }
    };
  }, [user]);

  // Flush offline queue on reconnect
  useEffect(() => {
    if (!isOnline || !user) return;
    const queue = getQueue();
    if (queue.length === 0) return;
    (async () => {
      for (const item of queue) {
        if (item.type === 'activityLog') {
          await createActivityLog(item.payload as HeartbeatPayload).catch(() => {});
        }
      }
      clearQueue();
    })();
  }, [isOnline, user]);
}
