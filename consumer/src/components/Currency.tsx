import type { CSSProperties, ReactNode } from "react";
import { HiCurrencyBangladeshi } from "react-icons/hi";

type CurrencyIconProps = {
  size?: number;
  style?: CSSProperties;
  className?: string;
};

export const CurrencyIcon = ({
  size = 14,
  style,
  className,
}: CurrencyIconProps) => (
  <HiCurrencyBangladeshi
    aria-label="Taka"
    className={className}
    size={size}
    style={{ verticalAlign: "-0.12em", ...style }}
  />
);

type MoneyProps = {
  value: number | string | null | undefined;
  negative?: boolean;
  strong?: boolean;
  decimals?: number;
  suffix?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export const Money = ({
  value,
  negative = false,
  strong = false,
  decimals = 2,
  suffix,
  className,
  style,
}: MoneyProps) => {
  const amount = Number(value || 0);
  const content = (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {negative && <span>-</span>}
      <CurrencyIcon />
      <span>{amount.toFixed(decimals)}</span>
      {suffix}
    </span>
  );

  return strong ? <strong>{content}</strong> : content;
};

export const takaPrefix = <CurrencyIcon />;
