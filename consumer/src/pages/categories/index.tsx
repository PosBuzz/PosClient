import { PlusOutlined } from "@ant-design/icons";
import { Button, Col, Row } from "antd";
import { useState } from "react";
import PageTitle from "../../components/PageTitle";
import { setPageTitle } from "../../utils/setPageTitle";
import DrawerForm from "./_DrawerForm";
import TableGrid from "./_TableGrid";

const title = "Categories";

const Categories = () => {
  const [open, setOpen] = useState(false);
  const [editedItem, setEditedItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

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

  const onSubmitSuccess = () => {
    setOpen(false);
    setIsEditing(false);
    setEditedItem(null);
  };

  return (
    <>
      {setPageTitle(title)}
      {open && (
        <DrawerForm
          onClose={onClose}
          open={open}
          isEditing={isEditing}
          editedItem={editedItem}
          onSubmitSuccess={onSubmitSuccess}
        />
      )}

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
            Add New Category
          </Button>
        }
      />

      <Row gutter={16}>
        <Col className="gutter-row" span={24}>
          <TableGrid onClickEdit={onClickEdit} />
        </Col>
      </Row>
    </>
  );
};

export default Categories;
