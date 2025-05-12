import { DatePicker, InputNumber, Form, Alert } from "antd";
import { useState } from "react";
import dayjs from "dayjs";

export default function PromoPriceForm() {
  const [enabled, setEnabled] = useState(false);

  return (
    <div className="space-y-4">
      <Alert 
        message="Promotional Pricing" 
        description="Set a promotional price with a specific time range. The product will automatically switch to this price during the configured period."
        type="info" 
        showIcon 
        className="mb-4"
      />

      <Form.Item name="promo_enabled" valuePropName="checked">
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            className="mr-2"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>Enable Promotional Pricing</span>
        </div>
      </Form.Item>
      
      {enabled && (
        <div className="space-y-4 p-4 border rounded bg-gray-50">
          <Form.Item 
            name={["promotional_price", "price"]} 
            label="Promotional Price"
            rules={[{ required: enabled, message: "Please enter promotional price" }]}
          >
            <InputNumber 
              placeholder="Promotional Price" 
              min={0} 
              className="w-full" 
              formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value!.replace(/\$\s?|(,*)/g, '')}
            />
          </Form.Item>
          
          <Form.Item
            name="promo_date_range"
            label="Promotion Date Range"
            rules={[{ required: enabled, message: "Please select promotion date range" }]}
            getValueProps={(value) => ({
              value: value ? [dayjs(value[0]), dayjs(value[1])] : undefined,
            })}
            getValueFromEvent={(value) => {
              if (value) {
                return [value[0].toDate(), value[1].toDate()];
              }
              return undefined;
            }}
          >
            <DatePicker.RangePicker 
              className="w-full" 
              showTime 
            />
          </Form.Item>
        </div>
      )}
    </div>
  );
}
