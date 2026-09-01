import {
  AppstoreOutlined,
  CheckCircleFilled,
  ShoppingCartOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Col, Row, Space, Typography } from "antd";
import { useEffect, useState } from "react";
import PageTitle from "../../components/PageTitle";
import {
  getPosLayout,
  PosLayout,
  savePosLayout,
} from "../../constants/pos-layout";
import { useMessageStore } from "../../stores/messageStore";
import { setPageTitle } from "../../utils/setPageTitle";

const { Paragraph, Text, Title } = Typography;

type LayoutChoice = {
  value: PosLayout;
  title: string;
  description: string;
  icon: React.ReactNode;
};

const choices: LayoutChoice[] = [
  {
    value: "classic",
    title: "Classic POS",
    description:
      "The current detailed workspace with table-based cart, discounts, and payments visible together.",
    icon: <TableOutlined />,
  },
  {
    value: "restaurant",
    title: "Restaurant POS",
    description:
      "An image-first, touch-friendly menu with categories and a compact live order panel.",
    icon: <AppstoreOutlined />,
  },
];

const LayoutPreview = ({ type }: { type: PosLayout }) => {
  if (type === "classic") {
    return (
      <div
        style={{
          height: 170,
          display: "grid",
          gridTemplateColumns: "1fr 90px",
          gap: 8,
          padding: 12,
          borderRadius: 12,
          background: "#f3f5f8",
        }}
      >
        <div style={{ display: "grid", gridTemplateRows: "48px 1fr", gap: 8 }}>
          <div style={{ borderRadius: 8, background: "#dfe5ec" }} />
          <div style={{ borderRadius: 8, background: "#fff", padding: 8 }}>
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                style={{
                  height: 15,
                  marginBottom: 6,
                  borderRadius: 4,
                  background: row % 2 ? "#f1f3f6" : "#e6e9ee",
                }}
              />
            ))}
          </div>
        </div>
        <div style={{ borderRadius: 8, background: "#fff", padding: 9 }}>
          <div style={{ height: 28, borderRadius: 6, background: "#dce8ff" }} />
          <div
            style={{
              height: 60,
              marginTop: 8,
              borderRadius: 6,
              background: "#f0f2f5",
            }}
          />
          <div
            style={{
              height: 28,
              marginTop: 8,
              borderRadius: 6,
              background: "#1677ff",
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: 170,
        display: "grid",
        gridTemplateColumns: "1fr 100px",
        gap: 8,
        padding: 12,
        borderRadius: 12,
        background: "#f7f3ef",
      }}
    >
      <div>
        <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
          {[36, 42, 38].map((width, index) => (
            <div
              key={index}
              style={{
                width,
                height: 14,
                borderRadius: 7,
                background: index ? "#fff" : "#e7792b",
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 6,
          }}
        >
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              style={{
                height: 58,
                borderRadius: 8,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              <div
                style={{
                  height: 36,
                  background: item % 2 ? "#dcc0a9" : "#ead4c2",
                }}
              />
              <div
                style={{
                  width: "70%",
                  height: 5,
                  margin: "7px",
                  borderRadius: 3,
                  background: "#c9c2bc",
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderRadius: 8, background: "#fff", padding: 8 }}>
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            style={{
              height: 25,
              marginBottom: 7,
              borderRadius: 6,
              background: "#f0e8e1",
            }}
          />
        ))}
        <div
          style={{
            height: 30,
            marginTop: 24,
            borderRadius: 7,
            background: "#e7792b",
          }}
        />
      </div>
    </div>
  );
};

const PosLayoutSettings = () => {
  const [selectedLayout, setSelectedLayout] = useState<PosLayout>(getPosLayout);
  const { messageApi } = useMessageStore();

  useEffect(() => {
    setPageTitle("POS Layout Settings");
  }, []);

  const handleSave = () => {
    savePosLayout(selectedLayout);
    messageApi?.success(
      "POS layout saved. It will be used the next time POS opens.",
    );
  };

  return (
    <div style={{ maxWidth: 1050, margin: "0 auto" }}>
      <PageTitle
        title="POS Layout"
        breadcrumbs={[{ title: "Settings" }, { title: "POS Layout" }]}
      />

      <Card style={{ borderRadius: 16 }}>
        <Title level={4} style={{ marginTop: 0 }}>
          Choose your sales workspace
        </Title>
        <Paragraph type="secondary" style={{ maxWidth: 720 }}>
          Select the interface that best fits this device and business. This is
          a browser-level setting, so different counters can use different
          layouts.
        </Paragraph>

        <Alert
          type="info"
          showIcon
          style={{ margin: "18px 0 24px" }}
          message="Classic POS remains the default for browsers that have not selected a layout."
        />

        <Row gutter={[18, 18]}>
          {choices.map((choice) => {
            const selected = selectedLayout === choice.value;
            return (
              <Col xs={24} md={12} key={choice.value}>
                <Card
                  hoverable
                  role="radio"
                  aria-checked={selected}
                  tabIndex={0}
                  onClick={() => setSelectedLayout(choice.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedLayout(choice.value);
                    }
                  }}
                  style={{
                    height: "100%",
                    borderRadius: 15,
                    borderWidth: 2,
                    borderColor: selected ? "#e7792b" : undefined,
                    boxShadow: selected
                      ? "0 8px 24px rgba(231, 121, 43, 0.13)"
                      : undefined,
                  }}
                >
                  <LayoutPreview type={choice.value} />
                  <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                    <div
                      style={{
                        color: selected ? "#e7792b" : "#77808a",
                        fontSize: 24,
                      }}
                    >
                      {choice.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Space>
                        <Text strong style={{ fontSize: 16 }}>
                          {choice.title}
                        </Text>
                        {selected && (
                          <CheckCircleFilled style={{ color: "#e7792b" }} />
                        )}
                      </Space>
                      <Paragraph type="secondary" style={{ margin: "5px 0 0" }}>
                        {choice.description}
                      </Paragraph>
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>

        <div
          style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}
        >
          <Button
            type="primary"
            size="large"
            icon={<ShoppingCartOutlined />}
            onClick={handleSave}
          >
            Save POS layout
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default PosLayoutSettings;
