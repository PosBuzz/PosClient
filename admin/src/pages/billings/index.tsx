/* eslint-disable */
import { PlusOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Col, Input, Row, Select } from "antd";
import { useState } from "react";
import { post } from "../../api/crud-api";
import { API_CRUD_FIND_WHERE } from "../../api/endpoints";
import PageTitle from "../../components/Pagetitle";
import { models } from "../../constants/Models";
import { setPageTitle } from "../../utils/setPageTitle";
import DrawerForm from "./_DrawerForm";
import TableGrid from "./_TableGrid";

const model = models.BillingHistory;
const title = "Billing Histories";

const Banner = () => {
  const [open, setOpen] = useState(false);
  const [editedItem, setEditedItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [trigger, setTrigger] = useState(0);

  const [consumerFilter, setConsumerFilter] = useState<string[]>([]);
  const [referenceFilter, setReferenceFilter] = useState<string>("");

  const KEY = `all-${model}-${consumerFilter.join(",")}-${referenceFilter}`;

  const {
    isLoading,
    isError,
    data: fetchData,
    refetch,
  } = useQuery({
    queryKey: [KEY],
    queryFn: () =>
      post(`${API_CRUD_FIND_WHERE}?model=${model}`, {
        include: {
          consumer: true,
        },
        where: {
          ...(consumerFilter.length > 0 && {
            consumer_id: { in: consumerFilter },
          }),
          ...(referenceFilter && {
            reference: {
              contains: referenceFilter,
              mode: "insensitive",
            },
          }),
        },
      }),
  });

  const ConsumersKey = `all-${models.Consumer}`;

  const { data: consumers } = useQuery({
    queryKey: [ConsumersKey],
    queryFn: () =>
      post(`${API_CRUD_FIND_WHERE}?model=${models.Consumer}`, {
        include: {
          plan: true,
        },
      }),
  });

  const consumerOptions =
    consumers?.map((c: any) => ({
      label: c.name,
      value: c.id,
    })) || [];

  const showDrawer = () => {
    setOpen(true);
    setIsEditing(false);
    setEditedItem(null);
  };

  const onClose = () => setOpen(false);

  const onClickEdit = (record: any) => {
    setIsEditing(true);
    setEditedItem(record);
    setOpen(true);
  };

  const onSubmitSuccess = () => {
    setTrigger((trigger) => trigger + 1);
    setOpen(false);
    setIsEditing(false);
    setEditedItem(null);
  };

  return (
    <>
      {setPageTitle(title)}
      <DrawerForm
        onClose={onClose}
        open={open}
        model={model}
        isEditing={isEditing}
        editedItem={editedItem}
        onSubmitSuccess={onSubmitSuccess}
        fetchData={fetchData}
        consumers={consumers}
      />

      <PageTitle
        title={title}
        breadcrumbs={[
          {
            title: "Dashboard",
            href: "/",
          },
          {
            title: title,
          },
        ]}
        rightSection={
          <Button type="primary" icon={<PlusOutlined />} onClick={showDrawer}>
            Add Bill
          </Button>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={24} md={6}>
          <Select
            mode="multiple"
            placeholder="Select Consumer(s)"
            size="middle"
            allowClear
            showSearch
            style={{ width: "100%" }}
            optionFilterProp="label"
            filterSort={(a, b) =>
              (a?.label ?? "")
                .toLowerCase()
                .localeCompare((b?.label ?? "").toLowerCase())
            }
            options={consumerOptions}
            onChange={(value) => setConsumerFilter(value)}
          />
        </Col>
        <Col xs={24} sm={24} md={6}>
          <Input
            placeholder="Search by Reference"
            allowClear
            size="middle"
            value={referenceFilter}
            onChange={(e) => setReferenceFilter(e.target.value)}
          />
        </Col>
      </Row>

      <TableGrid
        trigger={trigger}
        model={model}
        onClickEdit={onClickEdit}
        fetchData={fetchData}
        isError={isError}
        isLoading={isLoading}
        refetch={refetch}
      />
    </>
  );
};

export default Banner;
