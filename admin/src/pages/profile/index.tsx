import { useMutation } from "@tanstack/react-query";
import { Button, Card, Form, Input, Space, Typography } from "antd";
import { patch } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import PageTitle from "../../components/PageTitle";
import { useAuth } from "../../contexts/AuthContext";
import { useAntdMessage } from "../../contexts/MessageContext";

const { Text } = Typography;

function index() {
  const [form] = Form.useForm();
  const messageApi = useAntdMessage();
  const {user: userData} =  useAuth()

  const updateData = useMutation({
    mutationFn: async (data: any) =>
      await patch(endpoints.changePassword, data),
    onSuccess: (response) => {
      messageApi.success("Password changed successfully!");
      form.resetFields();
    },
    onError: (err) => {
      messageApi.error((err as any)?.response?.data?.message || "An error occurred");
    },
  });

  const handlePasswordChange = (values: {
    old_password: string;
    new_password: string;
  }) => {
    // Replace with your API call
    updateData.mutate(values);
  };

  return (
    <>
      <PageTitle
        title={"Home"}
        breadcrumbs={[
          {
            title: "Dashboard",
            href: "/",
          },
          {
            title: "Home",
          },
        ]}
      />
      <Card title="User Information" className="mb-6!">
        <Space direction="vertical" size="middle">
          <Text className="capitalize">
            <strong>Name:</strong> {userData?.name}
          </Text>
          <Text>
            <strong>Email:</strong> {userData?.email}
          </Text>
          <Text className="capitalize">
            <strong>Role:</strong> {userData?.role}
          </Text>
        </Space>
      </Card>

      <Card title="Change Password">
        <Form form={form} layout="vertical" onFinish={handlePasswordChange}>
          <Form.Item
            label="Old Password"
            name="old_password"
            rules={[
              { required: true, message: "Please input your old password!" },
            ]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            label="New Password"
            name="new_password"
            rules={[
              { required: true, message: "Please input your new password!" },
              {
                min: 6,
                message: "Password must be at least 6 characters long.",
              },
            ]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={updateData.isPending}
            >
              Change Password
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </>
  );
}

export default index;
