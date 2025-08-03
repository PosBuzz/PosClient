import React, { useState, useEffect } from "react";
import {
  Card,
  Form,
  Input,
  InputNumber,
  Switch,
  Button,
  message,
  Typography,
  Divider,
  Space,
  Alert,
  Row,
  Col,
} from "antd";
import { PrinterOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { printingAgentAPI } from "../../api/printing-agent-api";
import { thermalPrinterApi } from "../../api/thermal-printer-api";
import {
  PRINTER_CONFIG,
  type PrinterSettings,
} from "../../constants/printer.constants";
import PageTitle from "../../components/PageTitle";
import { setPageTitle } from "../../utils/setPageTitle";

const { Title, Paragraph, Text } = Typography;

interface AgentConfig {
  storeName: string;
  address?: string;
  phone?: string;
  email?: string;
  logoPath?: string;
  printerName?: string;
}

const PrinterSettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [agentForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingPrint, setTestingPrint] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "unknown" | "connected" | "disconnected"
  >("unknown");
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);

  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>({
    paperWidth: PRINTER_CONFIG.DEFAULT_PAPER_WIDTH,
    encoding: PRINTER_CONFIG.DEFAULT_ENCODING,
    autocut: PRINTER_CONFIG.DEFAULT_AUTOCUT,
    buzzer: PRINTER_CONFIG.DEFAULT_BUZZER,
    agentUrl: PRINTER_CONFIG.DEFAULT_AGENT_URL,
  });

  useEffect(() => {
    setPageTitle("Printer Settings");
    loadSettings();
    testConnection();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await thermalPrinterApi.getPrinterSettings();
      if (response && response.data) {
        const settings = response.data;
        setPrinterSettings(settings);
        form.setFieldsValue(settings);

        // Update agent URL
        if (settings.agentUrl) {
          printingAgentAPI.setAgentUrl(settings.agentUrl);
        }
      }
    } catch (error) {
      console.error("Failed to load printer settings:", error);
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const result = await printingAgentAPI.testConnection();
      if (result.success) {
        setConnectionStatus("connected");
        message.success(result.message);

        // Load agent config if connected
        const config = await printingAgentAPI.getConfig();
        if (config) {
          setAgentConfig(config);
          agentForm.setFieldsValue(config);
        }
      } else {
        setConnectionStatus("disconnected");
        message.error(result.message);
      }
    } catch (error) {
      setConnectionStatus("disconnected");
      message.error("Failed to connect to printing agent");
    } finally {
      setTestingConnection(false);
    }
  };

  const testPrint = async () => {
    setTestingPrint(true);
    try {
      const result = await printingAgentAPI.testPrint();
      if (result.success) {
        message.success("Test receipt printed successfully!");
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error("Failed to test print");
    } finally {
      setTestingPrint(false);
    }
  };

  const saveSettings = async (values: PrinterSettings) => {
    setLoading(true);
    try {
      await thermalPrinterApi.updatePrinterSettings(values);
      setPrinterSettings(values);

      // Update agent URL
      if (values.agentUrl) {
        printingAgentAPI.setAgentUrl(values.agentUrl);
      }

      message.success("Printer settings saved successfully!");

      // Test connection with new URL
      if (values.agentUrl !== printerSettings.agentUrl) {
        setTimeout(() => testConnection(), 1000);
      }
    } catch (error) {
      message.error("Failed to save printer settings");
    } finally {
      setLoading(false);
    }
  };

  const saveAgentConfig = async (values: AgentConfig) => {
    setLoading(true);
    try {
      const result = await printingAgentAPI.updateConfig(values);
      if (result.success) {
        setAgentConfig(values);
        message.success("Agent configuration saved successfully!");
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error("Failed to save agent configuration");
    } finally {
      setLoading(false);
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "success";
      case "disconnected":
        return "error";
      default:
        return "warning";
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case "connected":
        return "Connected to printing agent";
      case "disconnected":
        return "Disconnected from printing agent";
      default:
        return "Connection status unknown";
    }
  };

  return (
    <div style={{ padding: "24px" }}>
      <PageTitle
        title="Printer Settings"
        breadcrumbs={[
          {
            title: "Dashboard",
            href: "/",
          },
          {
            title: "Printer Settings",
          },
        ]}
      />

      <Row gutter={24}>
        <Col xs={24} lg={12}>
          {/* Connection Status */}
          <Card
            title="Connection Status"
            style={{ marginBottom: 24 }}
            extra={
              <Button
                type="link"
                onClick={testConnection}
                loading={testingConnection}
                icon={<CheckCircleOutlined />}
              >
                Test Connection
              </Button>
            }
          >
            <Alert
              message={getConnectionStatusText()}
              type={getConnectionStatusColor()}
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Space>
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                onClick={testPrint}
                loading={testingPrint}
                disabled={connectionStatus !== "connected"}
              >
                Test Print
              </Button>
              <Button onClick={testConnection} loading={testingConnection}>
                Refresh Status
              </Button>
            </Space>
          </Card>

          {/* Printer Settings */}
          <Card title="Printer Settings">
            <Form
              form={form}
              layout="vertical"
              initialValues={printerSettings}
              onFinish={saveSettings}
            >
              <Form.Item
                name="agentUrl"
                label="Agent URL"
                rules={[{ required: true, message: "Please enter agent URL" }]}
                help="URL where the printing agent is running (usually http://localhost:8080)"
              >
                <Input placeholder="http://localhost:8080" />
              </Form.Item>

              <Form.Item
                name="paperWidth"
                label="Paper Width (characters)"
                help="Typical values: 40 for 58mm paper, 80 for 80mm paper"
              >
                <InputNumber min={20} max={120} />
              </Form.Item>

              <Form.Item name="encoding" label="Text Encoding">
                <Input placeholder="utf8" />
              </Form.Item>

              <Form.Item
                name="autocut"
                label="Auto Cut"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item name="buzzer" label="Buzzer" valuePropName="checked">
                <Switch />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading}>
                  Save Settings
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          {/* Agent Configuration */}
          <Card title="Agent Configuration" style={{ marginBottom: 24 }}>
            {connectionStatus === "connected" && agentConfig ? (
              <Form
                form={agentForm}
                layout="vertical"
                initialValues={agentConfig}
                onFinish={saveAgentConfig}
              >
                <Form.Item
                  name="storeName"
                  label="Store Name"
                  rules={[
                    { required: true, message: "Please enter store name" },
                  ]}
                >
                  <Input />
                </Form.Item>

                <Form.Item name="address" label="Store Address">
                  <Input.TextArea rows={3} />
                </Form.Item>

                <Form.Item name="phone" label="Store Phone">
                  <Input />
                </Form.Item>

                <Form.Item name="email" label="Store Email">
                  <Input />
                </Form.Item>

                <Form.Item
                  name="printerName"
                  label="Printer Name"
                  help="Name of the thermal printer (leave empty for default)"
                >
                  <Input />
                </Form.Item>

                <Form.Item
                  name="logoPath"
                  label="Logo Path"
                  help="Path to store logo image file"
                >
                  <Input />
                </Form.Item>

                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    Save Agent Config
                  </Button>
                </Form.Item>
              </Form>
            ) : (
              <Alert
                message="Connect to printing agent to configure"
                description="Please ensure the printing agent is running and connected to configure these settings."
                type="info"
                showIcon
              />
            )}
          </Card>

          {/* Setup Instructions */}
          <Card title="Setup Instructions">
            <Paragraph>
              <Title level={5}>1. Install Printing Agent</Title>
              <Text>
                Download and run the PrintingFromWebToPOSPrinter agent on the
                computer connected to your thermal printer.
              </Text>
            </Paragraph>

            <Paragraph>
              <Title level={5}>2. Configure Printer</Title>
              <Text>
                Ensure your thermal printer is properly installed and set as the
                default printer, or specify the printer name in the agent
                configuration.
              </Text>
            </Paragraph>

            <Paragraph>
              <Title level={5}>3. Test Connection</Title>
              <Text>
                Use the "Test Connection" button to verify the agent is running
                and accessible.
              </Text>
            </Paragraph>

            <Paragraph>
              <Title level={5}>4. Test Print</Title>
              <Text>
                Use the "Test Print" button to ensure receipts can be printed
                correctly.
              </Text>
            </Paragraph>

            <Divider />

            <Alert
              message="Default Agent URL"
              description={`The default agent URL is ${PRINTER_CONFIG.DEFAULT_AGENT_URL}. Change this if your agent runs on a different port or computer.`}
              type="info"
              showIcon
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default PrinterSettingsPage;
