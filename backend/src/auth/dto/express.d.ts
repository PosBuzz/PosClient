export interface User {
  id: string;
  email: string;
  role: string;
  permissions: string[]; 
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
