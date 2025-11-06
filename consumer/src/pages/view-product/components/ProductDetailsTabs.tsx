import { BarcodeOutlined, SettingOutlined, TagOutlined, ShopOutlined } from "@ant-design/icons";
import { Card, Tabs } from "antd";
import VariantsTab from "./VariantsTab";
import SerialsTab from "./SerialsTab";
import AttributesTab from "./AttributesTab";
import InventoryTab from "./InventoryTab";

const { TabPane } = Tabs;

interface ProductDetailsTabsProps {
  product: any;
}

const ProductDetailsTabs: React.FC<ProductDetailsTabsProps> = ({ product }) => {
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

  // Count total inventory items
  const totalInventoryItems = product.variants?.reduce((total, variant) => {
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
          <SerialsTab serials={allSerials} product={product} />
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
          <AttributesTab attributes={allAttributes} product={product} />
        </Card>
      </TabPane>
    </Tabs>
  );
};

export default ProductDetailsTabs;