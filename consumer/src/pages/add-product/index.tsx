// Root Form Layout with modular fields & Ant Design + Tailwind
import {
  Card,
  Input,
  Select,
  Checkbox,
  InputNumber,
  Button,
  Form,
  Divider,
} from "antd";
import TextArea from "antd/es/input/TextArea";
import VariantManager from "./VariantManager";
import BranchPricing from "./BranchPricing";
import PromoPriceForm from "./PromoPriceForm";
import SerialInput from "./SerialInput";
// import ImageUploader from "./ImageUploader";
import CommonSelector from "./CommonSelector";

const { Option } = Select;

export default function ProductForm() {
  const [form] = Form.useForm();

  return (
    <Form
      form={form}
      layout="vertical"
      className="p-4 space-y-4 mx-auto"
    >
      <Card title="Product Info" className="shadow rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Form.Item
            name="type"
            label="Product Type"
            rules={[{ required: true }]}
          >
            <Select placeholder="Select Type">
              <Option value="STANDARD">Standard</Option>
              <Option value="DIGITAL">Digital</Option>
              <Option value="SERVICE">Service</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="name"
            label="Product Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="code"
            label="Product Code"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="category_id"
            label="Category"
            rules={[{ required: true }]}
          >
            <CommonSelector type="category" />
          </Form.Item>
          <Form.Item name="brand_id" label="Brand" rules={[{ required: true }]}>
            <CommonSelector type="brand" />
          </Form.Item>
          <Form.Item
            name="product_unit_id"
            label="Product Unit"
            rules={[{ required: true }]}
          >
            <CommonSelector type="unit" subtype="product" />
          </Form.Item>
          <Form.Item name="purchase_unit_id" label="Purchase Unit">
            <CommonSelector type="unit" subtype="purchase" />
          </Form.Item>
          <Form.Item name="sale_unit_id" label="Sale Unit">
            <CommonSelector type="unit" subtype="sale" />
          </Form.Item>
          <Form.Item
            name="cost"
            label="Product Cost"
            rules={[{ required: true }]}
          >
            <InputNumber className="w-full" min={0} />
          </Form.Item>
          <Form.Item
            name="price"
            label="Product Price"
            rules={[{ required: true }]}
          >
            <InputNumber className="w-full" min={0} />
          </Form.Item>
          <Form.Item name="wholesale_price" label="Wholesale Price">
            <InputNumber className="w-full" min={0} />
          </Form.Item>
        </div>
      </Card>

      <Card title="More Details" className="shadow rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Form.Item name="daily_sale_objective" label="Daily Sale Objective">
            <InputNumber className="w-full" min={0} />
          </Form.Item>
          <Form.Item name="barcode_symbology" label="Barcode Symbology">
            <Select>
              <Option value="CODE128">Code 128</Option>
              <Option value="EAN13">EAN 13</Option>
              <Option value="EAN8">EAN 8</Option>
              <Option value="UPC">UPC</Option>
            </Select>
          </Form.Item>
          <Form.Item name="alert_quantity" label="Alert Quantity">
            <InputNumber className="w-full" min={0} />
          </Form.Item>
          <Form.Item name="product_tax" label="Product Tax">
            <Input placeholder="% or value" />
          </Form.Item>
          <Form.Item name="tax_method" label="Tax Method">
            <Select allowClear>
              <Option value="EXCLUSIVE">Exclusive</Option>
              <Option value="INCLUSIVE">Inclusive</Option>
            </Select>
          </Form.Item>
          <Form.Item name="featured" valuePropName="checked">
            <Checkbox>Featured</Checkbox>
          </Form.Item>
          <Form.Item name="sell_online" valuePropName="checked">
            <Checkbox>Sell Online</Checkbox>
          </Form.Item>
          <Form.Item name="in_stock" valuePropName="checked">
            <Checkbox>In Stock</Checkbox>
          </Form.Item>
        </div>
        <Form.Item name="description" label="Product Details">
          <TextArea rows={4} />
        </Form.Item>
        {/* <Form.Item name="image_url" label="Product Image">
          <ImageUploader />
        </Form.Item> */}
      </Card>

      <Card title="Variants & Branch Pricing" className="shadow rounded-2xl">
        <VariantManager />
        <Divider />
        <BranchPricing />
      </Card>

      <Card title="Optional Details" className="shadow rounded-2xl">
        <PromoPriceForm />
        <Divider />
        <SerialInput />
        <Form.Item name="tag_id" label="Tag" rules={[{ required: true }]}>
          <CommonSelector type="tag" />
        </Form.Item>
      </Card>

      <div className="text-right">
        <Button type="primary" htmlType="submit">
          Add Product
        </Button>
      </div>
    </Form>
  );
}
