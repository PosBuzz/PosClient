import { Form, Input, Button, Space, Alert } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";

export default function SerialInput() {
  return (
    <div className="space-y-4">
      <Alert 
        message="Serial Numbers / IMEI" 
        description="For products with unique identifiers like serial numbers or IMEI codes."
        type="info" 
        showIcon 
        className="mb-4"
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
