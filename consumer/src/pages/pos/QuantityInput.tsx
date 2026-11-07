import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Space } from "antd";
import { useEffect, useState } from "react";
import NumberInput from "../../components/NumberInput";

type Props = {
  value: number;
  name: string;
  onChange: (quantity: number) => void;
};

export default function QuantityInput({ value, name, onChange }: Props) {
  const [draft, setDraft] = useState<number | null>(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <Space.Compact style={{ maxWidth: "100%" }}>
      <Button
        aria-label={`Decrease ${name}`}
        icon={<MinusOutlined />}
        onClick={() => onChange(value - 1)}
      />
      <NumberInput
        aria-label={`Quantity for ${name}`}
        min={1}
        precision={0}
        controls={false}
        keyboard={false}
        changeOnBlur={false}
        value={draft}
        onChange={(next) => {
          setDraft(next);
          if (next !== null && Number.isInteger(next) && next > 0) {
            onChange(next);
          }
        }}
        onBlur={() => setDraft(value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setDraft(value);
            event.currentTarget.blur();
          }
        }}
        style={{ width: 60, textAlign: "center" }}
      />
      <Button
        aria-label={`Increase ${name}`}
        icon={<PlusOutlined />}
        onClick={() => onChange(value + 1)}
      />
    </Space.Compact>
  );
}
