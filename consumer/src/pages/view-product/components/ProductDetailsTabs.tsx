import { SettingOutlined, ShopOutlined } from "@ant-design/icons";
import { Card, Tabs } from "antd";
import VariantsTab from "./VariantsTab";
import InventoryTab from "./InventoryTab";

interface ProductDetailsTabsProps {
  product: any;
}

const ProductDetailsTabs: React.FC<ProductDetailsTabsProps> = ({ product }) => {
  // Count total inventory items
  const totalInventoryItems =
    product.variants?.reduce((total, variant) => {
      return total + (variant.inventory_items?.length || 0);
    }, 0) || 0;

  return (
    <Tabs
      defaultActiveKey="variants"
      style={{ marginTop: 16 }}
      items={[
        {
          key: "variants",
          label: (
            <span>
              <SettingOutlined />
              Variants ({product.variants?.length || 0})
            </span>
          ),
          children: (
            <Card variant="borderless">
              <VariantsTab variants={product.variants || []} />
            </Card>
          ),
        },
        {
          key: "inventory",
          label: (
            <span>
              <ShopOutlined />
              Inventory ({totalInventoryItems})
            </span>
          ),
          children: (
            <Card variant="borderless">
              <InventoryTab product={product} />
            </Card>
          ),
        },
      ]}
    />
  );
};

export default ProductDetailsTabs;
