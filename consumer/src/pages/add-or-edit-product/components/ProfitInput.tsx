import InputNumber from "../../../components/NumberInput";
import { useState } from "react";
import { round2 } from "../../../utils/number";

interface ProfitInputProps {
  /** Profit % worked out from cost and price, already rounded to 2 decimals */
  value: number | undefined;
  disabled?: boolean;
  onChange: (value: number | null) => void;
}

/**
 * Profit % shown next to a price. While the user types, their own text stays
 * put (the price it produces is rounded, which would otherwise rewrite the box
 * under their cursor); once they leave the box it shows the calculated value.
 */
export default function ProfitInput({
  value,
  disabled,
  onChange,
}: ProfitInputProps) {
  const [draft, setDraft] = useState<number | null | undefined>(undefined);
  const editing = draft !== undefined;

  return (
    <InputNumber
      style={{ width: "100%" }}
      min={-100}
      suffix="%"
      disabled={disabled}
      value={editing ? draft : value}
      onChange={(next) => {
        const rounded = next === null ? null : round2(Number(next));
        setDraft(rounded);
        onChange(rounded);
      }}
      onBlur={() => setDraft(undefined)}
    />
  );
}
