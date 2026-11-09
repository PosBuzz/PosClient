import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Space } from "antd";
import { useEffect, useState } from "react";
import NumberInput from "./NumberInput";
import "./QuantityInput.css";

type Props = {
  value: number;
  name: string;
  onChange: (quantity: number) => void;
  /** Show the - and + buttons around the box (default). */
  buttons?: boolean;
  max?: number;
  width?: number | string;
  addonAfter?: string;
  status?: "error" | "warning";
};

/**
 * Whole-number quantity box. The box can be emptied or typed over freely: the
 * text is kept locally and only a valid whole number in 1..max is reported,
 * so clearing the field never snaps it back to 1 (and "5" never becomes "15").
 * On blur or Enter it falls back to the last good quantity.
 */
export default function QuantityInput({
  value,
  name,
  onChange,
  buttons = true,
  max,
  width = 60,
  addonAfter,
  status,
}: Props) {
  const [draft, setDraft] = useState<number | null>(value);
  useEffect(() => setDraft(value), [value]);
  const clamp = (next: number) => Math.min(max ?? Infinity, Math.max(1, next));
  const input = (
    <NumberInput
      aria-label={`Quantity for ${name}`}
      min={1}
      max={max}
      precision={0}
      controls={false}
      keyboard={false}
      changeOnBlur={false}
      status={status}
      addonAfter={addonAfter}
      value={draft}
      onChange={(next) => {
        setDraft(next);
        if (
          next !== null &&
          Number.isInteger(next) &&
          next > 0 &&
          (max === undefined || next <= max)
        ) {
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
      className="qty-input"
      style={{
        width,
        minWidth: typeof width === "number" ? width : undefined,
        flex: buttons ? "none" : undefined,
      }}
    />
  );
  if (!buttons) return input;
  return (
    <Space.Compact style={{ minWidth: (typeof width === "number" ? width : 60) + 64, flex: "none" }}>
      <Button
        aria-label={`Decrease ${name}`}
        icon={<MinusOutlined />}
        onClick={() => onChange(value - 1)}
      />
      {input}
      <Button
        aria-label={`Increase ${name}`}
        icon={<PlusOutlined />}
        onClick={() => onChange(clamp(value + 1))}
      />
    </Space.Compact>
  );
}
