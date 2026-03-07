import { exec, execSync } from 'child_process';
import WebSocket, { WebSocketServer } from 'ws';
import * as http from 'http';
import * as os from 'os';
import { BrowserWindow } from 'electron';

const COLLAB_PORT = 1234;

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
}

export interface CollaborationStatus {
  isActive: boolean;
  mode: 'host' | 'client' | null;
  hostIp: string | null;
  port: number;
  connectedUsers: CollaborationUser[];
  networkName?: string;
}

class CollaborationManager {
  private wss: WebSocketServer | null = null;
  private httpServer: http.Server | null = null;
  private mainWindow: BrowserWindow | null = null;
  private status: CollaborationStatus = {
    isActive: false,
    mode: null,
    hostIp: null,
    port: COLLAB_PORT,
    connectedUsers: [],
    networkName: undefined,
  };

  constructor() {}

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Get the local IP address of the machine
   */
  getLocalIpAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  /**
   * Get all available network interfaces with their IPs
   */
  getNetworkInterfaces(): { name: string; ip: string }[] {
    const interfaces = os.networkInterfaces();
    const result: { name: string; ip: string }[] = [];
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          result.push({ name, ip: iface.address });
        }
      }
    }
    return result;
  }

  /**
   * Start a hosted network (Windows only)
   * This creates an ad-hoc network that other devices can connect to
   */
  async startHostedNetwork(ssid: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (process.platform !== 'win32') {
      return { 
        success: false, 
        error: 'Hosted network is only supported on Windows. On macOS/Linux, use your OS network sharing features.' 
      };
    }

    try {
      // Configure the hosted network
      execSync(`netsh wlan set hostednetwork mode=allow ssid="${ssid}" key="${password}"`, { encoding: 'utf-8' });
      
      // Start the hosted network
      execSync('netsh wlan start hostednetwork', { encoding: 'utf-8' });
      
      this.status.networkName = ssid;
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to start hosted network: ${(error as Error).message}` 
      };
    }
  }

  /**
   * Stop the hosted network (Windows only)
   */
  async stopHostedNetwork(): Promise<void> {
    if (process.platform !== 'win32') return;
    
    try {
      execSync('netsh wlan stop hostednetwork', { encoding: 'utf-8' });
      this.status.networkName = undefined;
    } catch (error) {
      // Network might not be running, ignore errors
      console.log('Stop hosted network:', (error as Error).message);
    }
  }

  /**
   * Start the WebSocket collaboration server (Host mode)
   */
  async startHost(userName: string): Promise<CollaborationStatus> {
    if (this.status.isActive) {
      throw new Error('Collaboration session already active');
    }

    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server for the WebSocket to attach to
        this.httpServer = http.createServer();
        
        // Create WebSocket server
        this.wss = new WebSocketServer({ server: this.httpServer });
        
        const connectedClients = new Map<WebSocket, CollaborationUser>();

        this.wss.on('connection', (ws: WebSocket) => {
          console.log('New collaboration client connected');
          
          ws.on('message', (data: Buffer) => {
            try {
              const message = JSON.parse(data.toString());
              
              // Handle user registration
              if (message.type === 'register') {
                const user: CollaborationUser = {
                  id: message.userId,
                  name: message.userName,
                  color: message.color,
                };
                connectedClients.set(ws, user);
                this.status.connectedUsers = Array.from(connectedClients.values());
                
                // Notify all clients about the updated user list
                this.broadcastUserList();
                this.notifyStatusChange();
              }
              
              // Broadcast Yjs sync messages to all other clients
              if (message.type === 'yjs-sync') {
                this.wss?.clients.forEach((client) => {
                  if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(data);
                  }
                });
              }
            } catch (e) {
              // If not JSON, it's likely a Yjs binary message - broadcast it
              this.wss?.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(data);
                }
              });
            }
          });

          ws.on('close', () => {
            const user = connectedClients.get(ws);
            if (user) {
              console.log(`User ${user.name} disconnected`);
              connectedClients.delete(ws);
              this.status.connectedUsers = Array.from(connectedClients.values());
              this.broadcastUserList();
              this.notifyStatusChange();
            }
          });

          ws.on('error', (error) => {
            console.error('WebSocket error:', error);
          });
        });

        this.httpServer.listen(COLLAB_PORT, '0.0.0.0', () => {
          const localIp = this.getLocalIpAddress();
          
          this.status = {
            isActive: true,
            mode: 'host',
            hostIp: localIp,
            port: COLLAB_PORT,
            connectedUsers: [{
              id: 'host',
              name: userName,
              color: '#ffb61e',
            }],
            networkName: this.status.networkName,
          };
          
          console.log(`Collaboration server started on ${localIp}:${COLLAB_PORT}`);
          this.notifyStatusChange();
          resolve(this.status);
        });

        this.httpServer.on('error', (error) => {
          reject(new Error(`Failed to start server: ${error.message}`));
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Broadcast the current user list to all connected clients
   */
  private broadcastUserList(): void {
    const message = JSON.stringify({
      type: 'user-list',
      users: this.status.connectedUsers,
    });
    
    this.wss?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Notify the renderer about status changes
   */
  private notifyStatusChange(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('collaboration:statusChange', this.status);
    }
  }

  /**
   * Stop the collaboration session
   */
  async stopSession(): Promise<void> {
    // Close all WebSocket connections
    if (this.wss) {
      this.wss.clients.forEach((client) => {
        client.close();
      });
      this.wss.close();
      this.wss = null;
    }

    // Close HTTP server
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }

    // Stop hosted network if we created one
    await this.stopHostedNetwork();

    // Reset status
    this.status = {
      isActive: false,
      mode: null,
      hostIp: null,
      port: COLLAB_PORT,
      connectedUsers: [],
    };

    this.notifyStatusChange();
  }

  /**
   * Get current collaboration status
   */
  getStatus(): CollaborationStatus {
    return { ...this.status };
  }

  /**
   * Join a collaboration session as a client
   * Note: The actual Yjs WebSocket connection is handled in the renderer
   * This just updates the local status
   */
  joinAsClient(hostIp: string, userName: string): CollaborationStatus {
    this.status = {
      isActive: true,
      mode: 'client',
      hostIp,
      port: COLLAB_PORT,
      connectedUsers: [{
        id: 'self',
        name: userName,
        color: this.generateUserColor(),
      }],
    };
    
    this.notifyStatusChange();
    return this.status;
  }

  /**
   * Update connected users from client perspective
   */
  updateConnectedUsers(users: CollaborationUser[]): void {
    this.status.connectedUsers = users;
    this.notifyStatusChange();
  }

  /**
   * Generate a random color for user identification
   */
  private generateUserColor(): string {
    const colors = [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#84cc16', // lime
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

// Singleton instance
export const collaborationManager = new CollaborationManager();
