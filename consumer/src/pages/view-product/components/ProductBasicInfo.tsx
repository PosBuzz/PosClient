import { BarcodeOutlined } from "@ant-design/icons";
import { Card, Descriptions, Divider, Space, Tag, Typography } from "antd";
import { formatDate } from "../../../utils/formatters";
import useDarkMode from "../../../hooks/useDarkMode";

const { Title, Text } = Typography;

interface ProductBasicInfoProps {
  product: any;
}

const ProductBasicInfo: React.FC<ProductBasicInfoProps> = ({ product }) => {
  const isDarkMode = useDarkMode();

  // Determine product status badges
  const getProductStatusBadges = () => {
    const badges: React.ReactNode[] = [];

    if (product.has_variants) {
      badges.push(
        <Tag color="purple" key="variants">
          Has Variants ({product.variants?.length || 0})
        </Tag>,
      );
    } else {
      badges.push(
        <Tag color="blue" key="simple">
          Simple Product
        </Tag>,
      );
    }

    // Calculate total stock across all variants
    const totalStock =
      product.variants?.reduce((total, variant) => {
        return (
          total +
          (variant.inventory_items?.reduce(
            (sum, item) => sum + item.quantity,
            0,
          ) || 0)
        );
      }, 0) || 0;

    badges.push(
      <Tag color={totalStock > 0 ? "green" : "red"} key="stock">
        {totalStock > 0 ? `${totalStock} in stock` : "Out of stock"}
      </Tag>,
    );

    // Calculate total serials
    const totalSerials =
      product.variants?.reduce((total, variant) => {
        return total + (variant.serials?.length || 0);
      }, 0) || 0;

    if (totalSerials > 0) {
      const availableSerials =
        product.variants?.reduce((total, variant) => {
          return (
            total +
            (variant.serials?.filter((s) => s.status === "available").length ||
              0)
          );
        }, 0) || 0;

      badges.push(
        <Tag color={availableSerials > 0 ? "cyan" : "orange"} key="serials">
          {availableSerials}/{totalSerials} serials available
        </Tag>,
      );
    } // Check for low stock alerts (branch-based)
    const lowStockVariants =
      product.variants?.filter((variant) => {
        if (!variant.alert_quantity) return false;

        // Group inventory by branch
        const branchStockMap =
          variant.inventory_items?.reduce(
            (acc, item) => {
              acc[item.branch_id || 0] =
                (acc[item.branch_id || 0] || 0) + item.quantity;
              return acc;
            },
            {} as Record<number, number>,
          ) || {};
        // Check if any branch has low stock
        return Object.values(branchStockMap).some(
          (branchStock) =>
            (branchStock as number) <= (variant.alert_quantity || 0),
        );
      }).length || 0;

    if (lowStockVariants > 0) {
      badges.push(
        <Tag color="red" key="lowstock">
          {lowStockVariants} variant{lowStockVariants > 1 ? "s" : ""} low stock
        </Tag>,
      );
    }

    // Check for products with expiring inventory
    const hasExpiringInventory = product.variants?.some((variant) =>
      variant.inventory_items?.some((item) => {
        if (!item.expiry_date) return false;
        const expiryDate = new Date(item.expiry_date);
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        return expiryDate <= thirtyDaysFromNow;
      }),
    );

    if (hasExpiringInventory) {
      badges.push(
        <Tag color="orange" key="expiring">
          Expiring Stock
        </Tag>,
      );
    }

    return badges;
  };

  // Calculate price range for multi-variant products
  const getPriceRange = () => {
    if (!product.variants || product.variants.length === 0) return null;

    const prices = product.variants.map((v) => parseFloat(v.regular_price));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    return { minPrice, maxPrice };
  };

  const priceRange = getPriceRange();
  const totalDailyTarget =
    product.variants?.reduce(
      (total, variant) => total + (variant.daily_sale_objective || 0),
      0,
    ) || 0;
  const simpleVariantDailyTarget =
    product.variants?.[0]?.daily_sale_objective || 0;

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <div>
          <Title level={3}>{product.name}</Title>
          <Space size="middle" wrap>
            {getProductStatusBadges()}
          </Space>
        </div>

        <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="Product Code">
            <Space>
              <BarcodeOutlined />
              {product.code || "N/A"}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Category">
            {product.category?.name || "Uncategorized"}
          </Descriptions.Item>
          <Descriptions.Item label="Brand">
            {product.brand?.name || "No Brand"}
          </Descriptions.Item>
          <Descriptions.Item label="Product Type">
            {product.has_variants ? "Variable Product" : "Simple Product"}
          </Descriptions.Item>
          <Descriptions.Item label="Total Variants">
            {product.variants?.length || 0}
          </Descriptions.Item>
          <Descriptions.Item label="Tax Configuration">
            <Space direction="vertical" size="small">
              <Text>
                {product.tax}% ({product.tax_method})
              </Text>
            </Space>
          </Descriptions.Item>
          {priceRange && product.has_variants && (
            <Descriptions.Item label="Price Range" span={2}>
              <Text>
                ${priceRange.minPrice.toFixed(2)} - $
                {priceRange.maxPrice.toFixed(2)}
              </Text>
            </Descriptions.Item>
          )}
          {(!product.has_variants && simpleVariantDailyTarget > 0) ||
          (product.has_variants && totalDailyTarget > 0) ? (
            <Descriptions.Item label="Daily Sales Target">
              <Space>
                <Text strong>
                  {product.has_variants
                    ? totalDailyTarget
                    : simpleVariantDailyTarget}
                </Text>
                <Text type="secondary">units/day</Text>
              </Space>
            </Descriptions.Item>
          ) : null}
          <Descriptions.Item label="Total Stock">
            <Text strong>
              {product.variants?.reduce((total, variant) => {
                return (
                  total +
                  (variant.inventory_items?.reduce(
                    (sum, item) => sum + item.quantity,
                    0,
                  ) || 0)
                );
              }, 0) || 0}{" "}
              units
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="Total Serials">
            <Text>
              {product.variants?.reduce(
                (total, variant) => total + (variant.serials?.length || 0),
                0,
              ) || 0}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="Created">
            {formatDate(product.created_at)}
          </Descriptions.Item>
          <Descriptions.Item label="Last Updated">
            {formatDate(product.updated_at)}
          </Descriptions.Item>
        </Descriptions>

        {product.description && (
          <>
            <Divider orientation="left">Description</Divider>
            <div
              className={`product-description ${
                isDarkMode ? "bg-black" : "bg-[#F5F5F5]"
              } p-4 rounded-lg leading-relaxed`}
            >
              {product.description}
            </div>
          </>
        )}
      </Space>
    </Card>
  );
};

export default ProductBasicInfo;
