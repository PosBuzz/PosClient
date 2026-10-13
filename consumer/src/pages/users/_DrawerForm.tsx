/* eslint-disable */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Drawer, Form, Input, Select } from "antd";
import { useEffect, useState } from "react";
import { patch, post } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { useMessageStore } from "../../stores/messageStore";
import { queryKeys } from "../../constants/queryKeys";
import { getErrorMessage } from "../../utils/api-error";

// @ts-ignore
export default function DrawerForm({
  onClose,
  open,
  onSubmitSuccess,
  isEditing,
  editedItem,
  roleOptions,
  branchOptions,
  // ...props
}) {
  const [form] = Form.useForm();
  const { messageApi } = useMessageStore();
  const queryClient = useQueryClient();
  const [selectAllBranches, setSelectAllBranches] = useState(false);

  // Use Form.useWatch to watch role_id changes
  const selectedRole = Form.useWatch("role_id", form);

  // Check if selected role is admin
  const isAdminRole =
    selectedRole &&
    roleOptions
      ?.find((role) => role.value === selectedRole)
      ?.label?.toLowerCase()
      .includes("admin");

  const createData = useMutation({
    mutationFn: async (data) => await post(endpoints.user, data),
    onSuccess: (_response) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.users] });
      messageApi?.success("Saved Successfully");
      form.resetFields();
      onSubmitSuccess();
    },
    onError: (error) => {
      messageApi?.error(getErrorMessage(error, "Something went wrong"));
    },
  });

  const updateData = useMutation({
    mutationFn: async (data: any) =>
      await patch(endpoints.updateUser(data.id), data),
    onSuccess: (_response) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.users] });
      messageApi?.success("Updated Successfully");
      form.resetFields();
      onSubmitSuccess(true);
    },
    onError: (error) => {
      messageApi?.error(getErrorMessage(error, "Something went wrong"));
    },
  });

  const onFinish = async (formValues: any) => {
    const payload: any = {
      name: formValues.name,
      role_id: formValues.role_id,
      email: formValues.email,
      password: formValues.password,
    };

    // Only include branch_ids for non-admin users
    if (!isAdminRole && formValues.branch_ids) {
      payload.branch_ids = formValues.branch_ids;
    }

    if (isEditing && editedItem) {
      return updateData.mutate({
        ...payload,
        id: editedItem.id,
      });
    }

    // @ts-ignore
    createData.mutate(payload);
  };

  const onFinishFailed = (errorInfo: any) => {
    console.log("Failed:", errorInfo);
  };

  useEffect(() => {
    if (!open) return;
    if (isEditing && editedItem) {
      const branchIds = editedItem.branches?.map((ub) => ub.branch.id) || [];
      form.setFieldsValue({
        name: editedItem.name,
        email: editedItem.email,
        role_id: editedItem.role_id,
        branch_ids: branchIds,
      });
      setSelectAllBranches(branchIds.length === branchOptions?.length);
    } else {
      form.resetFields();
      setSelectAllBranches(false);
    }
  }, [open, isEditing, editedItem, form, branchOptions]);

  return (
    <>
      <Drawer
        title={isEditing ? "Update User" : "Add User"}
        onClose={onClose}
        width={600}
        open={open}
        style={{ maxHeight: "100vh", overflowY: "auto" }} // Adjusting drawer max height
      >
        <Form
          form={form}
          name="basic"
          labelCol={{ span: 8 }} // Adjust column width for better alignment
          wrapperCol={{ span: 16 }}
          labelAlign="right" // Right-align the labels
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          autoComplete="off"
        >
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: "This field is required" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item label="Role" name="role_id">
            <Select
              size="middle"
              allowClear
              options={roleOptions}
              onChange={(_value) => {
                // Clear branch selection when role changes
                if (form.getFieldValue("branch_ids")?.length) {
                  form.setFieldsValue({ branch_ids: [] });
                }
                setSelectAllBranches(false);
              }}
            />
          </Form.Item>

          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, message: "This field is required" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[
              { required: !isEditing, message: "This field is required" },
            ]}
          >
            <Input.Password />
          </Form.Item>

          {!isAdminRole && (
            <>
              <Form.Item label=" " colon={false} className="!mb-0">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>Select branches this user can access:</span>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      if (selectAllBranches) {
                        // If all are selected, clear selection
                        form.setFieldValue("branch_ids", []);
                        setSelectAllBranches(false);
                      } else {
                        // If not all are selected, select all
                        const allBranchIds =
                          branchOptions?.map((branch) => branch.value) || [];
                        form.setFieldValue("branch_ids", allBranchIds);
                        setSelectAllBranches(true);
                      }
                    }}
                  >
                    {selectAllBranches ? "Deselect All" : "Select All"}
                  </Button>
                </div>
              </Form.Item>

              <Form.Item label="Branch Access" name="branch_ids">
                <Select
                  mode="multiple"
                  placeholder="Select branches"
                  options={branchOptions}
                  style={{ width: "100%" }}
                  onChange={(values) => {
                    setSelectAllBranches(
                      values.length === branchOptions?.length,
                    );
                  }}
                />
              </Form.Item>
            </>
          )}

          <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={updateData.isPending || createData.isPending}
            >
              Save
            </Button>
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
