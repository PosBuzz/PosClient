import { Button, Input, InputNumber, Form, Alert } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { ProductVariant } from "../../types/product.types";

export default function VariantManager() {
  return (
    <div className="space-y-4">
      <Alert 
        message="Product Variants" 
        description="Define different versions of this product (e.g., sizes, colors). Each variant can have its own item code, cost, and price."
        type="info" 
        showIcon 
        className="mb-4"
      />
      
      <Form.List name="variants">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <div key={key} className="space-y-2 p-4 border rounded bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Form.Item
                    {...restField}
                    name={[name, "option"]}
                    label="Variant Type"
                    rules={[{ required: true, message: 'Please enter variant type' }]}
                  >
                    <Input placeholder="e.g. Size, Color, Material" />
                  </Form.Item>
                  
                  <Form.Item
                    {...restField}
                    name={[name, "item_code"]}
                    label="Item Code"
                  >
                    <Input placeholder="Optional unique code for this variant" />
                  </Form.Item>
                  
                  <Form.Item
                    {...restField}
                    name={[name, "value"]}
                    label="Values (comma separated)"
                    rules={[{ required: true, message: 'Please enter variant values' }]}
                    className="md:col-span-2"
                  >
                    <Input.TextArea 
                      placeholder="e.g. Small,Medium,Large or Red,Blue,Green" 
                      rows={2}
                    />
                  </Form.Item>
                  
                  <Form.Item
                    {...restField}
                    name={[name, "cost"]}
                    label="Cost"
                  >
                    <InputNumber 
                      className="w-full" 
                      min={0} 
                      placeholder="Cost" 
                      formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                    />
                  </Form.Item>
                  
                  <Form.Item
                    {...restField}
                    name={[name, "price"]}
                    label="Price"
                  >
                    <InputNumber 
                      className="w-full" 
                      min={0} 
                      placeholder="Price" 
                      formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                    />
                  </Form.Item>
                </div>
                <Button 
                  danger 
                  icon={<DeleteOutlined />} 
                  onClick={() => remove(name)}
                >
                  Remove Variant
                </Button>
              </div>
            ))}
            <Button 
              type="dashed" 
              onClick={() => add()} 
              className="w-full"
              icon={<span className="mr-2">+</span>}
            >
              Add Variant
            </Button>
          </>
        )}
      </Form.List>
    </div>
  );
}
