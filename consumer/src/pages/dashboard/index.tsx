import {
  CalculatorOutlined,
  DashboardOutlined,
  PlusOutlined,
  ShoppingCartOutlined
} from "@ant-design/icons";
import { Button, Card, Col, Row, Space } from "antd";
import { useNavigate } from "react-router-dom";
import { setPageTitle } from "../../utils/setPageTitle";

function index() {
  const navigate = useNavigate();

  return (
    <>
      {setPageTitle("PosBuzz | Home")}
      {/* <PageTitle
        title={"Dashboard"}
        breadcrumbs={[
          {
            title: "Dashboard",
            href: "/",
          },
          {
            title: "Home",
          },
        ]}
      /> */}
      
      <div style={{ padding: "24px 0" }}>
        <h1 style={{ fontSize: "2.5rem", textAlign: "center", marginBottom: "2rem" }}>
          Welcome to PosBuzz
        </h1>
        
        <Row gutter={[24, 24]} justify="center">
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              style={{
                textAlign: "center",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                border: "none",
                borderRadius: "16px",
                color: "white",
              }}
              bodyStyle={{ padding: "32px 24px" }}
              onClick={() => navigate("/pos")}
            >
              <CalculatorOutlined style={{ fontSize: "3rem", marginBottom: "16px" }} />
              <h3 style={{ color: "white", marginBottom: "8px" }}>Point of Sale</h3>
              <p style={{ color: "rgba(255,255,255,0.8)", margin: 0 }}>
                Start selling with our modern POS interface
              </p>
            </Card>
          </Col>
          
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              style={{
                textAlign: "center",
                background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                border: "none",
                borderRadius: "16px",
                color: "white",
              }}
              bodyStyle={{ padding: "32px 24px" }}
              onClick={() => navigate("/sales")}
            >
              <ShoppingCartOutlined style={{ fontSize: "3rem", marginBottom: "16px" }} />
              <h3 style={{ color: "white", marginBottom: "8px" }}>Sales Management</h3>
              <p style={{ color: "rgba(255,255,255,0.8)", margin: 0 }}>
                View and manage all your sales
              </p>
            </Card>
          </Col>
          
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              style={{
                textAlign: "center",
                background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                border: "none",
                borderRadius: "16px",
                color: "white",
              }}
              bodyStyle={{ padding: "32px 24px" }}
              onClick={() => navigate("/products")}
            >
              <DashboardOutlined style={{ fontSize: "3rem", marginBottom: "16px" }} />
              <h3 style={{ color: "white", marginBottom: "8px" }}>Inventory</h3>
              <p style={{ color: "rgba(255,255,255,0.8)", margin: 0 }}>
                Manage products and inventory
              </p>
            </Card>
          </Col>
          
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              style={{
                textAlign: "center",
                background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
                border: "none",
                borderRadius: "16px",
                color: "white",
              }}
              bodyStyle={{ padding: "32px 24px" }}
              onClick={() => navigate("/sales/new")}
            >
              <PlusOutlined style={{ fontSize: "3rem", marginBottom: "16px" }} />
              <h3 style={{ color: "white", marginBottom: "8px" }}>New Sale</h3>
              <p style={{ color: "rgba(255,255,255,0.8)", margin: 0 }}>
                Create a detailed sale transaction
              </p>
            </Card>
          </Col>
        </Row>
        
        <div style={{ textAlign: "center", marginTop: "3rem" }}>
          <Space size="large">
            <Button 
              type="primary" 
              size="large" 
              icon={<CalculatorOutlined />}
              onClick={() => navigate("/pos")}
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                border: "none",
                borderRadius: "8px",
                height: "48px",
                fontSize: "16px",
                fontWeight: "600",
                padding: "0 32px"
              }}
            >
              Launch POS Terminal
            </Button>
          </Space>
        </div>
      </div>
    </>
  );
}

export default index;
