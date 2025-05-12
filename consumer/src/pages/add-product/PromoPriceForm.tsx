import { DatePicker, InputNumber, Switch } from "antd";
import { useState } from "react";

export default function PromoPriceForm() {
  const [enabled, setEnabled] = useState(false);

  return (
    <div className="space-y-4">
      <Switch checked={enabled} onChange={setEnabled} /> Enable Promo Pricing
      {enabled && (
        <>
          <InputNumber placeholder="Promo Price" min={0} className="w-full" />
          <DatePicker.RangePicker className="w-full" />
        </>
      )}
    </div>
  );
}
