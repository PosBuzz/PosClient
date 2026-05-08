import { useMutation } from "@tanstack/react-query";
import { Button, Card, Form, Input, Select } from "antd";
import { useNavigate } from "react-router-dom";
import { patch } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import PageTitle from "../../components/PageTitle";
import { useAuthStore } from "../../stores/authStore";
import { useMessageStore } from "../../stores/messageStore";
import { setPageTitle } from "../../utils/setPageTitle";
import ImageInput from "../../components/ImageInput";
import { getImageUrlForCloudinaryImage } from "../../utils/upload";

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
        (err as any)?.response?.data?.message || "An error occurred",
      );
    },
  });

  const onFinish = async (formValues: any) => {
    if (formValues.logo) {
      const url = getImageUrlForCloudinaryImage(formValues, "logo");
      formValues.logo = url;
    }

    updateProfile.mutate(formValues);
  };
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
          onFinish={onFinish}
          initialValues={{
            company_name: userData?.company_name,
            secondary_email: userData?.secondary_email,
            phone: userData?.phone,
            address: userData?.address,
            currency_symbol: userData?.currency_symbol,
            currency_position: userData?.currency_position,
            receipt_terms: userData?.receipt_terms,
            logo: [
              {
                uid: "-1",
                status: "done",
                thumbUrl: userData?.logo,
              },
            ],
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

          <Form.Item label="Receipt Terms" name="receipt_terms">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item label="Currency Symbol" name="currency_symbol">
            <Select>
              <Select.Option value="$">$</Select.Option>
              <Select.Option value="€">€</Select.Option>
              <Select.Option value="£">£</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="Currency Position" name="currency_position">
            <Select>
              <Select.Option value="before">Before Amount</Select.Option>
              <Select.Option value="after">After Amount</Select.Option>
            </Select>
          </Form.Item>

          <ImageInput name="logo" label="logo" />

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
