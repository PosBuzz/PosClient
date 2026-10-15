import { InputNumber, type InputNumberProps } from "antd";

// Drops leading zeros as the user types ("007" -> "7", "-007" -> "-7", but
// "0.5" and "0" stay), so a box can never fill up with 00000000755.
const stripLeadingZeros = (text: string) => text.replace(/^(-?)0+(?=\d)/, "$1");

const decimalsOf = (n: number | string | undefined) => {
  if (n === undefined || n === null) return 0;
  const [, fraction = ""] = String(n).split(".");
  return fraction.length;
};

/**
 * antd's InputNumber with the leading-zero pile-up fixed. Everything else is
 * the same, so it is a drop-in replacement for `InputNumber` from antd.
 */
export default function NumberInput<T extends number | string = number>(
  props: InputNumberProps<T>,
) {
  const { formatter, precision, step, ...rest } = props;
  return (
    <InputNumber<T>
      {...rest}
      precision={precision}
      step={step}
      formatter={(value, info) => {
        if (formatter) return formatter(value, info);
        if (info.userTyping) return stripLeadingZeros(info.input);
        if (value === undefined || value === null || value === "") return "";
        // A custom formatter switches antd's own decimal padding off, so redo it:
        // the given precision, else as many decimals as the value or step has
        const n = Number(value);
        if (!Number.isFinite(n)) return String(value);
        const places =
          precision ?? Math.max(decimalsOf(value), decimalsOf(step));
        return n.toFixed(places);
      }}
    />
  );
}
