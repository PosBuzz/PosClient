import {
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Input,
  Row,
  Select,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { InventoryAdjustment, inventoryApi } from "../../api/inventory-api";
import CenterLoader from "../../components/CenterLoader";
import PageTitle from "../../components/PageTitle";
import { useModalStore } from "../../stores/modalStore";
import useDarkMode from "../../hooks/useDarkMode";
import { queryKeys } from "../../constants/queryKeys";
import { setPageTitle } from "../../utils/setPageTitle";

const { Text } = Typography;
const { Option } = Select;

export default function InventoryAdjustmentsPage() {
  const navigate = useNavigate();
  const { modal } = useModalStore();

  const isDarkMode = useDarkMode();

  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [variantFilter, setVariantFilter] = useState<number | undefined>();
  const [branchFilter, setBranchFilter] = useState<number | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Debounce search
  const debouncedSearch = useCallback(
    debounce((nextValue: string) => setDebouncedSearchText(nextValue), 500),
    []
  );

  useEffect(() => {
    debouncedSearch(searchText);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchText, debouncedSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchText, variantFilter, branchFilter]);

  // Queries
  const { data: adjustmentsData, isLoading: adjustmentsLoading } = useQuery({
    queryKey: [
      queryKeys.adjustments,
      currentPage,
      pageSize,
      variantFilter,
      branchFilter,
    ],
    queryFn: () =>
      inventoryApi.getAdjustments({
        page: currentPage,
        limit: pageSize,
        variant_id: variantFilter,
        branch_id: branchFilter,
      }),
    staleTime: 3600 * 1000,
  });

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: [queryKeys.branches],
    queryFn: () => inventoryApi.getBranches(),
    staleTime: 3600 * 1000,
  });

  const handleView = (adjustment: InventoryAdjustment) => {
    modal?.info({
      title: "Adjustment Details",
      width: 600,
      content: (
        <div style={{ marginTop: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Text strong>Adjustment ID:</Text>
              <br />
              <Text>{adjustment.id}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Product:</Text>
              <br />
              <Text>{adjustment.batch?.variant.product.name}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Variant:</Text>
              <br />
              <Text>{adjustment.batch?.variant.name}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Location:</Text>
              <br />
              <Text>{adjustment.branch?.name || "Warehouse"}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Quantity Change:</Text>
              <br />
              <Tag
                color={adjustment.quantity_change > 0 ? "green" : "red"}
                style={{ fontSize: "14px", padding: "4px 8px" }}
              >
                {adjustment.quantity_change > 0 ? "+" : ""}
                {adjustment.quantity_change} units
              </Tag>
            </Col>
            <Col span={12}>
              <Text strong>Reason:</Text>
              <br />
              <Text>{adjustment.reason}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Created By:</Text>
              <br />
              <Text>{adjustment.created_by_user.name}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Date:</Text>
              <br />
              <Text>
                {dayjs(adjustment.created_at).format("MMM DD, YYYY HH:mm")}
              </Text>
            </Col>
            {adjustment.notes && (
              <Col span={24}>
                <Text strong>Notes:</Text>
                <br />
                <Text>{adjustment.notes}</Text>
              </Col>
            )}
            {adjustment.batch && (
              <Col span={24}>
                <Text strong>Batch Information:</Text>
                <br />
                <div
                  className={`${isDarkMode ? "bg-black" : "bg-[#F5F5F5]"}`}
                  style={{
                    marginTop: 8,
                    padding: 8,
                    borderRadius: 4,
                  }}
                >
                  <Text>
                    Batch Number:{" "}
                    <Text code>{adjustment.batch.batch_number}</Text>
                  </Text>
                  <br />
                  <Text>
                    Cost Price:{" "}
                    <Text strong>
                      ${parseFloat(adjustment.batch.cost_price).toFixed(2)}
                    </Text>
                  </Text>
                </div>
              </Col>
            )}
          </Row>
        </div>
      ),
    });
  };

  const getAdjustmentTypeColor = (quantityChange: number) => {
    return quantityChange > 0 ? "green" : "red";
  };

  const getAdjustmentTypeText = (quantityChange: number) => {
    return quantityChange > 0 ? "Stock In" : "Stock Out";
  };

  const columns: ColumnsType<InventoryAdjustment> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 80,
      render: (id) => <Text code>#{id}</Text>,
    },
    {
      title: "Product",
      key: "product",
      render: (_, record) => (
        <div>
          <Link to={`/products/view/${record.batch?.variant.product.id}`}>
            <p style={{ fontWeight: 500 }}>
              {record.batch?.variant.product.name || "Unknown Product"}
            </p>
          </Link>
          <div style={{ fontSize: "12px", color: "#666" }}>
            {record.batch?.variant.name || "Unknown Variant"}
          </div>
        </div>
      ),
    },
    {
      title: "Location",
      key: "location",
      render: (_, record) => (
        <Tag color="blue">{record.branch?.name || "Warehouse"}</Tag>
      ),
    },
    {
      title: "Type",
      key: "type",
      align: "center",
      render: (_, record) => (
        <Tag color={getAdjustmentTypeColor(record.quantity_change)}>
          {getAdjustmentTypeText(record.quantity_change)}
        </Tag>
      ),
    },
    {
      title: "Quantity Change",
      dataIndex: "quantity_change",
      key: "quantity_change",
      align: "center",
      render: (change) => (
        <Text
          strong
          style={{
            color: change > 0 ? "#52c41a" : "#ff4d4f",
            fontSize: "14px",
          }}
        >
          {change > 0 ? "+" : ""}
          {change} units
        </Text>
      ),
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      render: (reason) => (
        <Tooltip title={reason}>
          <div
            style={{
              maxWidth: 150,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {reason}
          </div>
        </Tooltip>
      ),
    },
    {
      title: "Created By",
      key: "created_by",
      render: (_, record) => record.created_by_user.name,
    },
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      render: (date) => dayjs(date).format("MMM DD, YYYY"),
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 100,
      render: (_, record) => (
        <Tooltip title="View Details">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          />
        </Tooltip>
      ),
    },
  ];

  if (branchesLoading && currentPage === 1) {
    return <CenterLoader />;
  }

  return (
    <>
      {setPageTitle("Inventory Adjustments")}

      {/* Page Title */}
      <PageTitle
        title="Inventory Adjustments"
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Inventory", href: "/inventory" },
          { title: "Adjustments" },
        ]}
        rightSection={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/inventory/adjustments/add")}
          >
            Create Adjustment
          </Button>
        }
      />

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search adjustments..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="All Locations"
              style={{ width: "100%" }}
              value={branchFilter}
              onChange={setBranchFilter}
              allowClear
              loading={branchesLoading}
            >
              {branches.map((branch) => (
                <Option key={branch.id} value={branch.id}>
                  {branch.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setSearchText("");
                setDebouncedSearchText("");
                setVariantFilter(undefined);
                setBranchFilter(undefined);
                setCurrentPage(1);
              }}
              style={{ width: "100%" }}
            >
              Reset
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={adjustmentsData?.data || []}
          rowKey="id"
          loading={adjustmentsLoading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: adjustmentsData?.meta.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} adjustments`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size || 10);
            },
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </>
  );
}
