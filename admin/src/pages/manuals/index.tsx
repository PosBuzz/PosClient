import {
  BookOutlined,
  DownloadOutlined,
  FilePdfOutlined,
} from "@ant-design/icons";
import { Button, Card, Col, Row, Space, Typography } from "antd";
import PageTitle from "../../components/PageTitle";

const manuals = [
  {
    title: "Shop App Manual",
    description:
      "A guide for shop owners, managers and cashiers covering sales, inventory, payments, returns and reports.",
    filename: "PosBuzz-Shop-App-Manual.pdf",
  },
  {
    title: "Admin Panel Manual",
    description:
      "A guide for the PosBuzz team covering shop accounts, plans, billing, support and administration.",
    filename: "PosBuzz-Admin-Manual.pdf",
  },
];

export default function Manuals() {
  return (
    <>
      <PageTitle
        title="User Manuals"
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "User Manuals" },
        ]}
      />
      <Typography.Paragraph type="secondary">
        Open or download the manuals for the Shop App and Admin Panel.
      </Typography.Paragraph>
      <Row gutter={[16, 16]}>
        {manuals.map((manual) => (
          <Col xs={24} lg={12} key={manual.filename}>
            <Card
              title={
                <Space>
                  <BookOutlined />
                  {manual.title}
                </Space>
              }
              style={{ height: "100%" }}
            >
              <Typography.Paragraph>{manual.description}</Typography.Paragraph>
              <Space wrap>
                <Button
                  type="primary"
                  icon={<FilePdfOutlined />}
                  href={`/manual/${manual.filename}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${manual.title} PDF`}
                >
                  Open PDF
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  href={`/manual/${manual.filename}`}
                  download={manual.filename}
                  aria-label={`Download ${manual.title} PDF`}
                >
                  Download PDF
                </Button>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </>
  );
}
