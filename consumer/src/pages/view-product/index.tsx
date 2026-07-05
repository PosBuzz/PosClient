import {
  ArrowLeftOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Col, Row, Space, Typography } from "antd";
import { Link, useNavigate, useParams } from "react-router-dom";
import { productApi } from "../../api/product-api";
import PageTitle from "../../components/PageTitle";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import { useAuthStore } from "../../stores/authStore";
import { Permissions } from "../../constants/permissions";
import ProductImageCard from "./components/ProductImageCard";
import ProductPricingCard from "./components/ProductPricingCard";
import ProductTagsCard from "./components/ProductTagsCard";
import ProductBasicInfo from "./components/ProductBasicInfo";
import ProductDetailsTabs from "./components/ProductDetailsTabs";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { setPageTitle } from "../../utils/setPageTitle";

const { Title, Text } = Typography;

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
    queryKey: [queryKeys.product, productId],
    queryFn: () => productApi.getProduct(productId),
    enabled: !!productId,
    staleTime: queryStaleTimeMap[queryKeys.product],
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

  return (
    <>
      {setPageTitle(`Product Details - ${product.name}`)}
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
            {hasPermission(Permissions.add_product) && (
              <Link to={`/products/add?copy_from=${productId}`}>
                <Button icon={<CopyOutlined />}>Copy Product</Button>
              </Link>
            )}
            {hasPermission(Permissions.delete_product) && (
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
          <ProductImageCard product={product} />
          <ProductPricingCard product={product} />
          <ProductTagsCard product={product} />
        </Col>

        <Col xs={24} md={16}>
          <ProductBasicInfo product={product} />
          <ProductDetailsTabs product={product} />
        </Col>
      </Row>
    </>
  );
};

export default ProductDetailsPage;
