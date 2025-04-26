export interface User {
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

declare global {
  namespace Express {
    interface Request {
      user?: User; // Add the user property to the Request interface
      csrfToken: () => string;
    }
  }
}
