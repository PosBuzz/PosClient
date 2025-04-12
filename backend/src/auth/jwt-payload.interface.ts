export interface JwtPayload {
    email: string;
    sub: number; // ID of user or superadmin
    consumer_id?: number; // Optional, used for consumers
  }
  