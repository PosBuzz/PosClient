import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Typography,
  Divider,
} from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { returnsApi } from "../../api/returns-api";
import { salesApi } from "../../api/sales-api";
import PageTitle from "../../components/PageTitle";
import { queryKeys } from "../../constants/queryKeys";
import { useAuthStore } from "../../stores/authStore";

import type {
  CreateReturnForm,
  CreateReturnItemForm,
  CreateReturnPaymentForm,
} from "../../types/return.types";
import { PaymentMethod } from "../../types/sale.types";
import { setPageTitle } from "../../utils/setPageTitle";
import { useMessageStore } from "../../stores/messageStore";

const { Option } = Select;
const { Text, Title } = Typography;
const { TextArea } = Input;

const CreateReturn = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const { messageApi } = useMessageStore();
  const { user } = useAuthStore();

  const [saleData, setSaleData] = useState<any | null>(null);
  const [selectedItems, setSelectedItems] = useState<CreateReturnItemForm[]>(
    []
  );
  const [payments, setPayments] = useState<CreateReturnPaymentForm[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [exchangeSaleId, setExchangeSaleId] = useState<number | null>(null);
  const [exchangeSearchLoading, setExchangeSearchLoading] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);

  // Get user branches for return processing
  const userBranches = user?.branches || [];

  // Watch return type changes to reset exchange sale data
  const returnType = Form.useWatch("return_type", form);

  // No need for saleQuery since we store complete sale data from search
  // const saleQuery = useQuery(...)

  // Get exchange sale data when exchange sale ID is selected
  const exchangeSaleQuery = useQuery({
    queryKey: [queryKeys.sale, "exchange", exchangeSaleId],
    queryFn: async () => {
      console.log("Fetching exchange sale with ID:", exchangeSaleId);
      try {
        const result = await salesApi.getSale(exchangeSaleId!);
        console.log("Exchange sale data received:", result);
        return result;
      } catch (error: any) {
        console.error("Error fetching exchange sale:", error);

        // Show user-friendly error message
        if (error.response?.status === 404) {
          messageApi?.error(
            "Exchange sale not found. Please check the sale number."
          );
        } else if (
          error.code === "ECONNREFUSED" ||
          error.message?.includes("Network Error")
        ) {
          messageApi?.error(
            "Cannot connect to server. Please check if the backend is running."
          );
        } else {
          messageApi?.error(
            `Error fetching exchange sale: ${
              error.response?.data?.message || error.message || "Unknown error"
            }`
          );
        }
        throw error;
      }
    },
    enabled: !!exchangeSaleId,
    retry: false, // Don't retry automatically to avoid spam
  });

  const createReturnMutation = useMutation({
    mutationFn: (data: CreateReturnForm) => returnsApi.createReturn(data),
    onSuccess: (data) => {
      messageApi?.success("Return created successfully!");
      queryClient.invalidateQueries({ queryKey: [queryKeys.returns] });
      navigate(`/returns/view/${data.id}`);
    },
    onError: (error: any) => {
      messageApi?.error(error.response?.data?.message || "Failed to create return");
    },
  });

  useEffect(() => {
    setPageTitle("Create Return");
  }, []);

  // Set default branch
  useEffect(() => {
    if (userBranches.length > 0 && !selectedBranch) {
      const defaultBranch = userBranches[0];
      setSelectedBranch(defaultBranch.id);
      form.setFieldValue("branch_id", defaultBranch.id);
    }
  }, [userBranches, selectedBranch, form]);

  // Reset exchange sale data when return type changes
  useEffect(() => {
    if (returnType !== "exchange") {
      setExchangeSaleId(null);
      form.setFieldValue("exchange_sale_number", "");
    }
  }, [returnType, form]);

  const handleSaleSearch = async () => {
    const searchSaleNumber = form.getFieldValue("search_sale_number");

    if (!searchSaleNumber || !searchSaleNumber.trim()) {
      messageApi?.error("Please enter a sale number");
      return;
    }

    setSearchLoading(true);

    try {
      console.log("Searching for sale number:", searchSaleNumber);

      // Call the new API to search by sale number
      const foundSaleData = await salesApi.getSaleBySaleNumber(
        searchSaleNumber.trim()
      );

      console.log("Sale found:", foundSaleData);

      // Store the complete sale data (includes available_for_return)
      setSaleData(foundSaleData);
      setSelectedItems([]);
      setPayments([]);

      // Invalidate related queries for consistency
      queryClient.invalidateQueries({
        queryKey: [queryKeys.sale, foundSaleData.id],
      });

      messageApi?.success(`Sale ${foundSaleData.sale_number} loaded successfully!`);
    } catch (error: any) {
      console.error("Error searching for sale:", error);

      if (error.response?.status === 404) {
        messageApi?.error("Sale not found. Please check the sale number.");
      } else if (
        error.code === "ECONNREFUSED" ||
        error.message?.includes("Network Error")
      ) {
        messageApi?.error(
          "Cannot connect to server. Please check if the backend is running."
        );
      } else {
        messageApi?.error(
          `Error searching for sale: ${
            error.response?.data?.message || error.message || "Unknown error"
          }`
        );
      }

      // Reset the sale data if search failed
      setSaleData(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleExchangeSaleSearch = async () => {
    const searchExchangeSaleNumber = form.getFieldValue("exchange_sale_number");

    if (!searchExchangeSaleNumber || !searchExchangeSaleNumber.trim()) {
      messageApi?.error("Please enter an exchange sale number");
      return;
    }

    if (!selectedBranch) {
      messageApi?.error("Please select a processing branch first");
      return;
    }

    setExchangeSearchLoading(true);

    try {
      console.log(
        "Searching for exchange sale number:",
        searchExchangeSaleNumber
      );

      // Call the API to search by exchange sale number
      const exchangeSaleData = await salesApi.getSaleBySaleNumber(
        searchExchangeSaleNumber.trim()
      );

      console.log("Exchange sale found:", exchangeSaleData);

      // Validate that the exchange sale is from the same branch as processing branch
      if (exchangeSaleData.branch_id !== selectedBranch) {
        messageApi?.error(
          `Exchange sale is from a different branch. Please select an exchange sale from the same processing branch.`
        );
        return;
      }

      // Set the exchange sale ID to trigger the query
      setExchangeSaleId(exchangeSaleData.id!);

      messageApi?.success(
        `Exchange Sale ${exchangeSaleData.sale_number} loaded successfully!`
      );
    } catch (error: any) {
      console.error("Error searching for exchange sale:", error);

      if (error.response?.status === 404) {
        messageApi?.error("Exchange sale not found. Please check the sale number.");
      } else if (
        error.code === "ECONNREFUSED" ||
        error.message?.includes("Network Error")
      ) {
        messageApi?.error(
          "Cannot connect to server. Please check if the backend is running."
        );
      } else {
        messageApi?.error(
          `Error searching for exchange sale: ${
            error.response?.data?.message || error.message || "Unknown error"
          }`
        );
      }

      // Reset the exchange sale ID if search failed
      setExchangeSaleId(null);
    } finally {
      setExchangeSearchLoading(false);
    }
  };

  const handleItemSelect = (saleItem: any, quantity: number) => {
    const unitPrice = Number(saleItem.unit_price) || 0;

    const existingItemIndex = selectedItems.findIndex(
      (item) => item.sale_item_id === saleItem.id
    );

    if (existingItemIndex >= 0) {
      // Update existing item
      const updatedItems = [...selectedItems];
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity,
      };
      setSelectedItems(updatedItems);
    } else {
      // Add new item
      const newItem: CreateReturnItemForm = {
        sale_item_id: saleItem.id,
        variant_id: saleItem.variant_id || saleItem.variant?.id,
        batch_id: saleItem.batch_id,
        quantity,
        max_quantity: saleItem.available_for_return || saleItem.quantity,
        variant_name: saleItem.variant?.name || saleItem.variant_name,
        product_name: saleItem.variant?.product?.name || saleItem.product_name,
        unit_price: unitPrice,
        unit_name: saleItem.unit_name,
        image: saleItem.image,
      };
      setSelectedItems([...selectedItems, newItem]);
    }
  };

  const handleItemRemove = (saleItemId: number) => {
    setSelectedItems((items) =>
      items.filter((item) => item.sale_item_id !== saleItemId)
    );
  };

  const addPayment = (payment: CreateReturnPaymentForm) => {
    const processedPayment = {
      ...payment,
      amount: Number(payment.amount), // Ensure amount is a number
    };
    setPayments([...payments, processedPayment]);
    setPaymentModalVisible(false);
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  // Simplified - just track exchange sale ID for reference (commented out for now)
  // const handleExchangeSaleUpdate = (saleId: string) => {
  //   setExchangeSaleId(saleId);
  // };

  const handleSubmit = async (values: any) => {
    if (!saleData) {
      messageApi?.error("Please select a sale first");
      return;
    }

    if (selectedItems.length === 0) {
      messageApi?.error("Please select at least one item to return");
      return;
    }

    if (!selectedBranch) {
      messageApi?.error("Please select a branch for processing this return");
      return;
    }

    // Validation: Check if payments are required
    if (payments.length === 0) {
      messageApi?.error(
        "Please add at least one payment method to process the return"
      );
      return;
    }

    // Validation: Check that total payments don't exceed available amount
    const totalPaymentAmount = getTotalPayments();
    const availableAmount =
      saleData.return_summary?.available_amount ?? saleData.total_amount;

    if (totalPaymentAmount > availableAmount) {
      messageApi?.error(
        `Total payment amount ($${totalPaymentAmount.toFixed(
          2
        )}) exceeds available amount ($${availableAmount.toFixed(2)}). ` +
          `Please adjust your payment amounts.`
      );
      return;
    }

    // Validation: Check if exchange sale ID is required when return type is exchange
    if (values.return_type === "exchange") {
      if (!values.exchange_sale_number) {
        messageApi?.error(
          "Please enter an Exchange Sale Number when return type is Exchange"
        );
        return;
      }
      if (!exchangeSaleId || !exchangeSaleQuery.data) {
        messageApi?.error(
          "Please search and load the Exchange Sale data before submitting"
        );
        return;
      }
    }

    // Validation: Check if exchange sale ID is provided but return type is not exchange
    if (values.return_type !== "exchange" && exchangeSaleId) {
      messageApi?.warning(
        "Exchange Sale ID will be ignored since return type is not Exchange"
      );
    }

    const returnData: CreateReturnForm = {
      original_sale_id: saleData.id,
      branch_id: selectedBranch, // Use selected branch for return processing
      exchange_sale_id:
        values.return_type === "exchange" && exchangeSaleId
          ? exchangeSaleId
          : undefined,
      reason: values.return_reason || values.reason,
      notes: values.notes,
      items: selectedItems.map((item) => ({
        quantity: Number(item.quantity),
        sale_item_id: Number(item.sale_item_id),
        variant_id: Number(item.variant_id),
        batch_id: item.batch_id ? Number(item.batch_id) : undefined,
      })),
      payments:
        payments.length > 0
          ? payments.map((payment) => ({
              ...payment,
              amount: Number(payment.amount),
            }))
          : undefined,
      // exchanges: No complex exchange items, just reference the exchange sale ID
    };

    await createReturnMutation.mutateAsync(returnData);
  };

  // Removed getTotalRefund and getTotalExchange as they're not needed anymore

  const getTotalPayments = () => {
    return payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  };

  const saleItemColumns = [
    {
      title: "Product",
      key: "product",
      render: (record: any) => (
        <div>
          <div>
            {record.variant?.product?.name ||
              record.product_name ||
              "Unknown Product"}
          </div>
          <Text type="secondary">
            {record.variant?.name || record.variant_name || "Unknown Variant"}
          </Text>
        </div>
      ),
    },
    {
      title: "Sold Qty",
      dataIndex: "quantity",
      key: "quantity",
    },
    {
      title: "Available",
      key: "available",
      render: (record: any) => {
        const selectedItem = selectedItems.find(
          (item) => item.sale_item_id === record.id
        );
        console.log(record);

        // Use available_for_return from backend which accounts for previous returns
        const totalAvailable = record.available_for_return || 0;
        const available = totalAvailable - (selectedItem?.quantity || 0);
        return (
          <Text strong style={{ color: available > 0 ? "#52c41a" : "#ff4d4f" }}>
            {available}
          </Text>
        );
      },
    },
    {
      title: "Unit Price",
      key: "unit_price",
      render: (record: any) => {
        // Calculate actual unit price from line_total / quantity for accuracy
        const actualUnitPrice = record.line_total / record.quantity;
        return `$${Number(actualUnitPrice).toFixed(2)}`;
      },
    },
    {
      title: "Line Total",
      dataIndex: "line_total",
      key: "line_total",
      render: (total: number) => `$${Number(total).toFixed(2)}`,
    },
    {
      title: "Add to Return",
      key: "add_to_return",
      render: (record: any) => {
        const selectedItem = selectedItems.find(
          (item) => item.sale_item_id === record.id
        );
        const currentQty = selectedItem?.quantity || 0;
        const maxAvailable =
          record.available_for_return || record.quantity || 0; // Use available_for_return from backend

        return (
          <Space size="small">
            <Button
              size="small"
              type="text"
              disabled={currentQty <= 0}
              onClick={() => {
                const newQty = Math.max(0, currentQty - 1);
                handleItemSelect(record, newQty);
              }}
            >
              -
            </Button>
            <Text
              strong
              style={{
                minWidth: "20px",
                textAlign: "center",
                display: "inline-block",
              }}
            >
              {currentQty}
            </Text>
            <Button
              size="small"
              type="text"
              disabled={currentQty >= maxAvailable}
              onClick={() => {
                const newQty = Math.min(maxAvailable, currentQty + 1);
                handleItemSelect(record, newQty);
              }}
            >
              +
            </Button>
          </Space>
        );
      },
    },
  ];

  const selectedItemsColumns = [
    {
      title: "Product",
      key: "product",
      render: (record: CreateReturnItemForm) => (
        <div>
          <div>{record.product_name}</div>
          <Text type="secondary">{record.variant_name}</Text>
        </div>
      ),
    },
    {
      title: "Quantity",
      key: "quantity",
      render: (record: CreateReturnItemForm) => {
        const saleItem = saleData?.items?.find(
          (item) => item.id === record.sale_item_id
        );
        const maxAvailable = record.max_quantity || saleItem?.quantity || 1;

        return (
          <InputNumber
            min={1}
            max={maxAvailable}
            value={record.quantity}
            onChange={(value) => {
              const newQty = value || 1;

              // Find and update the item - no refund amount calculation here
              const updatedItems = selectedItems.map((item) =>
                item.sale_item_id === record.sale_item_id
                  ? { ...item, quantity: newQty }
                  : item
              );
              setSelectedItems(updatedItems);
            }}
            style={{ width: 80 }}
          />
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: CreateReturnItemForm) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleItemRemove(record.sale_item_id)}
        />
      ),
    },
  ];

  return (
    <div>
      <PageTitle
        title="Create Return"
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Returns", href: "/returns" },
          { title: "Create Return" },
        ]}
      />

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Row gutter={[24, 24]}>
          {/* Sale Selection */}
          <Col span={24}>
            <Card title="Sale Information" size="small">
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} sm={12} md={6}>
                  <Form.Item
                    name="branch_id"
                    label="Processing Branch"
                    rules={[
                      { required: true, message: "Please select branch" },
                    ]}
                    extra="The branch where this return will be processed (affects inventory)"
                  >
                    <Select
                      placeholder="Select branch"
                      value={selectedBranch}
                      onChange={(value) => setSelectedBranch(value)}
                    >
                      {userBranches.map((branch) => (
                        <Option key={branch.id} value={branch.id}>
                          {branch.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item
                    name="search_sale_number"
                    label="Sale Number"
                    rules={[
                      { required: true, message: "Please enter sale number" },
                    ]}
                  >
                    <Input
                      placeholder="SAL-20250926-0001"
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    onClick={handleSaleSearch}
                    loading={searchLoading}
                    style={{ marginTop: 8 }}
                  >
                    Search
                  </Button>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="return_type"
                    label="Return Type"
                    initialValue="return_only"
                  >
                    <Select style={{ width: "100%" }}>
                      <Option value="return_only">Return Only</Option>
                      <Option value="exchange">Exchange</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Form.Item
                  noStyle
                  shouldUpdate={(prevValues, currentValues) =>
                    prevValues.return_type !== currentValues.return_type
                  }
                >
                  {({ getFieldValue }) =>
                    getFieldValue("return_type") === "exchange" ? (
                      <>
                        <Col xs={24} sm={16} md={12}>
                          <Form.Item
                            name="exchange_sale_number"
                            label="Exchange Sale Number"
                            rules={[
                              {
                                required: true,
                                message:
                                  "Exchange Sale Number is required when return type is Exchange",
                              },
                            ]}
                            extra="Enter the sale number of the exchange transaction (Required for Exchange returns)"
                          >
                            <Input
                              placeholder="Enter exchange sale number (e.g., SAL-20241229-0001)"
                              onPressEnter={handleExchangeSaleSearch}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={8} md={4}>
                          <Button
                            type="primary"
                            icon={<SearchOutlined />}
                            onClick={handleExchangeSaleSearch}
                            loading={exchangeSearchLoading}
                            style={{ marginTop: 8 }}
                          >
                            Search Exchange
                          </Button>
                          {exchangeSaleQuery.data && (
                            <div
                              style={{
                                marginTop: "4px",
                                fontSize: "12px",
                                color: "#52c41a",
                              }}
                            >
                              ✓ Exchange Sale Loaded
                            </div>
                          )}
                        </Col>
                      </>
                    ) : null
                  }
                </Form.Item>
              </Row>

              {saleData && (
                <Alert
                  message={
                    <div>
                      <Row gutter={[16, 8]}>
                        <Col span={8}>
                          <Text strong>Sale: </Text>
                          <Text>{saleData.sale_number}</Text>
                        </Col>
                        <Col span={8}>
                          <Text strong>Customer: </Text>
                          <Text>
                            {saleData.customer_name || "Walk-in Customer"}
                          </Text>
                        </Col>
                        <Col span={8}>
                          <Text strong>Date: </Text>
                          <Text>
                            {new Date(saleData.sale_date).toLocaleDateString()}
                          </Text>
                        </Col>
                      </Row>

                      {/* Financial Summary for Manual Calculation */}
                      <div
                        style={{
                          marginTop: 12,
                          padding: 12,
                          // backgroundColor: '#f0f2f5',
                          borderRadius: 6,
                          border: "2px solid #d9d9d9",
                        }}
                      >
                        <Title
                          level={5}
                          style={{
                            margin: 0,
                            marginBottom: 8,
                            color: "#1890ff",
                          }}
                        >
                          💰 Financial Summary (For Manual Calculation)
                        </Title>
                        <Row gutter={[20, 8]}>
                          <Col span={4}>
                            <Text>Subtotal: </Text>
                            <Text strong>
                              ${Number(saleData.subtotal || 0).toFixed(2)}
                            </Text>
                          </Col>
                          <Col span={4}>
                            <Text>Discount: </Text>
                            <Text
                              strong
                              style={{ color: "#ff4d4f", fontSize: "16px" }}
                            >
                              -$
                              {Number(saleData.discount_amount || 0).toFixed(2)}
                            </Text>
                          </Col>
                          <Col span={4}>
                            <Text>Shipping: </Text>
                            <Text
                              strong
                              style={{ color: "#1890ff", fontSize: "16px" }}
                            >
                              +${Number(saleData.shipping_cost || 0).toFixed(2)}
                            </Text>
                          </Col>
                          <Col span={4}>
                            <Text>Final Total: </Text>
                            <Text
                              strong
                              style={{ color: "#52c41a", fontSize: "18px" }}
                            >
                              ${Number(saleData.total_amount).toFixed(2)}
                            </Text>
                          </Col>
                          <Col span={4}>
                            <Text>Available Amount: </Text>
                            <Text
                              strong
                              style={{
                                color: "#13c2c2",
                                fontSize: "18px",
                                backgroundColor: "#e6fffb",
                                padding: "2px 8px",
                                borderRadius: "4px",
                              }}
                            >
                              $
                              {Number(
                                saleData.return_summary?.available_amount ??
                                  saleData.total_amount
                              ).toFixed(2)}
                            </Text>
                          </Col>
                          <Col span={4}>
                            <Text>Total Paid: </Text>
                            <Text
                              strong
                              style={{ color: "#722ed1", fontSize: "16px" }}
                            >
                              {saleData.payments &&
                              saleData.payments.length > 0 ? (
                                <div>
                                  $
                                  {Number(
                                    saleData.payments.reduce(
                                      (sum: number, p: any) => sum + p.amount,
                                      0
                                    )
                                  ).toFixed(2)}
                                  <br />
                                  <Text
                                    type="secondary"
                                    style={{ fontSize: "12px" }}
                                  >
                                    {saleData.payments
                                      .map(
                                        (p: any) =>
                                          `${p.payment_method?.replace(
                                            "_",
                                            " "
                                          )}-$${Number(p.amount).toFixed(2)}`
                                      )
                                      .join(", ")}
                                  </Text>
                                </div>
                              ) : (
                                `$${Number(saleData.total_amount || 0).toFixed(
                                  2
                                )}`
                              )}
                            </Text>
                          </Col>
                        </Row>
                      </div>

                      {/* Return History Summary */}
                      {saleData.return_summary &&
                        saleData.return_summary.total_returned > 0 && (
                          <div
                            style={{
                              marginTop: 12,
                              padding: 12,
                              // backgroundColor: '#fff2e8',
                              borderRadius: 6,
                              border: "2px solid #ffec3d",
                            }}
                          >
                            <Title
                              level={5}
                              style={{
                                margin: 0,
                                marginBottom: 8,
                                color: "#fa8c16",
                              }}
                            >
                              ⚠️ Previous Returns for this Sale
                            </Title>
                            <Row gutter={[20, 8]}>
                              <Col span={6}>
                                <Text>Total Returns: </Text>
                                <Text
                                  strong
                                  style={{ color: "#fa8c16", fontSize: "16px" }}
                                >
                                  {saleData.return_summary.total_returned}
                                </Text>
                              </Col>
                              <Col span={6}>
                                <Text>Already Refunded: </Text>
                                <Text
                                  strong
                                  style={{ color: "#ff4d4f", fontSize: "16px" }}
                                >
                                  $
                                  {Number(
                                    saleData.return_summary.total_refunded || 0
                                  ).toFixed(2)}
                                </Text>
                              </Col>
                              <Col span={6}>
                                <Text>Already Exchanged: </Text>
                                <Text
                                  strong
                                  style={{ color: "#1890ff", fontSize: "16px" }}
                                >
                                  $
                                  {Number(
                                    saleData.return_summary.total_exchanged || 0
                                  ).toFixed(2)}
                                </Text>
                              </Col>
                              <Col span={6}>
                                <Text>Total Returned: </Text>
                                <Text
                                  strong
                                  style={{ color: "#722ed1", fontSize: "16px" }}
                                >
                                  $
                                  {Number(
                                    (saleData.return_summary.total_refunded ||
                                      0) +
                                      (saleData.return_summary
                                        .total_exchanged || 0)
                                  ).toFixed(2)}
                                </Text>
                              </Col>
                            </Row>

                            {/* List of individual returns */}
                            <div style={{ marginTop: 8 }}>
                              <Text
                                type="secondary"
                                style={{ fontSize: "12px" }}
                              >
                                Return History:{" "}
                                {saleData.return_summary.returns
                                  .map(
                                    (ret, index) =>
                                      `${ret.return_number} (${new Date(
                                        ret.return_date
                                      ).toLocaleDateString()}) - $${Number(
                                        ret.total_refund + ret.total_exchange
                                      ).toFixed(2)}`
                                  )
                                  .join(" | ")}
                              </Text>
                            </div>
                          </div>
                        )}
                    </div>
                  }
                  type="info"
                  style={{ marginTop: 16 }}
                />
              )}
            </Card>
          </Col>

          {/* Exchange Sale Summary */}
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.return_type !== currentValues.return_type
            }
          >
            {({ getFieldValue }) =>
              exchangeSaleQuery.data &&
              getFieldValue("return_type") === "exchange" ? (
                <Col span={24}>
                  <Card title="Exchange Sale Summary" size="small">
                    <Alert
                      message={
                        <div>
                          <Row gutter={[16, 8]}>
                            <Col span={8}>
                              <Text strong>Exchange Sale: </Text>
                              <Text>{exchangeSaleQuery.data.sale_number}</Text>
                            </Col>
                            <Col span={8}>
                              <Text strong>Customer: </Text>
                              <Text>
                                {exchangeSaleQuery.data.customer_name ||
                                  "Walk-in Customer"}
                              </Text>
                            </Col>
                            <Col span={8}>
                              <Text strong>Date: </Text>
                              <Text>
                                {new Date(
                                  exchangeSaleQuery.data.sale_date
                                ).toLocaleDateString()}
                              </Text>
                            </Col>
                          </Row>

                          {/* Exchange Financial Summary */}
                          <div
                            style={{
                              marginTop: 12,
                              padding: 12,
                              // backgroundColor: '#f6f8ff',
                              borderRadius: 6,
                              // border: '2px solid #1890ff'
                            }}
                          >
                            <Title
                              level={5}
                              style={{
                                margin: 0,
                                marginBottom: 8,
                                color: "#1890ff",
                              }}
                            >
                              🔄 Exchange Financial Summary
                            </Title>
                            <Row gutter={[20, 8]}>
                              <Col span={5}>
                                <Text>Subtotal: </Text>
                                <Text strong>
                                  $
                                  {Number(
                                    exchangeSaleQuery.data.subtotal || 0
                                  ).toFixed(2)}
                                </Text>
                              </Col>
                              <Col span={5}>
                                <Text>Discount: </Text>
                                <Text
                                  strong
                                  style={{ color: "#ff4d4f", fontSize: "16px" }}
                                >
                                  -$
                                  {Number(
                                    exchangeSaleQuery.data.discount_amount || 0
                                  ).toFixed(2)}
                                </Text>
                              </Col>
                              <Col span={5}>
                                <Text>Shipping: </Text>
                                <Text
                                  strong
                                  style={{ color: "#1890ff", fontSize: "16px" }}
                                >
                                  +$
                                  {Number(
                                    exchangeSaleQuery.data.shipping_cost || 0
                                  ).toFixed(2)}
                                </Text>
                              </Col>
                              <Col span={4}>
                                <Text>Final Total: </Text>
                                <Text
                                  strong
                                  style={{ color: "#52c41a", fontSize: "18px" }}
                                >
                                  $
                                  {Number(
                                    exchangeSaleQuery.data.total_amount
                                  ).toFixed(2)}
                                </Text>
                              </Col>
                              <Col span={5}>
                                <Text>Total Paid: </Text>
                                <Text
                                  strong
                                  style={{ color: "#f59e0b", fontSize: "16px" }}
                                >
                                  {exchangeSaleQuery.data.payments &&
                                  exchangeSaleQuery.data.payments.length > 0 ? (
                                    <div>
                                      $
                                      {Number(
                                        exchangeSaleQuery.data.payments.reduce(
                                          (sum: number, p: any) =>
                                            sum + +p.amount,
                                          0
                                        )
                                      ).toFixed(2)}
                                      <br />
                                      <Text
                                        type="secondary"
                                        style={{ fontSize: "12px" }}
                                      >
                                        {exchangeSaleQuery.data.payments
                                          .map(
                                            (p: any) =>
                                              `${p.payment_method?.replace(
                                                "_",
                                                " "
                                              )}-$${Number(p.amount).toFixed(
                                                2
                                              )}`
                                          )
                                          .join(", ")}
                                      </Text>
                                    </div>
                                  ) : (
                                    `$${Number(
                                      exchangeSaleQuery.data.total_amount || 0
                                    ).toFixed(2)}`
                                  )}
                                </Text>
                              </Col>
                            </Row>
                          </div>
                        </div>
                      }
                      type="success"
                      style={{ marginTop: 16 }}
                    />
                  </Card>
                </Col>
              ) : null
            }
          </Form.Item>

          {/* Sale Items */}
          {saleData && (
            <Col span={24}>
              <Card title="Sale Items" size="small">
                <Table
                  columns={saleItemColumns}
                  dataSource={saleData.items || []}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              </Card>
            </Col>
          )}

          {/* Selected Items for Return */}
          {selectedItems.length > 0 && (
            <Col span={24}>
              <Card title="Items to Return" size="small">
                <Table
                  columns={selectedItemsColumns}
                  dataSource={selectedItems}
                  rowKey="sale_item_id"
                  pagination={false}
                  size="small"
                />
                {/* Refund summary removed - amounts handled in payments section */}
              </Card>
            </Col>
          )}

          {/* Return Details */}
          <Col xs={24} md={12}>
            <Card title="Return Details" size="small">
              <Form.Item name="reason" label="Reason for Return">
                <Select placeholder="Select reason">
                  <Option value="Defective">Defective</Option>
                  <Option value="Wrong Item">Wrong Item</Option>
                  <Option value="Customer Request">Customer Request</Option>
                  <Option value="Quality Issue">Quality Issue</Option>
                  <Option value="Other">Other</Option>
                </Select>
              </Form.Item>

              <Form.Item name="notes" label="Notes">
                <TextArea rows={3} placeholder="Additional notes..." />
              </Form.Item>
            </Card>
          </Col>

          {/* Payments & Exchanges */}
          <Col xs={24} md={12}>
            <Card
              title={
                <span>
                  Payments & Exchanges
                  <span style={{ color: "#ff4d4f", marginLeft: "4px" }}>*</span>
                  {payments.length === 0 && (
                    <Text
                      type="danger"
                      style={{ fontSize: "12px", marginLeft: "8px" }}
                    >
                      (At least one payment is required)
                    </Text>
                  )}
                </span>
              }
              size="small"
            >
              <Space direction="vertical" style={{ width: "100%" }}>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => setPaymentModalVisible(true)}
                  block
                >
                  Add Payment
                </Button>

                {/* Exchange sale ID moved to top section */}

                {payments.length > 0 && (
                  <div>
                    <Title level={5}>Payments</Title>
                    {payments.map((payment, index) => (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <div>
                          <Text strong>
                            {payment.payment_method}: $
                            {payment.amount.toFixed(2)}
                          </Text>
                          {payment.reference && (
                            <div style={{ fontSize: "12px", color: "#666" }}>
                              Ref: {payment.reference}
                            </div>
                          )}
                          {payment.notes && (
                            <div style={{ fontSize: "12px", color: "#666" }}>
                              Notes: {payment.notes}
                            </div>
                          )}
                        </div>
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => removePayment(index)}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Exchange section removed - simplified to just track exchange sale ID */}

                <Divider />
                <div>
                  <Text>Total Payments: ${getTotalPayments().toFixed(2)}</Text>
                </div>
              </Space>
            </Card>
          </Col>

          {/* Actions */}
          <Col span={24}>
            <Card size="small">
              {/* Validation Summary */}
              <div style={{ marginBottom: "16px" }}>
                <Title level={5} style={{ margin: "0 0 8px 0" }}>
                  Required Items Checklist:
                </Title>
                <Space direction="vertical" size="small">
                  <Text type={saleData ? "success" : "danger"}>
                    {saleData ? (
                      <CheckCircleOutlined style={{ color: "#52c41a" }} />
                    ) : (
                      <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
                    )}{" "}
                    Sale selected and loaded
                  </Text>
                  <Text type={selectedItems.length > 0 ? "success" : "danger"}>
                    {selectedItems.length > 0 ? (
                      <CheckCircleOutlined style={{ color: "#52c41a" }} />
                    ) : (
                      <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
                    )}{" "}
                    At least one item selected for return
                  </Text>
                  <Text type={selectedBranch ? "success" : "danger"}>
                    {selectedBranch ? (
                      <CheckCircleOutlined style={{ color: "#52c41a" }} />
                    ) : (
                      <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
                    )}{" "}
                    Processing branch selected
                  </Text>
                  <Text type={payments.length > 0 ? "success" : "danger"}>
                    {payments.length > 0 ? (
                      <CheckCircleOutlined style={{ color: "#52c41a" }} />
                    ) : (
                      <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
                    )}{" "}
                    At least one payment method added
                  </Text>
                  <Text
                    type={(() => {
                      if (!saleData || payments.length === 0) return "danger";
                      const totalPaymentAmount = getTotalPayments();
                      const availableAmount =
                        saleData?.return_summary?.available_amount ??
                        saleData?.total_amount ??
                        0;
                      return totalPaymentAmount <= availableAmount
                        ? "success"
                        : "danger";
                    })()}
                  >
                    {(() => {
                      if (!saleData || payments.length === 0) {
                        return (
                          <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
                        );
                      }
                      const totalPaymentAmount = getTotalPayments();
                      const availableAmount =
                        saleData?.return_summary?.available_amount ??
                        saleData?.total_amount ??
                        0;
                      if (totalPaymentAmount <= availableAmount) {
                        return (
                          <CheckCircleOutlined style={{ color: "#52c41a" }} />
                        );
                      } else {
                        return (
                          <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
                        );
                      }
                    })()}{" "}
                    {(() => {
                      if (!saleData || payments.length === 0) {
                        return "Payment amount validation (sale and payments required)";
                      }
                      const totalPaymentAmount = getTotalPayments();
                      const availableAmount =
                        saleData?.return_summary?.available_amount ??
                        saleData?.total_amount ??
                        0;
                      if (totalPaymentAmount <= availableAmount) {
                        return `Payment amount ($${totalPaymentAmount.toFixed(
                          2
                        )}) within available limit`;
                      } else {
                        return `Payment amount ($${totalPaymentAmount.toFixed(
                          2
                        )}) exceeds available ($${availableAmount.toFixed(2)})`;
                      }
                    })()}
                  </Text>
                  {returnType === "exchange" && (
                    <Text
                      type={
                        exchangeSaleId && exchangeSaleQuery.data
                          ? "success"
                          : "danger"
                      }
                    >
                      {exchangeSaleId && exchangeSaleQuery.data ? (
                        <CheckCircleOutlined style={{ color: "#52c41a" }} />
                      ) : (
                        <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
                      )}{" "}
                      Exchange sale loaded (required for Exchange returns)
                    </Text>
                  )}
                </Space>
              </div>

              <Space>
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate("/returns")}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={createReturnMutation.isPending}
                  disabled={
                    selectedItems.length === 0 ||
                    !saleData ||
                    !selectedBranch ||
                    payments.length === 0 ||
                    (returnType === "exchange" &&
                      (!exchangeSaleId || !exchangeSaleQuery.data)) ||
                    (() => {
                      const totalPaymentAmount = getTotalPayments();
                      const availableAmount =
                        saleData?.return_summary?.available_amount ??
                        saleData?.total_amount ??
                        0;
                      return totalPaymentAmount > availableAmount;
                    })()
                  }
                >
                  Create Return
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Form>

      {/* Payment Modal */}
      <Modal
        title="Add Payment"
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        footer={null}
      >
        <PaymentForm
          onSubmit={addPayment}
          onCancel={() => setPaymentModalVisible(false)}
        />
      </Modal>

      {/* Exchange modal removed - simplified approach */}
    </div>
  );
};

// Payment Form Component
const PaymentForm = ({
  onSubmit,
  onCancel,
}: {
  onSubmit: (payment: CreateReturnPaymentForm) => void;
  onCancel: () => void;
}) => {
  const [form] = Form.useForm();

  const handleSubmit = async (values: any) => {
    await form.validateFields();
    onSubmit(values);
    form.resetFields();
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Form.Item
        name="payment_method"
        label="Payment Method"
        rules={[{ required: true, message: "Please select payment method" }]}
      >
        <Select>
          {Object.values(PaymentMethod).map((method) => (
            <Option key={method} value={method}>
              {method}
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="amount"
        label="Amount"
        rules={[{ required: true, message: "Please enter amount" }]}
      >
        <InputNumber
          style={{ width: "100%" }}
          min={0}
          step={0.01}
          addonBefore="$"
        />
      </Form.Item>

      <Form.Item name="reference" label="Reference">
        <Input placeholder="Transaction reference..." />
      </Form.Item>

      <Form.Item name="notes" label="Notes">
        <TextArea rows={2} placeholder="Payment notes..." />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" htmlType="submit">
            Add Payment
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

// Simplified - no complex exchange form needed

export default CreateReturn;
