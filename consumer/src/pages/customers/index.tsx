import { PlusOutlined, UploadOutlined } from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Col, Row, Space } from "antd";
import { useState } from "react";
import ExportButton from "../../components/ExportButton";
import ImportModal from "../../components/ImportModal";
import PageTitle from "../../components/PageTitle";
import { queryKeys } from "../../constants/queryKeys";
import { useImportEnabled } from "../../hooks/useImportEnabled";
import { setPageTitle } from "../../utils/setPageTitle";
import DrawerForm from "./_DrawerForm";
import TableGrid from "./_TableGrid";
import { Customer } from "../../types/customer.types";

const title = "Customers";

const Customers = () => {
  const queryClient = useQueryClient();
  const importEnabled = useImportEnabled();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editedItem, setEditedItem] = useState<Customer | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const showDrawer = () => {
    setOpen(true);
    setIsEditing(false);
    setEditedItem(null);
  };

  const onClose = () => {
    setOpen(false);
  };

  const onClickEdit = (record: Customer) => {
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
          <Space>
            <ExportButton entity="customers" />
            {importEnabled && (
              <Button
                icon={<UploadOutlined />}
                onClick={() => setImportOpen(true)}
              >
                Import Excel
              </Button>
            )}
            <Button type="primary" icon={<PlusOutlined />} onClick={showDrawer}>
              Add New Customer
            </Button>
          </Space>
        }
      />

      <Row gutter={16}>
        <Col className="gutter-row" span={24}>
          <TableGrid onClickEdit={onClickEdit} />
        </Col>
      </Row>

      <ImportModal
        entity="customers"
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() =>
          queryClient.invalidateQueries({ queryKey: [queryKeys.customers] })
        }
      />
    </>
  );
};

export default Customers;
