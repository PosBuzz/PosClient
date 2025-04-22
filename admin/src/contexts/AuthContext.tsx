import { createContext, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import { endpoints } from "../api/endpoints";
interface AuthContextType {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  user: User | null;
}

type User = {
  id: number;
  role_id: number;
  email: string;
  name: string;
  refresh_token: string;
  created_by_id: number | null;
  role: string;
  permissions: string[];
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);

  const navigate = useNavigate();

  const checkAuth = async () => {
    try {
      const response = await axiosInstance.get(endpoints.getMe);
      setUser(response.data?.user);
      setIsAuthenticated(true);
    } catch (err) {
      setIsAuthenticated(false);
    }
  };

  const getCsrfToken = async () => {
    try {
      await axiosInstance.get(endpoints.csrfToken);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    getCsrfToken();
  }, []);

  useEffect(() => {
    checkAuth();
  }, [location.pathname]);

  const login = async (email: string, password: string) => {
    await axiosInstance.post(endpoints.login, { email, password });
    setIsAuthenticated(true);
    navigate("/"); // or wherever your admin panel starts
  };

  const logout = async () => {
    await axiosInstance.post(endpoints.logout); // you can clear cookies server-side
    setIsAuthenticated(false);
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
