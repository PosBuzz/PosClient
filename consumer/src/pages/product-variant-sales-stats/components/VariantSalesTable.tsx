import { Money } from "../../../components/Currency";
import { EyeOutlined } from "@ant-design/icons";
import { Button, Table, Tag, Typography } from "antd";
import dayjs from "dayjs";
import React from "react";
import { useNavigate } from "react-router-dom";

const { Text } = Typography;

interface VariantSalesTableProps {
  data: any[];
  loading: boolean;
  dateRange: [dayjs.Dayjs, dayjs.Dayjs];
  branchId?: number | null;
  pagination: {
    current: number;
    pageSize: number;
    total: number;
  };
  onPaginationChange: (page: number, pageSize: number) => void;
}

const VariantSalesTable: React.FC<VariantSalesTableProps> = ({
  data,
  loading,
  dateRange,
  branchId,
  pagination,
  onPaginationChange,
}) => {
  const navigate = useNavigate();

  const handleView = (record: any) => {
    navigate(`/product-variant-sales-stats/${record.variant_id}`, {
      state: {
        startDate: dateRange[0].format("YYYY-MM-DD"),
        endDate: dateRange[1].format("YYYY-MM-DD"),
        branchId: branchId ?? null,
        variantName: record.variant_name,
        productName: record.product_name,
      },
    });
  };

  const columns = [
    {
      title: "Product",
      dataIndex: "product_name",
      key: "product_name",
      render: (_: any, record: any) => (
        <div>
          <Text strong>{record.product_name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
            {record.variant_name}
          </Text>
          {record.sku && (
            <Text color="default" style={{ fontSize: 11 }}>
              SKU: {record.sku}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "Total Sales",
      dataIndex: "total_sales",
      key: "total_sales",
      align: "center" as const,
      render: (count: number) => (
        <Tag color={count > 0 ? "green" : "default"}>{count}</Tag>
      ),
      sorter: (a: any, b: any) => a.total_sales - b.total_sales,
    },
    {
      title: "Total Qty",
      dataIndex: "total_qty",
      key: "total_qty",
      align: "right" as const,
      render: (v: number) => <Text>{Number(v).toLocaleString()}</Text>,
    },
    {
      title: "Total Amount",
      dataIndex: "total_amount",
      key: "total_amount",
      align: "right" as const,
      render: (v: number) => (
        <Text type="success" strong>
          <Money value={v} />
        </Text>
      ),
      sorter: (a: any, b: any) => a.total_amount - b.total_amount,
    },
    {
      title: "Actions",
      key: "actions",
      align: "center" as const,
      render: (_: any, record: any) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleView(record)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <Table
      dataSource={data}
      columns={columns}
      rowKey="variant_id"
      loading={loading}
      pagination={{
        current: pagination.current,
        pageSize: pagination.pageSize,
        total: pagination.total,
        showSizeChanger: true,
        showTotal: (total, range) =>
          `${range[0]}-${range[1]} of ${total} variants`,
        onChange: onPaginationChange,
      }}
      scroll={{ x: "max-content" }}
    />
  );
};

export default VariantSalesTable;
