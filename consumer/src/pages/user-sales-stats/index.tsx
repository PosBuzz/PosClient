import { ArrowLeftOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Col, Row } from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { Link } from "react-router-dom";
import { salesApi } from "../../api/sales-api";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { setPageTitle } from "../../utils/setPageTitle";
import FilterCard from "./components/FilteredCard";
import UserSalesTable from "./components/UserSalesTable";

const UserSalesStatsPage = () => {
  // State for date range: Default is 1st of current month to Today
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs(),
    dayjs(),
  ]);
  // State for Branch Filter (null/undefined means All Branches)
  const [branchId, setBranchId] = useState<number | null | undefined>(null);

  // 1. Fetch Branch Options for the Dropdown
  const { data: branchOptions = [] } = useQuery({
    queryKey: [queryKeys.branchOptions],
    queryFn: () => salesApi.getBranchOptions(),
    staleTime: queryStaleTimeMap[queryKeys.branchOptions],
  });

  // Fetch aggregated stats from backend
  const { data, isLoading } = useQuery({
    queryKey: [queryKeys.userSalesStats, dateRange, branchId],
    queryFn: () =>
      salesApi.getUserSalesStats({
        startDate: dateRange[0].format("YYYY-MM-DD"),
        endDate: dateRange[1].format("YYYY-MM-DD"),
        branch_id: branchId,
      }),
    staleTime: queryStaleTimeMap[queryKeys.userSalesStats],
  });

  const users = data ?? [];

  return (
    <>
      {setPageTitle("User Sales Stats")}
      <PageTitle
        title="User Sales Statistics"
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Sales", href: "/sales" },
          { title: "User Stats" },
        ]}
        rightSection={
          <Link to="/sales">
            <Button icon={<ArrowLeftOutlined />}>Back to Sales</Button>
          </Link>
        }
      />

      <Row gutter={[16, 16]}>
        {/* Filter Section */}
        <Col xs={24}>
          <FilterCard
            dateRange={dateRange}
            setDateRange={setDateRange}
            branchId={branchId}
            setBranchId={setBranchId}
            branchOptions={branchOptions}
          />
        </Col>

        {/* Main Table */}
        <Col xs={24}>
          <Card>
            <UserSalesTable
              data={users}
              loading={isLoading}
              dateRange={dateRange}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default UserSalesStatsPage;
