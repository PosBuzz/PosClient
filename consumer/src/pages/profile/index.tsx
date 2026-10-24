import { useMutation } from "@tanstack/react-query";
import { Button, Card, Divider, Form, Input, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { patch } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import ImageInput from "../../components/ImageInput";
import PageTitle from "../../components/PageTitle";
import { useAuthStore } from "../../stores/authStore";
import { useMessageStore } from "../../stores/messageStore";
import { setPageTitle } from "../../utils/setPageTitle";
import { getImageUrlForCloudinaryImage } from "../../utils/upload";
import { getErrorMessage } from "../../utils/api-error";
import { iconAdvice, logoAdvice } from "../../utils/brand-image";
import BrandPreview, { fileListUrl } from "./_BrandPreview";

const savedImage = (url?: string | null) =>
  url ? [{ uid: "-1", status: "done", url, thumbUrl: url }] : [];

const guide = (lines: string[]) => (
  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
    {lines.map((line) => (
      <li key={line}>{line}</li>
    ))}
  </ul>
);

function ProfilePage() {
  const [form] = Form.useForm();
  const navigation = useNavigate();
  const { messageApi } = useMessageStore();
  const { user: userData } = useAuthStore();
  const companyName = Form.useWatch("company_name", form) ?? "";
  const logoUrl = fileListUrl(Form.useWatch("logo", form));
  const iconUrl = fileListUrl(Form.useWatch("logo_icon", form));

  const updateProfile = useMutation({
    mutationFn: async (data: any) =>
      await patch(endpoints.updateConsumerProfile, data),
    onSuccess: () => {
      messageApi?.success("Profile updated successfully!");
      navigation(0); // Refresh the page to reflect changes
    },
    onError: (err) => {
      messageApi?.error(getErrorMessage(err, "An error occurred"));
    },
  });

  const onFinish = async (formValues: any) => {
    // An emptied upload is sent as null so the saved image is removed
    for (const field of ["logo", "logo_icon"]) {
      if (formValues[field]) {
        formValues[field] =
          getImageUrlForCloudinaryImage(formValues, field) ?? null;
      }
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
            logo: savedImage(userData?.logo),
            logo_icon: savedImage(userData?.logo_icon),
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

          <Divider orientation="left">Logo &amp; app icon</Divider>
          <Typography.Paragraph type="secondary">
            Upload your full logo once. PosBuzz trims empty margins and makes
            the right size for receipts, PDFs and the app. Add a square app icon
            too if your logo is wide or has small text.
          </Typography.Paragraph>

          <ImageInput
            name="logo"
            label="Company Logo"
            checkImage={logoAdvice}
            extra={guide([
              "Used on receipts, invoices, quotations and PDFs.",
              "PNG with a transparent or white background (JPG works too).",
              "At least 600 px wide; a wide (landscape) logo prints best.",
              "Dark on light: thermal receipts print in black only.",
            ])}
          />

          <ImageInput
            name="logo_icon"
            label="App Icon (optional)"
            checkImage={iconAdvice}
            extra={guide([
              "Used in the sidebar and POS header, shown about 40 px square.",
              "Square PNG, at least 256 × 256 px.",
              "Just the symbol or initials, no small text.",
              "Leave empty to use your logo.",
            ])}
          />

          <Form.Item label="Preview">
            <BrandPreview
              logoUrl={logoUrl}
              iconUrl={iconUrl}
              companyName={companyName}
            />
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
