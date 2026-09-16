import { SettingOutlined, ShopOutlined } from "@ant-design/icons";
import { Card, Tabs } from "antd";
import VariantsTab from "./VariantsTab";
import InventoryTab from "./InventoryTab";

const { TabPane } = Tabs;

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
          <VariantsTab variants={product.variants || []} />
        </Card>
      </TabPane>

      <TabPane
        tab={
          <span>
            <ShopOutlined />
            Inventory ({totalInventoryItems})
          </span>
        }
        key="inventory"
      >
        <Card bordered={false}>
          <InventoryTab product={product} />
        </Card>
      </TabPane>
    </Tabs>
  );
};

export default ProductDetailsTabs;
