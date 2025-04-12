import { Breadcrumb, Space, Typography } from "antd";
import { Link } from "react-router-dom";
import { ReactNode } from "react";

const { Title } = Typography;

interface BreadcrumbItem {
  title: string;
  href?: string;
}

interface PageTitleProps {
  title: string;
  breadcrumbs: BreadcrumbItem[];
  rightSection?: ReactNode;
}

import type { BreadcrumbItemType } from "antd/es/breadcrumb/Breadcrumb";

function itemRender(
  route: Partial<BreadcrumbItemType>,
  _params: any,
  routes: Partial<BreadcrumbItemType>[],
  _paths: string[]
): ReactNode {
  const isLast = routes.indexOf(route) === routes.length - 1;

  if (isLast) {
    return <span style={{ color: "#1f1f1f", fontWeight: 500 }}>{route.title}</span>;
  }

  return (
    <Link
      to={(route.href as string) || "#"}
      style={{ color: "#8c8c8c", fontWeight: 500 }}
    >
      {route.title}
    </Link>
  );
}

function PageTitle({ title, breadcrumbs, rightSection }: PageTitleProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        rowGap: 12,
        marginBottom: 24,
      }}
    >
      <div>
        <Breadcrumb
          style={{ fontSize: "13px", marginBottom: 4 }}
          separator=">"
          items={breadcrumbs}
          itemRender={itemRender}
        />
        <Title level={4} style={{ margin: 0 }}>
          {title}
        </Title>
      </div>

      {rightSection && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {rightSection}
        </div>
      )}
    </div>
  );
}

export default PageTitle;
