import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Col, Form, Input, Row, Select, Skeleton } from "antd";
import { useEffect } from "react";
import axiosInstance from "../../api/axiosInstance";
import { endpoints } from "../../api/endpoints";
import { get } from "../../api/http";
import { useMessageStore } from "../../stores/messageStore";

interface PortfolioSettings {
  site_name: string;
  title: string;
  description: string;
  url: string;
  og_image: string;
  author: string;
  contact_email: string;
  sales_email: string;
  phone: string;
  address?: string | null;
  keywords: string[];
}

export default function SettingsForm() {
  const queryClient = useQueryClient();
  const { messageApi } = useMessageStore();
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery<PortfolioSettings | null>({
    queryKey: ["portfolio-settings"],
    queryFn: () => get(endpoints.portfolioSettings),
  });

  useEffect(() => {
    if (data) form.setFieldsValue(data);
  }, [data, form]);

  const save = useMutation({
    mutationFn: (values: PortfolioSettings) =>
      axiosInstance.put(endpoints.portfolioSettings, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio-settings"] });
      messageApi?.success("Site settings saved");
    },
    onError: () => messageApi?.error("Could not save site settings"),
  });

  if (isLoading) return <Skeleton active />;

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={(values) => save.mutate(values)}
    >
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="Identity" style={{ marginBottom: 16 }}>
            <Form.Item name="site_name" label="Site name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="author" label="Author / company" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="url" label="Canonical URL" rules={[{ required: true }]}>
              <Input placeholder="https://posbuzz.io" />
            </Form.Item>
            <Form.Item name="og_image" label="OG image URL" rules={[{ required: true }]}>
              <Input placeholder="https://posbuzz.io/og-image.png" />
            </Form.Item>
          </Card>

          <Card title="Contact">
            <Form.Item name="contact_email" label="Support email" rules={[{ required: true }]}>
              <Input type="email" />
            </Form.Item>
            <Form.Item name="sales_email" label="Sales email" rules={[{ required: true }]}>
              <Input type="email" />
            </Form.Item>
            <Form.Item name="phone" label="Phone" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="address" label="Address">
              <Input />
            </Form.Item>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="SEO / AEO">
            <Form.Item
              name="title"
              label="Meta title"
              rules={[{ required: true }]}
              extra="Shown in search results and the browser tab."
            >
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item
              name="description"
              label="Meta description"
              rules={[{ required: true }]}
              extra="Used for search snippets, OpenGraph and Twitter cards."
            >
              <Input.TextArea rows={5} />
            </Form.Item>
            <Form.Item
              name="keywords"
              label="Keywords"
              extra="Press Enter after each keyword."
            >
              <Select mode="tags" open={false} suffixIcon={null} />
            </Form.Item>
          </Card>
        </Col>
      </Row>

      <Button
        type="primary"
        htmlType="submit"
        loading={save.isPending}
        style={{ marginTop: 16 }}
      >
        Save site settings
      </Button>
    </Form>
  );
}
