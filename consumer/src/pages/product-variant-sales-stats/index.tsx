import { useQuery } from "@tanstack/react-query";
import { Card, Col, Row } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { salesApi } from "../../api/sales-api";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { setPageTitle } from "../../utils/setPageTitle";
import VariantSalesFilterCard from "./components/VariantSalesFilterCard";
import VariantSalesTable from "./components/VariantSalesTable";

const ProductVariantSalesStatsPage = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf("week"),
    dayjs(),
  ]);
  const [branchId, setBranchId] = useState<number | null | undefined>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20 });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [dateRange, branchId]);

  const { data: branchOptions = [] } = useQuery({
    queryKey: [queryKeys.branchOptions],
    queryFn: () => salesApi.getBranchOptions(),
    staleTime: queryStaleTimeMap[queryKeys.branchOptions],
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      queryKeys.variantSalesStats,
      dateRange,
      branchId,
      pagination.page,
      pagination.limit,
    ],
    queryFn: () =>
      salesApi.getVariantSalesStats({
        startDate: dateRange[0].format("YYYY-MM-DD"),
        endDate: dateRange[1].format("YYYY-MM-DD"),
        branch_id: branchId,
        page: pagination.page,
        limit: pagination.limit,
      }),
    staleTime: queryStaleTimeMap[queryKeys.variantSalesStats],
  });

  const variants = data?.data ?? [];
  const meta = data?.meta ?? {};

  return (
    <>
      {setPageTitle("Product Variant Sales Stats")}
      <PageTitle
        title="Product Variant Sales Statistics"
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Products", href: "/products" },
          { title: "Variant Sales Stats" },
        ]}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <VariantSalesFilterCard
            dateRange={dateRange}
            setDateRange={setDateRange}
            branchId={branchId}
            setBranchId={setBranchId}
            branchOptions={branchOptions}
          />
        </Col>

        <Col xs={24}>
          <Card>
            <VariantSalesTable
              data={variants}
              loading={isLoading}
              dateRange={dateRange}
              branchId={branchId}
              pagination={{
                current: pagination.page,
                pageSize: pagination.limit,
                total: meta.total ?? 0,
              }}
              onPaginationChange={(page, pageSize) =>
                setPagination({ page, limit: pageSize })
              }
            />
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default ProductVariantSalesStatsPage;
