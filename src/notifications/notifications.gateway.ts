import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Injectable } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader =
        client.handshake.auth?.token || client.handshake.headers?.authorization;

      if (!authHeader) {
        console.log(`Socket connection rejected: No token provided.`);
        client.disconnect();
        return;
      }

      const token = authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader;

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'default_access_secret',
      });

      const userId = payload.sub;
      client.data.userId = userId;

      // Join the private Socket.IO room for this user
      await client.join(userId);
      console.log(`User connected and joined room: ${userId}`);
    } catch (err: any) {
      console.error('Socket connection authentication error:', err?.message || err);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      console.log(`User disconnected from notification socket: ${userId}`);
    }
  }

  sendNotificationToUser(userId: string, notification: any) {
    if (this.server) {
      this.server.to(userId).emit('notification', notification);
    }
  }
}
