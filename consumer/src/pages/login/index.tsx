import { Button, Card, Form, Input } from "antd";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useAntdMessage } from "../../contexts/MessageContext";
import useDarkMode from "../../hooks/useDarkMode";

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isDarkMode = useDarkMode();
  const messageApi = useAntdMessage();

  // Redirect if the user is already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" />;
  }

  const [loading, setLoading] = useState(false);

  // Form submission handler
  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      messageApi.success("Login successful");

      // Navigate to the desired page or fallback to "/"
      const from =
        (location.state as { from?: Location })?.from?.pathname || "/";
      navigate(from);
    } catch (err) {
      messageApi.error("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`flex justify-center items-center min-h-screen ${
        isDarkMode ? "bg-[#000]" : "bg-gray-100"
      }`}
    >
      <Card className="w-full sm:w-96 p-6 shadow-lg">
        <h2 className="text-center text-2xl font-semibold mb-6">Login</h2>

        <Form
          onFinish={handleSubmit}
          layout="vertical"
          initialValues={{ email: "", password: "" }}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: "Please input your email!" },
              { type: "email", message: "Please enter a valid email!" },
            ]}
          >
            <Input
              type="email"
              placeholder="Enter your email"
              className="border-2 rounded-md p-2"
            />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: "Please input your password!" }]}
          >
            <Input.Password
              placeholder="Enter your password"
              className="border-2 rounded-md p-2"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Login
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
