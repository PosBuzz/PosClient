import { DeleteOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, InputNumber } from "antd";
import { useEffect } from "react";

export default function VariantManager() {
  const parentForm = Form.useFormInstance(); // Get the parent form instance

  // Initialize any internal state from the parent form if needed
  useEffect(() => {
    // This runs when the component mounts, ensuring it's registered with the form
    const currentVariants = parentForm.getFieldValue("variants") || [];
    // If there's any initialization needed based on current variant data
    // you can do it here
  }, [parentForm]);

  return (
    <div className="space-y-4">
      <Alert
        message="Product Variants"
        description="Define different versions of this product (e.g., sizes, colors). Each variant can have its own item code, cost, and price."
        type="info"
        showIcon
        className="mb-4!"
      />

      <Form.List name="variants">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <div key={key} className="space-y-2 p-4 border rounded">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Form.Item
                    {...restField}
                    name={[name, "option"]}
                    label="Variant Type"
                    rules={[
                      { required: true, message: "Please enter variant type" },
                    ]}
                    preserve={true}
                  >
                    <Input placeholder="e.g. Size, Color, Material" />
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    name={[name, "item_code"]}
                    label="Item Code"
                    preserve={true}
                  >
                    <Input placeholder="Optional unique code for this variant" />
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    name={[name, "value"]}
                    label="Values (comma separated)"
                    rules={[
                      {
                        required: true,
                        message: "Please enter variant values",
                      },
                    ]}
                    className="md:col-span-2"
                    preserve={true}
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
                    preserve={true}
                  >
                    <InputNumber
                      type="number"
                      className="w-full!"
                      min={0}
                      prefix="$"
                    />
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    name={[name, "price"]}
                    label="Price"
                    preserve={true}
                  >
                    <InputNumber className="w-full!" min={0} prefix="$" />
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
