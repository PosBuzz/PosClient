import { useMutation } from "@tanstack/react-query";
import { Button, Card, Form, Input } from "antd";
import { useNavigate } from "react-router-dom";
import { patch } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import PageTitle from "../../components/PageTitle";
import { useAuthStore } from "../../stores/authStore";
import { useMessageStore } from "../../stores/messageStore";
import { setPageTitle } from "../../utils/setPageTitle";

function ProfilePage() {
  const [form] = Form.useForm();
  const navigation = useNavigate();
  const { messageApi } = useMessageStore();
  const { user: userData } = useAuthStore();

  const updateProfile = useMutation({
    mutationFn: async (data: any) =>
      await patch(endpoints.updateConsumerProfile, data),
    onSuccess: () => {
      messageApi?.success("Profile updated successfully!");
      navigation(0); // Refresh the page to reflect changes
    },
    onError: (err) => {
      messageApi?.error(
        (err as any)?.response?.data?.message || "An error occurred"
      );
    },
  });

  return (
    <>
      {setPageTitle("Profile")}
      <PageTitle
        title={"Profile"}
        breadcrumbs={[{ title: "Dashboard", href: "/" }, { title: "Profile" }]}
      />

      <Card title="Company / Contact Info" style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => updateProfile.mutate(values)}
          initialValues={{
            company_name: (userData as any)?.company_name,
            secondary_email: (userData as any)?.secondary_email,
            phone: (userData as any)?.phone,
            address: (userData as any)?.address,
          }}
        >
          <Form.Item label="Company Name" name="company_name">
            <Input />
          </Form.Item>

          <Form.Item
            label="Secondary Email"
            name="secondary_email"
            rules={[{ type: "email", message: "Please enter a valid email" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item label="Phone" name="phone">
            <Input />
          </Form.Item>

          <Form.Item label="Address" name="address">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={updateProfile.isPending}
            >
              Update Profile
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </>
  );
}

export default ProfilePage;
