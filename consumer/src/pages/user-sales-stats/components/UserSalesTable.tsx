import { Money } from "../../../components/Currency";
import { EyeOutlined } from "@ant-design/icons";
import { Button, Table, Tag, Typography } from "antd";
import dayjs from "dayjs";
import React from "react";
import { useNavigate } from "react-router-dom";

const { Text } = Typography;

interface UserSalesTableProps {
  data: any[];
  loading: boolean;
  dateRange: dayjs.Dayjs[];
}

const UserSalesTable: React.FC<UserSalesTableProps> = ({
  data,
  loading,
  dateRange,
}) => {
  const navigate = useNavigate();

  const handleViewDetails = (record: any) => {

    navigate(`/user-sales-stats/${record.id}`, {
      state: {
        startDate: dateRange[0].format("YYYY-MM-DD"),
        endDate: dateRange[1].format("YYYY-MM-DD"),
        userName: record.name,
      },
    });
  };

  const columns = [
    {
      title: "User Name",
      dataIndex: "name",
      key: "name",
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      responsive: ["md"] as any,
    },
    {
      title: "Total Sales",
      dataIndex: "totalSales",
      key: "totalSales",
      align: "right" as const,
      render: (value: number) => (
        <Text type="success" strong>
          <Money value={value ?? 0} />
        </Text>
      ),
      sorter: (a: any, b: any) => a.totalSales - b.totalSales,
    },
    {
      title: "Transactions",
      dataIndex: "salesCount",
      key: "salesCount",
      align: "center" as const,
      render: (count: number) => (
        <Tag color={count > 0 ? "green" : "default"}>{count}</Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      align: "center" as const,
      render: (_: any, record: any) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetails(record)}
          disabled={record.salesCount === 0}
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
      rowKey="id"
      loading={loading}
      pagination={{ pageSize: 10, showSizeChanger: true }}
      scroll={{ x: "max-content" }}
    />
  );
};

export default UserSalesTable;
