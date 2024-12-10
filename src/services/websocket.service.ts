import WebSocket from 'ws';
import { Server } from 'http';
import { verify } from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

interface WebSocketClient extends WebSocket {
  isAlive: boolean;
  userId?: string;
}

class WebSocketService {
  private wss: WebSocket;
  private clients: Map<string, Set<WebSocketClient>>;

  constructor(server: Server) {
    this.wss = new WebSocket({ server });
    this.clients = new Map();

    this.init();
  }

  private init() {
    this.wss.on('connection', (ws: WebSocketClient, req) => {
      ws.isAlive = true;

      // Handle authentication
      const token = this.extractToken(req.url);
      if (!token) {
        ws.close(1008, 'Authentication required');
        return;
      }

      try {
        // Verify token (replace with your token verification logic)
        const decoded = verify(token, process.env.JWT_SECRET!);
        ws.userId = decoded.sub as string;

        // Add client to clients map
        if (!this.clients.has(ws.userId)) {
          this.clients.set(ws.userId, new Set());
        }
        this.clients.get(ws.userId)!.add(ws);

        // Handle ping/pong
        ws.on('pong', () => {
          ws.isAlive = true;
        });

        // Handle client disconnect
        ws.on('close', () => {
          if (ws.userId) {
            const userClients = this.clients.get(ws.userId);
            if (userClients) {
              userClients.delete(ws);
              if (userClients.size === 0) {
                this.clients.delete(ws.userId);
              }
            }
          }
        });

      } catch (error) {
        console.error('WebSocket authentication error:', error);
        ws.close(1008, 'Invalid token');
      }
    });

    // Ping clients periodically
    setInterval(() => {
      this.wss.clients.forEach((ws: WebSocketClient) => {
        if (!ws.isAlive) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  // Extract token from WebSocket URL
  private extractToken(url: string = ''): string | null {
    const match = url.match(/token=([^&]*)/);
    return match ? match[1] : null;
  }

  // Send update to specific user
  public sendToUser(userId: string, event: string, data: any) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const message = JSON.stringify({ event, data });
      userClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }

  // Send update to all connected clients
  public broadcast(event: string, data: any) {
    const message = JSON.stringify({ event, data });
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Send order update
  public sendOrderUpdate(orderId: string, status: string, customerId: string) {
    this.sendToUser(customerId.toString(), 'orderUpdate', {
      orderId,
      status,
      timestamp: new Date().toISOString()
    });
  }
}

export default WebSocketService;
