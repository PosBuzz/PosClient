import { DatePicker, InputNumber, Form, Alert, Checkbox } from "antd";
import { useState, useEffect } from "react";
import dayjs from "dayjs";

export default function PromoPriceForm() {
  const [form] = Form.useForm();
  const parentForm = Form.useFormInstance(); // Get the parent form instance
  const [enabled, setEnabled] = useState(false);

  // Initialize state based on form values
  useEffect(() => {
    const formValues = parentForm.getFieldValue(["promo_enabled"]);
    if (formValues !== undefined) {
      setEnabled(formValues);
    }
  }, [parentForm]);

  // When enabled state changes, update the form field
  useEffect(() => {
    parentForm.setFieldValue("promo_enabled", enabled);
  }, [enabled, parentForm]);

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
          onChange={(e) => setEnabled(e.target.checked)}
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
