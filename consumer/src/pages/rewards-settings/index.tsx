import { takaPrefix } from "../../components/Currency";
import { ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  InputNumber,
  Row,
  Space,
  Switch,
  Typography,
} from "antd";
import React, { useEffect, useState } from "react";
import { rewardsApi } from "../../api/rewards.api";
import PageTitle from "../../components/PageTitle";
import { useMessageStore } from "../../stores/messageStore";
import {
  CreateRewardsSettingsDto,
  RewardsSettings,
} from "../../types/rewards.types";
import { setPageTitle } from "../../utils/setPageTitle";
import { getErrorMessage } from "../../utils/api-error";

const { Text } = Typography;

const RewardsSettingsPage: React.FC = () => {
  const title = "Rewards Settings";
  const { messageApi } = useMessageStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<RewardsSettings | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await rewardsApi.getSettings();
      setSettings(data);
      form.setFieldsValue({
        is_enabled: data.is_enabled,
        points_per_currency: data.points_per_currency,
        minimum_purchase_amount: data.minimum_purchase_amount,
        maximum_points_per_sale: data.maximum_points_per_sale,
        redemption_value: data.redemption_value,
        minimum_redemption: data.minimum_redemption,
        maximum_redemption: data.maximum_redemption,
        points_expire_days: data.points_expire_days,
        allow_partial_redemption: data.allow_partial_redemption,
        earn_on_sale_only: data.earn_on_sale_only,
      });
    } catch (error) {
      messageApi?.error(
        getErrorMessage(error, "Failed to load rewards settings"),
      );
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: CreateRewardsSettingsDto) => {
    setSaving(true);
    try {
      // Ensure numeric values are properly formatted
      const formattedValues = {
        ...values,
        points_per_currency: Number(values.points_per_currency),
        minimum_purchase_amount: Number(values.minimum_purchase_amount),
        redemption_value: Number(values.redemption_value),
        maximum_points_per_sale: values.maximum_points_per_sale
          ? Number(values.maximum_points_per_sale)
          : undefined,
        minimum_redemption: Number(values.minimum_redemption),
        maximum_redemption: values.maximum_redemption
          ? Number(values.maximum_redemption)
          : undefined,
        points_expire_days: values.points_expire_days
          ? Number(values.points_expire_days)
          : undefined,
      };

      const data = settings?.id
        ? await rewardsApi.updateSettings(formattedValues)
        : await rewardsApi.createSettings(formattedValues);

      setSettings(data);
      messageApi?.success("Rewards settings saved successfully");
    } catch (error: any) {
      messageApi?.error(
        getErrorMessage(error, "Failed to save rewards settings"),
      );
      console.error("Error saving settings:", error);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <>
      {setPageTitle(title)}
      <PageTitle
        title={title}
        breadcrumbs={[
          {
            title: "Dashboard",
            href: "/",
          },
          {
            title: title,
          },
        ]}
      />
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card>
            <Alert
              message="Important Note"
              description="Changes to rewards settings will apply to future transactions only. Existing points and transactions will not be affected."
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSave}
              disabled={loading}
            >
              <Row gutter={[16, 0]}>
                <Col span={24}>
                  <Form.Item
                    name="is_enabled"
                    label="Enable Rewards System"
                    valuePropName="checked"
                  >
                    <Switch
                      checkedChildren="Enabled"
                      unCheckedChildren="Disabled"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider>Earning Rules</Divider>

              <Row gutter={[16, 0]}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="points_per_currency"
                    label="Points per Dollar Spent"
                    rules={[
                      {
                        required: true,
                        message: "Please enter points per dollar",
                      },
                      {
                        validator: (_, value) => {
                          if (
                            value === undefined ||
                            value === null ||
                            value === ""
                          ) {
                            return Promise.reject(
                              new Error("Please enter points per dollar"),
                            );
                          }
                          const numValue = Number(value);
                          if (isNaN(numValue) || numValue < 0) {
                            return Promise.reject(
                              new Error("Must be a positive number"),
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <InputNumber
                      min={0}
                      step={0.1}
                      precision={2}
                      style={{ width: "100%" }}
                      placeholder="e.g., 1.00"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item
                    name="minimum_purchase_amount"
                    label="Minimum Purchase Amount"
                    rules={[
                      {
                        required: true,
                        message: "Please enter minimum purchase amount",
                      },
                      {
                        validator: (_, value) => {
                          if (
                            value === undefined ||
                            value === null ||
                            value === ""
                          ) {
                            return Promise.reject(
                              new Error("Please enter minimum purchase amount"),
                            );
                          }
                          const numValue = Number(value);
                          if (isNaN(numValue) || numValue < 0) {
                            return Promise.reject(
                              new Error("Must be a positive number"),
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <InputNumber
                      min={0}
                      step={0.01}
                      precision={2}
                      style={{ width: "100%" }}
                      placeholder="e.g., 10.00"
                      addonBefore={takaPrefix}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item
                    name="maximum_points_per_sale"
                    label="Maximum Points per Sale (Optional)"
                  >
                    <InputNumber
                      min={1}
                      style={{ width: "100%" }}
                      placeholder="Leave empty for no limit"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item
                    name="points_expire_days"
                    label="Points Expire After (Days)"
                  >
                    <InputNumber
                      min={1}
                      style={{ width: "100%" }}
                      placeholder="Leave empty for no expiration"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider>Redemption Rules</Divider>

              <Row gutter={[16, 0]}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="redemption_value"
                    label="Dollar Value per Point"
                    rules={[
                      {
                        required: true,
                        message: "Please enter redemption value",
                      },
                      {
                        validator: (_, value) => {
                          if (
                            value === undefined ||
                            value === null ||
                            value === ""
                          ) {
                            return Promise.reject(
                              new Error("Please enter redemption value"),
                            );
                          }
                          const numValue = Number(value);
                          if (isNaN(numValue) || numValue <= 0) {
                            return Promise.reject(
                              new Error("Must be greater than 0"),
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <InputNumber
                      min={0.0001}
                      step={0.01}
                      precision={4}
                      style={{ width: "100%" }}
                      placeholder="e.g., 0.01"
                      addonBefore={takaPrefix}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item
                    name="minimum_redemption"
                    label="Minimum Points to Redeem"
                    rules={[
                      {
                        required: true,
                        message: "Please enter minimum redemption",
                      },
                      {
                        validator: (_, value) => {
                          if (
                            value === undefined ||
                            value === null ||
                            value === ""
                          ) {
                            return Promise.reject(
                              new Error("Please enter minimum redemption"),
                            );
                          }
                          const numValue = Number(value);
                          if (
                            isNaN(numValue) ||
                            numValue < 1 ||
                            !Number.isInteger(numValue)
                          ) {
                            return Promise.reject(
                              new Error("Must be a whole number at least 1"),
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <InputNumber
                      min={1}
                      step={1}
                      precision={0}
                      style={{ width: "100%" }}
                      placeholder="e.g., 100"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item
                    name="maximum_redemption"
                    label="Maximum Points per Transaction (Optional)"
                  >
                    <InputNumber
                      min={1}
                      style={{ width: "100%" }}
                      placeholder="Leave empty for no limit"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider>Additional Settings</Divider>

              <Row gutter={[16, 0]}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="allow_partial_redemption"
                    label="Allow Partial Redemption"
                    valuePropName="checked"
                  >
                    <Switch checkedChildren="Yes" unCheckedChildren="No" />
                  </Form.Item>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Allow customers to use points for partial payment
                  </Text>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item
                    name="earn_on_sale_only"
                    label="Earn Points on Sales Only"
                    valuePropName="checked"
                  >
                    <Switch checkedChildren="Yes" unCheckedChildren="No" />
                  </Form.Item>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Only award points for completed sales (not quotations)
                  </Text>
                </Col>
              </Row>

              <Divider />

              <Row justify="space-between">
                <Col>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={loadSettings}
                    loading={loading}
                  >
                    Reload
                  </Button>
                </Col>
                <Col>
                  <Space>
                    <Button onClick={() => form.resetFields()}>Reset</Button>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      htmlType="submit"
                      loading={saving}
                    >
                      Save Settings
                    </Button>
                  </Space>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default RewardsSettingsPage;
