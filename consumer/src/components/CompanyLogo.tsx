import { useState } from "react";
import { theme } from "antd";
import { useAuthStore } from "../stores/authStore";
import { appIconUrl } from "../utils/brand-image";

/**
 * Shared company branding for small square spots: the app icon if uploaded, else the logo,
 * trimmed and sized for the spot. Falls back to the original image, then to initials.
 */
export default function CompanyLogo({ size = 36 }: { size?: number }) {
  const user = useAuthStore((state) => state.user);
  const { token } = theme.useToken();
  const [failed, setFailed] = useState<string[]>([]);
  const name = user?.company_name?.trim() || "PosBuzz";
  const original = user?.logo_icon?.trim() || user?.logo?.trim();
  const candidates = original
    ? Array.from(new Set([appIconUrl(original, size), original]))
    : [];
  const source = candidates.find((url) => !failed.includes(url));
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
      {source ? (
        <img
          key={source}
          src={source}
          alt={`${name} logo`}
          onError={() => setFailed((list) => [...list, source])}
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
