import { useState } from "react";
import { theme } from "antd";
import { useAuthStore } from "../stores/authStore";

/** Shared company branding, including a fallback for missing or broken uploads. */
export default function CompanyLogo({ size = 36 }: { size?: number }) {
  const user = useAuthStore((state) => state.user);
  const { token } = theme.useToken();
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const name = user?.company_name?.trim() || "PosBuzz";
  const source = user?.logo?.trim();
  const initials =
    name === "PosBuzz"
      ? "PB"
      : name
          .split(/\s+/)
          .map((word) => word[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();

  return (
    <span
      title={name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flexShrink: 0,
        overflow: "hidden",
        borderRadius: 8,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        color: token.colorText,
        fontSize: size * 0.36,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {source && source !== failedSource ? (
        <img
          key={source}
          src={source}
          alt={`${name} logo`}
          onError={() => setFailedSource(source)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            padding: 3,
          }}
        />
      ) : (
        <span role="img" aria-label={`${name} logo`}>
          {initials}
        </span>
      )}
    </span>
  );
}
