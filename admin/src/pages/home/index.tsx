import { UserOutlined, UserSwitchOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Card, Col, Row, Statistic } from "antd";
import dayjs from "dayjs";
import { post } from "../../api/crud-api";
import { API_CRUD_FIND_WHERE } from "../../api/endpoints";
import PageTitle from "../../components/PageTitle";
import { models } from "../../constants/Models";

function Index() {
  const KEY = `all-${models.Consumer}`;
  const currentMonth = dayjs().format("YYYY-MM");

  const { isLoading, data: fetchData } = useQuery({
    queryKey: [KEY],
    queryFn: () =>
      post(`${API_CRUD_FIND_WHERE}?model=${models.Consumer}`, {
        where: {},
        include: {
          plan: true,
          billing_logs: true,
        },
      }),
  });

  const totalUsers = fetchData?.length || 0;

  // Map of plan name => active user count
  const activeUsersByPlan: Record<string, number> = {};
  let totalActiveUsers = 0;

  if (fetchData) {
    fetchData.forEach((consumer: any) => {
      const hasActiveBill = consumer.billing_logs.some(
        (log: any) => log.billing_month === currentMonth
      );
      if (hasActiveBill) {
        const planName = consumer.plan?.name || "Unknown";
        activeUsersByPlan[planName] = (activeUsersByPlan[planName] || 0) + 1;
        totalActiveUsers++;
      }
    });
  }

  return (
    <>
      <PageTitle
        title={"Dashboard"}
        breadcrumbs={[]}
      />

      <>
        <Row gutter={[16, 16]}>
          {/* Total Users Card */}
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card bordered={false}>
              <Statistic
                title="Total Users"
                value={totalUsers || 0}
                valueStyle={{ color: "#3f8600" }}
                prefix={<UserOutlined />}
                loading={isLoading}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={8} lg={6}>
            <Card bordered={false}>
              <Statistic
                title="Active Users"
                value={totalActiveUsers || 0}
                valueStyle={{ color: "#1890ff" }}
                loading={isLoading}
                prefix={<UserSwitchOutlined />}
              />
            </Card>
          </Col>

          {/* Active Users By Plan */}
          {Object.entries(activeUsersByPlan).map(([plan, count]) => (
            <Col xs={24} sm={12} md={8} lg={6} key={plan}>
              <Card bordered={false}>
                <Statistic
                  title={plan}
                  value={count || 0}
                  prefix={<UserSwitchOutlined />}
                  loading={isLoading}
                  valueStyle={{ color: "#1890ff" }}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </>
    </>
  );
}

export default Index;
