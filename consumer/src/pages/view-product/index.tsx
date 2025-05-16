import {
  ArrowLeftOutlined,
  BarcodeOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DollarOutlined,
  EditOutlined,
  ShopOutlined,
  TagOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Image,
  Row,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { Link, useNavigate, useParams } from "react-router-dom";
import { productApi } from "../../api/product-api";
import PageTitle from "../../components/PageTitle";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { useAuthStore } from "../../stores/authStore";
import { Permissions } from "../../constants/permissions";

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const ProductDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const productId = parseInt(id || "0");

  const { user } = useAuthStore();

  const hasPermission = (permission) => {
    return user?.permissions?.includes(permission);
  };

  // Fetch product details
  const {
    data: product,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => productApi.getProduct(productId),
    enabled: !!productId,
  });

  // Delete confirmation
  const { showDeleteConfirm } = useConfirmDelete({
    title: "Delete Product",
    content:
      "Are you sure you want to delete this product? This action cannot be undone.",
    onConfirm: async () => {
      await productApi.deleteProduct(productId);
      navigate("/products");
    },
  });

  if (isLoading) {
    return (
      <Card loading={true}>
        <div style={{ height: "400px" }}></div>
      </Card>
    );
  }

  if (error || !product) {
    return (
      <Card>
        <Title level={4}>Error</Title>
        <Text type="danger">
          Failed to load product details. Please try again later.
        </Text>
        <Button
          type="primary"
          onClick={() => navigate("/products")}
          icon={<ArrowLeftOutlined />}
          style={{ marginTop: 16 }}
        >
          Return to Products
        </Button>
      </Card>
    );
  }

  // Determine product status badges
  const getProductStatusBadges = () => {
    const badges: React.ReactNode[] = [];

    if (product.featured) {
      badges.push(
        <Tag color="gold" key="featured">
          Featured
        </Tag>
      );
    }

    if (product.sell_online) {
      badges.push(
        <Tag color="blue" key="online">
          Online
        </Tag>
      );
    }

    badges.push(
      <Tag color={product.in_stock ? "green" : "red"} key="stock">
        {product.in_stock ? "In Stock" : "Out of Stock"}
      </Tag>
    );

    return badges;
  };

  // Variant columns
  const variantColumns = [
    {
      title: "Option",
      dataIndex: "option",
      key: "option",
    },
    {
      title: "Value",
      dataIndex: "value",
      key: "value",
    },
    {
      title: "Item Code",
      dataIndex: "item_code",
      key: "item_code",
    },
    {
      title: "Cost",
      dataIndex: "cost",
      key: "cost",
      render: (cost) => formatCurrency(cost),
    },
    {
      title: "Price",
      dataIndex: "price",
      key: "price",
      render: (price) => formatCurrency(price),
    },
  ];

  // Branch price columns
  const branchPriceColumns = [
    {
      title: "Branch",
      dataIndex: ["branch", "name"],
      key: "branch",
    },
    {
      title: "Price",
      dataIndex: "price",
      key: "price",
      render: (price) => formatCurrency(price),
    },
  ];

  // Serial columns
  const serialColumns = [
    {
      title: "Serial Number",
      dataIndex: "serial",
      key: "serial",
    },
  ];

  return (
    <>
      <PageTitle
        title="Product Details"
        breadcrumbs={[
          {
            title: "Dashboard",
            href: "/",
          },
          {
            title: "Products",
            href: "/products",
          },
          {
            title: "Details",
          },
        ]}
        rightSection={
          <Space>
            {hasPermission(Permissions.edit_product) && (
              <Link to={`/products/edit/${productId}`}>
                <Button type="primary" icon={<EditOutlined />}>
                  Edit Product
                </Button>
              </Link>
            )}
            {hasPermission(Permissions.edit_product) && (
              <Button
                danger
                type="primary"
                icon={<DeleteOutlined />}
                onClick={showDeleteConfirm}
              >
                Delete
              </Button>
            )}
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card bodyStyle={{ padding: 0 }} className="product-image-card">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name}
                style={{ width: "100%" }}
                fallback="https://placehold.co/600x400?text=No+Image"
              />
            ) : (
              <div
                style={{
                  height: "300px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  background: "#f5f5f5",
                }}
              >
                <Text type="secondary">No Image Available</Text>
              </div>
            )}
          </Card>

          <Card
            title="Pricing Information"
            style={{ marginTop: 16 }}
            extra={<DollarOutlined />}
          >
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Cost Price">
                {formatCurrency(product.cost)}
              </Descriptions.Item>
              <Descriptions.Item label="Selling Price">
                {formatCurrency(product.price)}
              </Descriptions.Item>
              {product.wholesale_price && (
                <Descriptions.Item label="Wholesale Price">
                  {formatCurrency(product.wholesale_price)}
                </Descriptions.Item>
              )}
              {product.product_tax && (
                <Descriptions.Item label="Tax">
                  {product.product_tax}%
                </Descriptions.Item>
              )}
              {product.tax_method && (
                <Descriptions.Item label="Tax Method">
                  {product.tax_method === "INCLUSIVE"
                    ? "Inclusive"
                    : "Exclusive"}
                </Descriptions.Item>
              )}
            </Descriptions>

            {product.promotional_price && (
              <>
                <Divider plain>Promotional Price</Divider>
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Statistic
                    title="Promo Price"
                    value={product.promotional_price.price}
                    precision={2}
                    prefix="$"
                    valueStyle={{ color: "#f5222d" }}
                  />
                  <Text type="secondary">
                    <ClockCircleOutlined /> Valid from{" "}
                    {formatDate(product.promotional_price.starts_at)}
                    {product.promotional_price.ends_at
                      ? ` to ${formatDate(product.promotional_price.ends_at)}`
                      : " onwards"}
                  </Text>
                </Space>
              </>
            )}
          </Card>

          <Card title="Tags" style={{ marginTop: 16 }} extra={<TagOutlined />}>
            {product.tags && product.tags.length > 0 ? (
              <Space wrap>
                {product.tags.map((tag) => (
                  <Tag key={tag.id} color="blue">
                    {tag.name}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary">No tags assigned</Text>
            )}
          </Card>
        </Col>

        <Col xs={24} md={16}>
          <Card>
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <div>
                <Title level={3}>{product.name}</Title>
                <Space size="middle">{getProductStatusBadges()}</Space>
              </div>

              <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label="Product Code">
                  <Space>
                    <BarcodeOutlined />
                    {product.code}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="Type">
                  {product.type}
                </Descriptions.Item>
                <Descriptions.Item label="Category">
                  {product.category?.name || "N/A"}
                </Descriptions.Item>
                <Descriptions.Item label="Brand">
                  {product.brand?.name || "N/A"}
                </Descriptions.Item>
                <Descriptions.Item label="Product Unit">
                  {product.unit?.name || "N/A"}
                </Descriptions.Item>
                <Descriptions.Item label="Sale Unit">
                  {product.sale_unit?.name || "N/A"}
                </Descriptions.Item>
                <Descriptions.Item label="Purchase Unit">
                  {product.purchase_unit?.name || "N/A"}
                </Descriptions.Item>
                {product.alert_quantity && (
                  <Descriptions.Item label="Alert Quantity">
                    {product.alert_quantity}
                  </Descriptions.Item>
                )}
                {product.daily_sale_objective && (
                  <Descriptions.Item label="Daily Sale Objective">
                    {product.daily_sale_objective}
                  </Descriptions.Item>
                )}
              </Descriptions>

              {product.description && (
                <>
                  <Divider orientation="left">Description</Divider>
                  <div className="product-description">
                    {product.description}
                  </div>
                </>
              )}
            </Space>
          </Card>

          <Tabs defaultActiveKey="variants" style={{ marginTop: 16 }}>
            <TabPane
              tab={
                <span>
                  <TagOutlined />
                  Variants
                </span>
              }
              key="variants"
            >
              <Card bordered={false}>
                {product.variants && product.variants.length > 0 ? (
                  <Table
                    dataSource={product.variants}
                    columns={variantColumns}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  />
                ) : (
                  <Text type="secondary">No variants available</Text>
                )}
              </Card>
            </TabPane>

            <TabPane
              tab={
                <span>
                  <ShopOutlined />
                  Branch Prices
                </span>
              }
              key="branchPrices"
            >
              <Card bordered={false}>
                {product.branch_prices && product.branch_prices.length > 0 ? (
                  <Table
                    dataSource={product.branch_prices}
                    columns={branchPriceColumns}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  />
                ) : (
                  <Text type="secondary">No branch prices available</Text>
                )}
              </Card>
            </TabPane>

            <TabPane
              tab={
                <span>
                  <BarcodeOutlined />
                  Serial Numbers
                </span>
              }
              key="serials"
            >
              <Card bordered={false}>
                {product.serial_numbers && product.serial_numbers.length > 0 ? (
                  <Table
                    dataSource={product.serial_numbers}
                    columns={serialColumns}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  />
                ) : (
                  <Text type="secondary">No serial numbers available</Text>
                )}
              </Card>
            </TabPane>
          </Tabs>
        </Col>
      </Row>
    </>
  );
};

export default ProductDetailsPage;
