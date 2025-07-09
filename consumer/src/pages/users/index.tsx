/* eslint-disable */
import { PlusOutlined } from "@ant-design/icons";
import { Button, Col, Row } from "antd";
import { useState } from "react";
import PageTitle from "../../components/PageTitle";
import { setPageTitle } from "../../utils/setPageTitle";
import DrawerForm from "./_DrawerForm";
import TableGrid from "./_TableGrid";
import { useQuery } from "@tanstack/react-query";
import { get } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";

const title = "Users";

const Users = () => {
  const [open, setOpen] = useState(false);
  const [editedItem, setEditedItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const { data: fetchData } = useQuery({
    queryKey: [queryKeys.roles],
    queryFn: () => get(endpoints.role),
    staleTime: queryStaleTimeMap[queryKeys.roles],
  });

  const { data: branchData } = useQuery({
    queryKey: [queryKeys.branchOptions],
    queryFn: () => get(endpoints.getBranchOptions),
    staleTime: queryStaleTimeMap[queryKeys.branchOptions],
  });

  const roleOptions: any = fetchData?.map((role) => {
    return { label: role.name, value: role.id };
  });

  const branchOptions: any = branchData?.map((branch) => {
    return { 
      label: `${branch.name}${branch.is_main ? ' (Main)' : ''}${branch.is_warehouse ? ' (Warehouse)' : ''}`, 
      value: branch.id 
    };
  });

  const showDrawer = () => {
    setOpen(true);
    setIsEditing(false);
    setEditedItem(null);
  };

  const onClose = () => {
    setOpen(false);
  };

  const onClickEdit = (record: any) => {
    setIsEditing(true);
    setEditedItem(record);
    setOpen(true);
  };

  const onSubmitSuccess = (isEditing: boolean) => {
    if (isEditing) {
      setOpen(false);
      setIsEditing(false);
      setEditedItem(null);
    } else {
      setOpen(false);
      setIsEditing(false);
      setEditedItem(null);
    }
  };

  return (
    <>
      {setPageTitle(title)}
      <DrawerForm
        onClose={onClose}
        open={open}
        isEditing={isEditing}
        editedItem={editedItem}
        onSubmitSuccess={onSubmitSuccess}
        roleOptions={roleOptions}
        branchOptions={branchOptions}
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
            Add New
          </Button>
        }
      />

      <Row gutter={16}>
        <Col className="gutter-row" span={24}>
          <TableGrid onClickEdit={onClickEdit} roleOptions={roleOptions} branchOptions={branchOptions} />
        </Col>
      </Row>
    </>
  );
};

export default Users;
