export interface JwtPayload {
    email: string;
    sub: string; // ID of user or superadmin
    consumer_id?: string; // Optional, used for consumers
  }
  