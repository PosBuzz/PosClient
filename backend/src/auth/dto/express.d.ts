// Preserve the exported application user type for existing consumers.
export type User = Express.User;

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      role: string;
      permissions: string[];
      consumer_id?: number;
      company_name?: string;
      company_email?: string;
      plan_id?: number;
      name?: string;
    }

    interface Request {
      csrfToken: () => string;
    }
  }
}

// Preserve the application's existing authenticated-handler request contract
// while Passport owns the global optional Request.user declaration.
declare module 'express-serve-static-core' {
  interface Request {
    user: Express.User;
  }
}
