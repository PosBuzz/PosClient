import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, Space } from "antd";
import { useEffect } from "react";

export default function SerialInput() {
  const parentForm = Form.useFormInstance(); // Get the parent form instance
  
  // Register with parent form on mount
  useEffect(() => {
    // This ensures the component registers with the form even if not visible
  }, [parentForm]);

  return (
    <div className="space-y-4">
      <Alert 
        message="Serial Numbers / IMEI" 
        description="For products with unique identifiers like serial numbers or IMEI codes."
        type="info" 
        showIcon 
        className="mb-4!"
      />
      
      <Form.List name="serials">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                <Form.Item
                  {...restField}
                  name={name}
                  rules={[{ required: true, message: 'Please enter serial number' }]}
                  style={{ width: '100%', marginBottom: 0 }}
                  preserve={true}
                >
                  <Input placeholder={`Serial/IMEI #${name + 1}`} />
                </Form.Item>
                <MinusCircleOutlined onClick={() => remove(name)} className="text-red-500" />
              </Space>
            ))}
            <Form.Item>
              <Button 
                type="dashed" 
                onClick={() => add()} 
                block 
                icon={<PlusOutlined />}
                className="mt-2"
              >
                Add Serial Number
              </Button>
            </Form.Item>
          </>
        )}
      </Form.List>
    </div>
  );
}
