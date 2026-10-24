import { Flex, Typography, theme } from "antd";
import { useState } from "react";
import { appIconUrl, pdfLogoUrl } from "../../utils/brand-image";

/** First usable URL in an Upload fileList (new upload or the saved image). */
export const fileListUrl = (fileList: unknown): string | undefined => {
  if (!Array.isArray(fileList) || fileList.length === 0) return undefined;
  const file = fileList[0];
  return (
    file?.response?.data?.secure_url || file?.url || file?.thumbUrl || undefined
  );
};

function Preview({
  src,
  alt,
  style,
  fallback,
}: {
  src?: string;
  alt: string;
  style: React.CSSProperties;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || src === failed) return <>{fallback}</>;
  return (
    <img
      key={src}
      src={src}
      alt={alt}
      onError={() => setFailed(src)}
      style={{ objectFit: "contain", ...style }}
    />
  );
}

/** Shows how the uploads will look in each place they are used. */
export default function BrandPreview({
  logoUrl,
  iconUrl,
  companyName,
}: {
  logoUrl?: string;
  iconUrl?: string;
  companyName: string;
}) {
  const { token } = theme.useToken();
  const squareSource = iconUrl || logoUrl;
  const initials = (companyName.trim() || "PosBuzz")
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const tile: React.CSSProperties = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: 8,
    padding: 12,
    background: token.colorBgContainer,
    flex: "1 1 200px",
    minWidth: 0,
  };
  const square = (size: number) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 8,
        border: `1px solid ${token.colorBorderSecondary}`,
        overflow: "hidden",
        fontWeight: 700,
        fontSize: size * 0.36,
        flexShrink: 0,
      }}
    >
      <Preview
        src={squareSource && appIconUrl(squareSource, size)}
        alt={`App icon at ${size} px`}
        style={{ width: "100%", height: "100%", padding: 3 }}
        fallback={initials}
      />
    </span>
  );
  const receipt = (thermal: boolean) => (
    <div
      style={{
        background: "#fff",
        color: "#000",
        border: "1px dashed #bbb",
        padding: "10px 8px",
        textAlign: "center",
        maxWidth: 220,
        margin: "0 auto",
      }}
    >
      <Preview
        src={logoUrl && pdfLogoUrl(logoUrl)}
        alt={thermal ? "Logo on a thermal receipt" : "Logo on a PDF receipt"}
        style={{
          maxWidth: 120,
          maxHeight: 60,
          display: "block",
          margin: "0 auto 6px",
          filter: thermal ? "grayscale(1) contrast(1.8)" : undefined,
        }}
        fallback={null}
      />
      <div style={{ fontWeight: 700, fontSize: 13 }}>
        {companyName || "Your shop"}
      </div>
      <div style={{ fontSize: 11 }}>Receipt #1001</div>
    </div>
  );

  return (
    <Flex gap={12} wrap="wrap" data-testid="brand-preview">
      <div style={tile}>
        <Typography.Text strong>App sidebar &amp; POS</Typography.Text>
        <Flex gap={12} align="center" style={{ marginTop: 10 }}>
          {square(36)}
          {square(42)}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {iconUrl
              ? "Uses your app icon"
              : "Uses your logo (no app icon yet)"}
          </Typography.Text>
        </Flex>
      </div>
      <div style={tile}>
        <Typography.Text strong>Receipts &amp; PDFs</Typography.Text>
        <div style={{ marginTop: 10 }}>{receipt(false)}</div>
      </div>
      <div style={tile}>
        <Typography.Text strong>Thermal printer (black only)</Typography.Text>
        <div style={{ marginTop: 10 }}>{receipt(true)}</div>
      </div>
    </Flex>
  );
}
