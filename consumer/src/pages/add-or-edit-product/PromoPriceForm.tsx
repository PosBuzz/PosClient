import { Alert, Checkbox, DatePicker, Form, InputNumber } from "antd";
import dayjs from "dayjs";
import { useEffect } from "react";

export default function PromoPriceForm() {
  const parentForm = Form.useFormInstance();
  const enabled = Form.useWatch("promo_enabled")

  // Register with parent form on mount
  useEffect(() => {
    // This ensures the component registers with the form even if not visible
  }, [parentForm]);
  return (
    <div className="space-y-4">
      <Alert
        message="Promotional Pricing"
        description="Set a promotional price with a specific time range. The product will automatically switch to this price during the configured period."
        type="info"
        showIcon
        className="mb-4!"
      />

      <Form.Item name="promo_enabled" valuePropName="checked" noStyle>
        <Checkbox
          checked={enabled}
        >
          Enable Promotional Pricing
        </Checkbox>
      </Form.Item>

      {enabled && (
        <div className="space-x-4! p-4 rounded grid md:grid-cols-2 ">
          <Form.Item
            name={["promotional_price", "price"]}
            label="Promotional Price"
            rules={[
              { required: enabled, message: "Please enter promotional price" },
            ]}
            preserve={true}
          >
            <InputNumber
              placeholder="Promotional Price"
              min={0}
              className="w-full!"
              formatter={(value) =>
                `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) => value!.replace(/\$\s?|(,*)/g, "")}
            />
          </Form.Item>

          <Form.Item
            name="promo_date_range"
            label="Promotion Date Range"
            rules={[
              {
                required: enabled,
                message: "Please select promotion date range",
              },
            ]}
            preserve={true}
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
            <DatePicker.RangePicker className="w-full" showTime />
          </Form.Item>
        </div>
      )}
    </div>
  );
}
