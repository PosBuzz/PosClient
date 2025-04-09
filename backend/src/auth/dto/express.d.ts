export interface User {
  id: string;
  email: string;
  role: string; // Add other properties as needed
}

declare global {
  namespace Express {
    interface Request {
      user?: User; // Add the user property to the Request interface
    }
  }
}