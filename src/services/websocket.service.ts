import WebSocket, { Server as WebSocketServer } from 'ws';
import { Server } from 'http';
import { verify } from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

interface WebSocketClient extends WebSocket {
  isAlive: boolean;
  userId?: string;
}

class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, Set<WebSocketClient>>;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server });
    this.clients = new Map();

    this.init();
  }

  private init() {
    this.wss.on('connection', async (ws: WebSocketClient, req) => {
      ws.isAlive = true;

      try {
        // Handle authentication
        const token = this.extractToken(req.url);
        if (!token) {
          ws.close(1008, 'Authentication required');
          return;
        }

        // Verify token
        const decoded = verify(token, process.env.JWT_SECRET!);
        ws.userId = decoded.sub as string;

        // Validate user exists
        const user = await prisma.user.findUnique({
          where: { id: ws.userId }
        });

        if (!user) {
          ws.close(1008, 'User not found');
          return;
        }

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
          this.removeClient(ws);
        });

        // Handle errors
        ws.on('error', (error) => {
          console.error('WebSocket client error:', error);
          this.removeClient(ws);
        });

      } catch (error) {
        console.error('WebSocket authentication error:', error);
        ws.close(1008, 'Invalid token');
      }
    });

    // Ping clients periodically and clean up dead connections
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocketClient) => {
        if (!ws.isAlive) {
          this.removeClient(ws);
          return;
        }
        ws.isAlive = false;
        ws.ping((error) => {
          if (error) this.removeClient(ws);
        });
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  private removeClient(ws: WebSocketClient) {
    if (ws.userId) {
      const userClients = this.clients.get(ws.userId);
      if (userClients) {
        userClients.delete(ws);
        if (userClients.size === 0) {
          this.clients.delete(ws.userId);
        }
      }
    }
    try {
      ws.terminate();
    } catch (error) {
      console.error('Error terminating WebSocket connection:', error);
    }
  }

  private extractToken(url: string = ''): string | null {
    const match = url?.match(/token=([^&]*)/);
    return match ? match[1] : null;
  }

  public sendToUser(userId: string, event: string, data: any) {
    try {
      const userClients = this.clients.get(userId);
      if (userClients) {
        const message = JSON.stringify({ event, data });
        userClients.forEach(client => {
          try {
            if (client.readyState === WebSocket.OPEN) {
              client.send(message, (error) => {
                if (error) {
                  console.error('Error sending message to client:', error);
                  this.removeClient(client);
                }
              });
            }
          } catch (error) {
            console.error('Error sending to client:', error);
            this.removeClient(client);
          }
        });
      }
    } catch (error) {
      console.error('Error in sendToUser:', error);
    }
  }

  public broadcast(event: string, data: any) {
    try {
      const message = JSON.stringify({ event, data });
      this.wss.clients.forEach((client: WebSocketClient) => {
        try {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message, (error) => {
              if (error) {
                console.error('Error broadcasting to client:', error);
                this.removeClient(client);
              }
            });
          }
        } catch (error) {
          console.error('Error broadcasting to client:', error);
          this.removeClient(client);
        }
      });
    } catch (error) {
      console.error('Error in broadcast:', error);
    }
  }

  public sendOrderUpdate(orderId: string, status: string, customerId: string) {
    try {
      this.sendToUser(customerId.toString(), 'orderUpdate', {
        orderId,
        status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error sending order update:', error);
    }
  }
}

export default WebSocketService;
