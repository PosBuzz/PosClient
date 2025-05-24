import {
  ArrowLeftOutlined,
  BarcodeOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DollarOutlined,
  EditOutlined,
  ShopOutlined,
  TagOutlined,
  SettingOutlined,
  AlertOutlined,
  PictureOutlined,
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
  Badge,
  Tooltip,
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

  // Get the main variant (default variant for simple products)
  const mainVariant = product.variants?.find((v) => v.is_default) || product.variants?.[0];

  // Determine product status badges
  const getProductStatusBadges = () => {
    const badges: React.ReactNode[] = [];

    if (product.has_variants) {
      badges.push(
        <Tag color="purple" key="variants">
          Has Variants
        </Tag>
      );
    } else {
      badges.push(
        <Tag color="blue" key="simple">
          Simple Product
        </Tag>
      );
    }

    // Calculate total stock across all variants
    const totalStock =
      product.variants?.reduce((total, variant) => {
        return (
          total +
          (variant.inventory_items?.reduce((sum, item) => sum + item.quantity, 0) || 0)
        );
      }, 0) || 0;

    badges.push(
      <Tag color={totalStock > 0 ? "green" : "red"} key="stock">
        {totalStock > 0 ? `${totalStock} in stock` : "Out of stock"}
      </Tag>
    );

    return badges;
  };

  // Variant columns for the variants table
  const variantColumns = [
    {
      title: "Variant Name",
      dataIndex: "name",
      key: "name",
      render: (name, record) => (
        <Space>
          {record.is_default && <Badge status="success" text="Default" />}
          <Text strong={record.is_default}>{name}</Text>
        </Space>
      ),
    },
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      render: (sku) => sku || <Text type="secondary">N/A</Text>,
    },
    {
      title: "Barcode",
      dataIndex: "barcode",
      key: "barcode",
      render: (barcode) => barcode || <Text type="secondary">N/A</Text>,
    },
    {
      title: "Cost Price",
      dataIndex: "cost_price",
      key: "cost_price",
      render: (cost) => formatCurrency(parseFloat(cost)),
    },
    {
      title: "Regular Price",
      dataIndex: "regular_price",
      key: "regular_price",
      render: (price) => formatCurrency(parseFloat(price)),
    },
    {
      title: "Wholesale Price",
      dataIndex: "wholesale_price",
      key: "wholesale_price",
      render: (price) => (price ? formatCurrency(parseFloat(price)) : <Text type="secondary">N/A</Text>),
    },
    {
      title: "Stock",
      key: "stock",
      render: (_, record) => {
        const totalStock = record.inventory_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        const isLowStock = record.alert_quantity && totalStock <= record.alert_quantity;

        return (
          <Space>
            <Text style={{ color: isLowStock ? "#ff4d4f" : totalStock > 0 ? "#52c41a" : "#8c8c8c" }}>
              {totalStock}
            </Text>
            {isLowStock && (
              <Tooltip title="Low stock alert">
                <AlertOutlined style={{ color: "#ff4d4f" }} />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: "Serials",
      key: "serials",
      render: (_, record) => {
        const availableSerials = record.serials?.filter((s) => s.status === "available").length || 0;
        const totalSerials = record.serials?.length || 0;

        if (totalSerials === 0) {
          return <Text type="secondary">No serials</Text>;
        }

        return (
          <Tooltip title={`${availableSerials} available out of ${totalSerials} total`}>
            <Badge count={totalSerials} showZero color={availableSerials > 0 ? "green" : "red"}>
              <BarcodeOutlined />
            </Badge>
          </Tooltip>
        );
      },
    },
  ];

  // Serial numbers columns
  const serialColumns = [
    {
      title: "Serial Number",
      dataIndex: "serial_number",
      key: "serial_number",
      render: (serial) => (
        <Text code style={{ fontSize: "12px" }}>
          {serial}
        </Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        const colors = {
          available: "green",
          sold: "blue",
          defective: "red",
          returned: "orange",
        };
        return <Tag color={colors[status] || "default"}>{status?.toUpperCase()}</Tag>;
      },
    },
    {
      title: "Notes",
      dataIndex: "notes",
      key: "notes",
      render: (notes) => notes || <Text type="secondary">-</Text>,
    },
    {
      title: "Variant",
      key: "variant",
      render: (_, record) => {
        // Find the variant this serial belongs to
        const variant = product.variants?.find((v) =>
          v.serials?.some((s) => s.id === record.id)
        );
        return variant ? variant.name : <Text type="secondary">Unknown</Text>;
      },
    },
    {
      title: "Added Date",
      dataIndex: "created_at",
      key: "created_at",
      render: (date) => (date ? formatDate(date) : <Text type="secondary">-</Text>),
    },
  ];

  // Attributes columns
  const attributeColumns = [
    {
      title: "Attribute",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Value",
      dataIndex: "value",
      key: "value",
    },
    {
      title: "Variant",
      key: "variant",
      render: (_, record) => {
        const variant = product.variants?.find((v) =>
          v.VariantAttribute?.some((attr) => attr.id === record.id)
        );
        return variant ? variant.name : <Text type="secondary">Unknown</Text>;
      },
    },
  ];

  // Collect all serials from all variants
  const allSerials =
    product.variants?.flatMap((variant) =>
      variant.serials?.map((serial) => ({
        ...serial,
        variant_name: variant.name,
      })) || []
    ) || [];

  // Collect all attributes from all variants
  const allAttributes =
    product.variants?.flatMap((variant) =>
      variant.VariantAttribute?.map((attr) => ({
        ...attr,
        variant_name: variant.name,
      })) || []
    ) || [];

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
          {/* Product Image */}
          <Card bodyStyle={{ padding: 0 }} className="product-image-card">
            {mainVariant?.image ? (
              <Image
                src={mainVariant.image}
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
                <Space direction="vertical" align="center">
                  <PictureOutlined style={{ fontSize: "48px", color: "#d9d9d9" }} />
                  <Text type="secondary">No Image Available</Text>
                </Space>
              </div>
            )}
          </Card>

          {/* Pricing Information */}
          <Card
            title="Pricing Information"
            style={{ marginTop: 16 }}
            extra={<DollarOutlined />}
          >
            {mainVariant ? (
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Cost Price">
                  {formatCurrency(parseFloat(mainVariant.cost_price))}
                </Descriptions.Item>
                <Descriptions.Item label="Regular Price">
                  {formatCurrency(parseFloat(mainVariant.regular_price))}
                </Descriptions.Item>
                {mainVariant.wholesale_price && (
                  <Descriptions.Item label="Wholesale Price">
                    {formatCurrency(parseFloat(mainVariant.wholesale_price))}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Tax">
                  {product.tax}% ({product.tax_method})
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Text type="secondary">No pricing information available</Text>
            )}
          </Card>

          {/* Tags */}
          <Card title="Tags" style={{ marginTop: 16 }} extra={<TagOutlined />}>
            {product.tags && product.tags.length > 0 ? (
              <Space wrap>
                {product.tags.map((tagRelation) => (
                  <Tag key={tagRelation.tag.id} color="blue">
                    {tagRelation.tag.name}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary">No tags assigned</Text>
            )}
          </Card>
        </Col>

        <Col xs={24} md={16}>
          {/* Basic Product Information */}
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
                    {product.code || "N/A"}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="Category">
                  {product.category?.name || "N/A"}
                </Descriptions.Item>
                <Descriptions.Item label="Brand">
                  {product.brand?.name || "N/A"}
                </Descriptions.Item>
                <Descriptions.Item label="Has Variants">
                  {product.has_variants ? "Yes" : "No"}
                </Descriptions.Item>
                {product.daily_sale_objective && (
                  <Descriptions.Item label="Daily Sale Objective">
                    {product.daily_sale_objective}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Created">
                  {formatDate(product.created_at)}
                </Descriptions.Item>
              </Descriptions>

              {product.description && (
                <>
                  <Divider orientation="left">Description</Divider>
                  <div className="product-description">{product.description}</div>
                </>
              )}
            </Space>
          </Card>

          {/* Tabs for detailed information */}
          <Tabs defaultActiveKey="variants" style={{ marginTop: 16 }}>
            <TabPane
              tab={
                <span>
                  <SettingOutlined />
                  Variants ({product.variants?.length || 0})
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
                    scroll={{ x: 800 }}
                  />
                ) : (
                  <Text type="secondary">No variants available</Text>
                )}
              </Card>
            </TabPane>

            <TabPane
              tab={
                <span>
                  <BarcodeOutlined />
                  Serial Numbers ({allSerials.length})
                </span>
              }
              key="serials"
            >
              <Card bordered={false}>
                {allSerials.length > 0 ? (
                  <Table
                    dataSource={allSerials}
                    columns={serialColumns}
                    rowKey="id"
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    size="small"
                  />
                ) : (
                  <Text type="secondary">No serial numbers available</Text>
                )}
              </Card>
            </TabPane>

            <TabPane
              tab={
                <span>
                  <TagOutlined />
                  Attributes ({allAttributes.length})
                </span>
              }
              key="attributes"
            >
              <Card bordered={false}>
                {allAttributes.length > 0 ? (
                  <Table
                    dataSource={allAttributes}
                    columns={attributeColumns}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  />
                ) : (
                  <Text type="secondary">No attributes available</Text>
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
