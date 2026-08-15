import { Breadcrumb, Typography } from "antd";
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { BreadcrumbItemType } from "antd/es/breadcrumb/Breadcrumb";

const { Title } = Typography;

interface BreadcrumbItem extends Omit<BreadcrumbItemType, "title"> {
  title: string;
  href?: string;
}

interface PageTitleProps {
  title: string;
  breadcrumbs: BreadcrumbItem[];
  rightSection?: ReactNode;
}

function itemRender(
  route: Partial<BreadcrumbItemType>,
  _params: any,
  routes: Partial<BreadcrumbItemType>[],
  paths: string[],
): ReactNode {
  void paths;
  const isLast = routes.indexOf(route) === routes.length - 1;

  if (isLast) {
    return <span>{route.title}</span>;
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
