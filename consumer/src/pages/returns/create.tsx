import { Money, takaPrefix } from "../../components/Currency";
import { formatCurrency } from "../../utils/formatters";
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
import {
  getPaymentProviderOptions,
  getPaymentProviderPlaceholder,
  paymentMethodRequiresProvider,
} from "../../utils/payment-provider.utils"; // <-- ADDED

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
    [],
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
  const shippingRefundAmountWatch =
    Number(Form.useWatch("shipping_refund_amount", form)) || 0;

  // Get exchange sale data when exchange sale ID is selected
  const exchangeSaleQuery = useQuery({
    queryKey: [queryKeys.sale, "exchange", exchangeSaleId],
    queryFn: async () => {
      try {
        const result = await salesApi.getSale(exchangeSaleId!);
        return result;
      } catch (error: any) {
        if (error.response?.status === 404) {
          messageApi?.error(
            "Exchange sale not found. Please check the sale number.",
          );
        } else {
          messageApi?.error(
            `Error fetching exchange sale: ${
              error.response?.data?.message || error.message || "Unknown error"
            }`,
          );
        }
        throw error;
      }
    },
    enabled: !!exchangeSaleId,
    retry: false,
  });

  const createReturnMutation = useMutation({
    mutationFn: (data: CreateReturnForm) => returnsApi.createReturn(data),
    onSuccess: (data) => {
      messageApi?.success("Return created successfully!");
      queryClient.invalidateQueries({ queryKey: [queryKeys.returns] });
      navigate(`/returns/view/${data.id}`);
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to create return",
      );
    },
  });

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
      const foundSaleData = await salesApi.getSaleBySaleNumber(
        searchSaleNumber.trim(),
      );

      setSaleData(foundSaleData);
      setSelectedItems([]);
      setPayments([]);
      form.setFieldValue("shipping_refund_amount", 0);

      queryClient.invalidateQueries({
        queryKey: [queryKeys.sale, foundSaleData.id],
      });

      messageApi?.success(
        `Sale ${foundSaleData.sale_number} loaded successfully!`,
      );
    } catch (error: any) {
      if (error.response?.status === 404) {
        messageApi?.error("Sale not found. Please check the sale number.");
      } else {
        messageApi?.error(
          `Error searching for sale: ${
            error.response?.data?.message || error.message || "Unknown error"
          }`,
        );
      }

      setSaleData(null);
      form.setFieldValue("shipping_refund_amount", 0);
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
      const exchangeSaleData = await salesApi.getSaleBySaleNumber(
        searchExchangeSaleNumber.trim(),
      );

      if (exchangeSaleData.branch_id !== selectedBranch) {
        messageApi?.error(
          `Exchange sale is from a different branch. Please select an exchange sale from the same processing branch.`,
        );
        return;
      }

      setExchangeSaleId(exchangeSaleData.id!);

      messageApi?.success(
        `Exchange Sale ${exchangeSaleData.sale_number} loaded successfully!`,
      );
    } catch (error: any) {
      if (error.response?.status === 404) {
        messageApi?.error(
          "Exchange sale not found. Please check the sale number.",
        );
      } else {
        messageApi?.error(
          `Error searching for exchange sale: ${
            error.response?.data?.message || error.message || "Unknown error"
          }`,
        );
      }

      setExchangeSaleId(null);
    } finally {
      setExchangeSearchLoading(false);
    }
  };

  const handleItemSelect = (saleItem: any, quantity: number) => {
    const unitPrice = Number(saleItem.unit_price) || 0;

    const existingItemIndex = selectedItems.findIndex(
      (item) => item.sale_item_id === saleItem.id,
    );

    if (existingItemIndex >= 0) {
      const updatedItems = [...selectedItems];
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity,
      };
      setSelectedItems(updatedItems);
    } else {
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
      items.filter((item) => item.sale_item_id !== saleItemId),
    );
  };

  const addPayment = (payment: CreateReturnPaymentForm) => {
    const processedPayment = {
      ...payment,
      amount: Number(payment.amount),
    };
    setPayments([...payments, processedPayment]);
    setPaymentModalVisible(false);
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handleSubmit = async (values: any) => {
    if (!saleData) {
      messageApi?.error("Please select a sale first");
      return;
    }

    const shippingRefundAmount = Number(values.shipping_refund_amount) || 0;

    if (selectedItems.length === 0 && shippingRefundAmount <= 0) {
      messageApi?.error(
        "Please select at least one item or add a shipping refund amount",
      );
      return;
    }

    if (!selectedBranch) {
      messageApi?.error("Please select a branch for processing this return");
      return;
    }

    if (payments.length === 0) {
      messageApi?.error(
        "Please add at least one payment method to process the return",
      );
      return;
    }

    const totalPaymentAmount = getTotalPayments();
    const availableAmount =
      saleData.return_summary?.available_amount ?? saleData.total_amount;
    const shippingCost = Number(saleData.shipping_cost || 0);
    const availableShippingRefund = Number(
      saleData.return_summary?.available_shipping_refund ?? shippingCost,
    );
    const selectedReturnValue =
      Number(selectedReturnTotals.net || 0) + shippingRefundAmount;

    if (selectedReturnValue <= 0) {
      messageApi?.error("Selected return amount must be greater than zero");
      return;
    }

    if (shippingRefundAmount < 0) {
      messageApi?.error("Shipping refund amount cannot be negative");
      return;
    }

    if (shippingRefundAmount > availableShippingRefund + 0.01) {
      messageApi?.error(
        `Shipping refund amount (${formatCurrency(
          shippingRefundAmount,
        )}) cannot exceed remaining refundable shipping (${formatCurrency(
          availableShippingRefund,
        )}).`,
      );
      return;
    }

    if (selectedReturnValue > availableAmount + 0.01) {
      messageApi?.error(
        `Selected return value (${formatCurrency(
          selectedReturnValue,
        )}) exceeds available amount (${formatCurrency(
          availableAmount,
        )}). Reduce return quantities.`,
      );
      return;
    }

    if (
      payments.some(
        (payment) =>
          !Number.isFinite(Number(payment.amount)) ||
          Number(payment.amount) <= 0,
      )
    ) {
      messageApi?.error("All payment amounts must be greater than 0");
      return;
    }

    if (totalPaymentAmount > selectedReturnValue + 0.01) {
      messageApi?.error(
        `Total payment amount (${formatCurrency(
          totalPaymentAmount,
        )}) exceeds selected return value (${formatCurrency(
          selectedReturnValue,
        )}). ` + `Please adjust your payment amounts.`,
      );
      return;
    }

    if (Math.abs(totalPaymentAmount - selectedReturnValue) > 0.01) {
      messageApi?.error(
        `Total payment amount must exactly match selected return value. Expected ${formatCurrency(
          selectedReturnValue,
        )}, got ${formatCurrency(totalPaymentAmount)}.`,
      );
      return;
    }

    if (values.return_type === "exchange") {
      if (!values.exchange_sale_number) {
        messageApi?.error(
          "Please enter an Exchange Sale Number when return type is Exchange",
        );
        return;
      }
      if (!exchangeSaleId || !exchangeSaleQuery.data) {
        messageApi?.error(
          "Please search and load the Exchange Sale data before submitting",
        );
        return;
      }
    }

    if (values.return_type !== "exchange" && exchangeSaleId) {
      messageApi?.warning(
        "Exchange Sale ID will be ignored since return type is not Exchange",
      );
    }

    const returnData: CreateReturnForm = {
      original_sale_id: saleData.id,
      branch_id: selectedBranch,
      exchange_sale_id:
        values.return_type === "exchange" && exchangeSaleId
          ? exchangeSaleId
          : undefined,
      reason: values.return_reason || values.reason,
      notes: values.notes,
      shipping_refund_amount: shippingRefundAmount,
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
    };

    await createReturnMutation.mutateAsync(returnData);
  };

  const getTotalPayments = () => {
    return payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  };

  const getReturnItemBreakdown = (saleItem: any, selectedQty: number) => {
    const originalQty = Number(saleItem?.quantity) || 0;
    const ratio = originalQty > 0 ? selectedQty / originalQty : 0;

    const lineTotal = (Number(saleItem?.line_total) || 0) * ratio;
    const taxAmount = (Number(saleItem?.tax_amount) || 0) * ratio;
    const avgDiscount =
      (Number(saleItem?.average_discount_amount) || 0) * ratio;
    const specialDiscount =
      (Number(saleItem?.special_discount_amount) || 0) * ratio;
    const promoDiscount =
      (Number(saleItem?.promotion_discount_amount) || 0) * ratio;
    const totalDiscount = avgDiscount + specialDiscount + promoDiscount;
    const netReturn = lineTotal;

    return {
      line_total: Number(lineTotal) || 0,
      tax_amount: Number(taxAmount) || 0,
      avg_discount: Number(avgDiscount) || 0,
      special_discount: Number(specialDiscount) || 0,
      promo_discount: Number(promoDiscount) || 0,
      total_discount: Number(totalDiscount) || 0,
      net_return: Number(netReturn) || 0,
    };
  };

  const getSelectedReturnTotals = () => {
    const totals = {
      gross: 0,
      tax: 0,
      average_discount: 0,
      special_discount: 0,
      promotion_discount: 0,
      total_discount: 0,
      net: 0,
    };

    for (const selectedItem of selectedItems) {
      const saleItem = saleData?.items?.find(
        (item: any) => item.id === selectedItem.sale_item_id,
      );
      if (!saleItem) continue;

      const breakdown = getReturnItemBreakdown(
        saleItem,
        Number(selectedItem.quantity) || 0,
      );

      totals.gross += breakdown.line_total;
      totals.tax += breakdown.tax_amount;
      totals.average_discount += breakdown.avg_discount;
      totals.special_discount += breakdown.special_discount;
      totals.promotion_discount += breakdown.promo_discount;
      totals.total_discount += breakdown.total_discount;
      totals.net += breakdown.net_return;
    }

    return totals;
  };

  const selectedReturnTotals = getSelectedReturnTotals();
  const shippingRefundAmount = Math.max(0, shippingRefundAmountWatch);
  const selectedReturnValue =
    Number(selectedReturnTotals.net || 0) + shippingRefundAmount;
  const totalTendered = Number(
    saleData?.received_amount ??
      saleData?.payments?.reduce(
        (sum: number, p: any) => sum + Number(p?.amount || 0),
        0,
      ) ??
      0,
  );
  const changeGiven = Number(saleData?.change_amount || 0);
  const netPaid = Math.max(0, totalTendered - changeGiven);
  const saleVat = Number(saleData?.tax_amount || 0);
  const exchangeTotalTendered = Number(
    exchangeSaleQuery.data?.received_amount ??
      exchangeSaleQuery.data?.payments?.reduce(
        (sum: number, p: any) => sum + Number(p?.amount || 0),
        0,
      ) ??
      0,
  );
  const exchangeChangeGiven = Number(
    exchangeSaleQuery.data?.change_amount || 0,
  );
  const exchangeNetPaid = Math.max(
    0,
    exchangeTotalTendered - exchangeChangeGiven,
  );
  const exchangeVat = Number(exchangeSaleQuery.data?.tax_amount || 0);

  // Calculate remaining amount to prefill payment
  const remainingRefundAmount = Math.max(
    0,
    selectedReturnValue - getTotalPayments(),
  );

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
          (item) => item.sale_item_id === record.id,
        );

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
      dataIndex: "unit_price",
      key: "unit_price",
      render: (unit_price: any) => <Money value={unit_price} />,
    },
    {
      title: "Tax",
      key: "tax_amount",
      render: (record: any) => {
        const taxMethod =
          (record.tax_method || record.variant?.tax_method || "EXCLUSIVE")
            .toString()
            .toUpperCase() === "INCLUSIVE"
            ? "Inc"
            : "Exc";
        return (
          <Money value={record.tax_amount || 0} suffix={` (${taxMethod})`} />
        );
      },
    },
    {
      title: "Discount",
      key: "discounts",
      render: (record: any) => {
        const avg = Number(record.average_discount_amount || 0);
        const special = Number(record.special_discount_amount || 0);
        const promo = Number(record.promotion_discount_amount || 0);
        const total = avg + special + promo;
        return (
          <div>
            <div>
              <Money value={total} negative />
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              A:{avg.toFixed(2)} S:{special.toFixed(2)} P:{promo.toFixed(2)}
            </Text>
          </div>
        );
      },
    },
    {
      title: "Line Total",
      dataIndex: "line_total",
      key: "line_total",
      render: (total: number) => <Money value={total || 0} />,
    },
    {
      title: "Add to Return",
      key: "add_to_return",
      render: (record: any) => {
        const selectedItem = selectedItems.find(
          (item) => item.sale_item_id === record.id,
        );
        const currentQty = selectedItem?.quantity || 0;
        const maxAvailable =
          record.available_for_return ?? record.quantity ?? 0;

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
          (item) => item.id === record.sale_item_id,
        );
        const maxAvailable = record.max_quantity || saleItem?.quantity || 1;

        return (
          <InputNumber
            min={1}
            max={maxAvailable}
            value={record.quantity}
            onChange={(value) => {
              const newQty = value || 1;

              const updatedItems = selectedItems.map((item) =>
                item.sale_item_id === record.sale_item_id
                  ? { ...item, quantity: newQty }
                  : item,
              );
              setSelectedItems(updatedItems);
            }}
            style={{ width: 80 }}
          />
        );
      },
    },
    {
      title: "Tax",
      key: "tax",
      render: (record: CreateReturnItemForm) => {
        const saleItem = saleData?.items?.find(
          (item: any) => item.id === record.sale_item_id,
        );
        if (!saleItem) return <Money value={0} />;
        const breakdown = getReturnItemBreakdown(
          saleItem,
          Number(record.quantity) || 0,
        );
        return <Money value={breakdown.tax_amount} />;
      },
    },
    {
      title: "Discount",
      key: "discount",
      render: (record: CreateReturnItemForm) => {
        const saleItem = saleData?.items?.find(
          (item: any) => item.id === record.sale_item_id,
        );
        if (!saleItem) return <Money value={0} negative />;
        const breakdown = getReturnItemBreakdown(
          saleItem,
          Number(record.quantity) || 0,
        );
        return (
          <div>
            <div>
              <Money value={breakdown.total_discount} negative />
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              A:{breakdown.avg_discount.toFixed(2)} S:
              {breakdown.special_discount.toFixed(2)} P:
              {breakdown.promo_discount.toFixed(2)}
            </Text>
          </div>
        );
      },
    },
    {
      title: "Net Return",
      key: "net_return",
      render: (record: CreateReturnItemForm) => {
        const saleItem = saleData?.items?.find(
          (item: any) => item.id === record.sale_item_id,
        );
        if (!saleItem) return <Money value={0} />;
        const breakdown = getReturnItemBreakdown(
          saleItem,
          Number(record.quantity) || 0,
        );
        return <Money value={breakdown.net_return} />;
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
      {setPageTitle("Create Return")}
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
                              <Money value={Number(saleData.subtotal || 0)} />
                            </Text>
                          </Col>
                          <Col span={4}>
                            <Text>Discount: </Text>
                            <Text
                              strong
                              style={{ color: "#ff4d4f", fontSize: "16px" }}
                            >
                              <Money
                                value={Number(saleData.discount_amount || 0)}
                                negative
                              />
                            </Text>
                          </Col>
                          <Col span={4}>
                            <Text>VAT: </Text>
                            <Text
                              strong
                              style={{ color: "#fa8c16", fontSize: "16px" }}
                            >
                              +<Money value={saleVat} />
                            </Text>
                          </Col>
                          <Col span={4}>
                            <Text>Shipping: </Text>
                            <Text
                              strong
                              style={{ color: "#1890ff", fontSize: "16px" }}
                            >
                              +<Money value={Number(saleData.shipping_cost || 0)} />
                            </Text>
                          </Col>
                          <Col span={4}>
                            <Text>Final Total: </Text>
                            <Text
                              strong
                              style={{ color: "#52c41a", fontSize: "18px" }}
                            >
                              <Money value={Number(saleData.total_amount || 0)} />
                            </Text>
                          </Col>
                          <Col span={4}>
                            <Text>Available Amount: </Text>
                            <Text
                              strong
                              style={{
                                color: "#000",
                                fontSize: "18px",
                                backgroundColor: "#e6fffb",
                                padding: "2px 8px",
                                borderRadius: "4px",
                              }}
                            >
                              <Money value={Number(
                                saleData.return_summary?.available_amount ??
                                  saleData.total_amount,
                              )} />
                            </Text>
                          </Col>
                        </Row>

                        <Row gutter={[20, 8]} style={{ marginTop: 8 }}>
                          <Col span={8}>
                            <Text>Received (Tendered): </Text>
                            <Text
                              strong
                              style={{ color: "#722ed1", fontSize: "16px" }}
                            >
                              <Money value={totalTendered} />
                            </Text>
                            {saleData.payments &&
                            saleData.payments.length > 0 ? (
                              <div>
                                <Text
                                  type="secondary"
                                  style={{ fontSize: "12px" }}
                                >
                                  {saleData.payments
                                    .map(
                                      (p: any) =>
                                        `${p.payment_method?.replace(
                                          "_",
                                          " ",
                                        )}: ${formatCurrency(Number(p.amount))}`,
                                    )
                                    .join(", ")}
                                </Text>
                              </div>
                            ) : null}
                          </Col>
                          <Col span={8}>
                            <Text>Change Given: </Text>
                            <Text
                              strong
                              style={{ color: "#cf1322", fontSize: "16px" }}
                            >
                              <Money value={changeGiven} negative />
                            </Text>
                          </Col>
                          <Col span={8}>
                            <Text>Net Paid (Used in Sale): </Text>
                            <Text
                              strong
                              style={{ color: "#52c41a", fontSize: "16px" }}
                            >
                              <Money value={netPaid} />
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
                                  <Money value={Number(
                                    saleData.return_summary.total_refunded || 0,
                                  )} />
                                </Text>
                              </Col>
                              <Col span={6}>
                                <Text>Already Exchanged: </Text>
                                <Text
                                  strong
                                  style={{ color: "#1890ff", fontSize: "16px" }}
                                >
                                  <Money value={Number(
                                    saleData.return_summary.total_exchanged ||
                                      0,
                                  )} />
                                </Text>
                              </Col>
                              <Col span={6}>
                                <Text>Total Returned: </Text>
                                <Text
                                  strong
                                  style={{ color: "#722ed1", fontSize: "16px" }}
                                >
                                  <Money value={Number(
                                    (saleData.return_summary.total_refunded ||
                                      0) +
                                      (saleData.return_summary
                                        .total_exchanged || 0),
                                  )} />
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
                                    (ret) =>
                                      `${ret.return_number} (${new Date(
                                        ret.return_date,
                                      ).toLocaleDateString()}) - ${formatCurrency(Number(
                                        ret.total_refund + ret.total_exchange,
                                      ))}`,
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
                                  exchangeSaleQuery.data.sale_date,
                                ).toLocaleDateString()}
                              </Text>
                            </Col>
                          </Row>

                          {/* Exchange Financial Summary */}
                          <div
                            style={{
                              marginTop: 12,
                              padding: 12,
                              borderRadius: 6,
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
                              <Col span={4}>
                                <Text>Subtotal: </Text>
                                <Text strong>
                                  <Money value={Number(
                                    exchangeSaleQuery.data.subtotal || 0,
                                  )} />
                                </Text>
                              </Col>
                              <Col span={4}>
                                <Text>Discount: </Text>
                                <Text
                                  strong
                                  style={{ color: "#ff4d4f", fontSize: "16px" }}
                                >
                                  -<Money value={Number(
                                    exchangeSaleQuery.data.discount_amount || 0,
                                  )} />
                                </Text>
                              </Col>
                              <Col span={4}>
                                <Text>VAT: </Text>
                                <Text
                                  strong
                                  style={{ color: "#fa8c16", fontSize: "16px" }}
                                >
                                  +<Money value={exchangeVat} />
                                </Text>
                              </Col>
                              <Col span={4}>
                                <Text>Shipping: </Text>
                                <Text
                                  strong
                                  style={{ color: "#1890ff", fontSize: "16px" }}
                                >
                                  +<Money value={Number(
                                    exchangeSaleQuery.data.shipping_cost || 0,
                                  )} />
                                </Text>
                              </Col>
                              <Col span={4}>
                                <Text>Final Total: </Text>
                                <Text
                                  strong
                                  style={{ color: "#52c41a", fontSize: "18px" }}
                                >
                                  <Money value={Number(
                                    exchangeSaleQuery.data.total_amount,
                                  )} />
                                </Text>
                              </Col>
                              <Col span={4}>
                                <Text>Received: </Text>
                                <Text
                                  strong
                                  style={{ color: "#f59e0b", fontSize: "16px" }}
                                >
                                  <Money value={exchangeTotalTendered} />
                                </Text>
                              </Col>
                            </Row>
                            <Row gutter={[20, 8]} style={{ marginTop: 8 }}>
                              <Col span={8}>
                                <Text>Payment Methods: </Text>
                                <Text
                                  type="secondary"
                                  style={{ fontSize: "12px" }}
                                >
                                  {exchangeSaleQuery.data.payments &&
                                  exchangeSaleQuery.data.payments.length > 0
                                    ? exchangeSaleQuery.data.payments
                                        .map(
                                          (p: any) =>
                                            `${p.payment_method?.replace(
                                              "_",
                                              " ",
                                            )}: ${formatCurrency(
                                              Number(p.amount),
                                            )}`,
                                        )
                                        .join(", ")
                                    : "N/A"}
                                </Text>
                              </Col>
                              <Col span={8}>
                                <Text>Change Given: </Text>
                                <Text
                                  strong
                                  style={{ color: "#cf1322", fontSize: "16px" }}
                                >
                                  <Money value={exchangeChangeGiven} negative />
                                </Text>
                              </Col>
                              <Col span={8}>
                                <Text>Net Paid (Used in Sale): </Text>
                                <Text
                                  strong
                                  style={{ color: "#52c41a", fontSize: "16px" }}
                                >
                                  <Money value={exchangeNetPaid} />
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
          {(selectedItems.length > 0 || shippingRefundAmount > 0) && (
            <Col span={24}>
              <Card title="Items to Return" size="small">
                {selectedItems.length > 0 ? (
                  <Table
                    columns={selectedItemsColumns}
                    dataSource={selectedItems}
                    rowKey="sale_item_id"
                    pagination={false}
                    size="small"
                  />
                ) : (
                  <Text type="secondary">
                    No item selected. This return will refund shipping only.
                  </Text>
                )}
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 6,
                    border: "1px solid #d9d9d9",
                  }}
                >
                  <Title level={5} style={{ margin: "0 0 8px 0" }}>
                    Return Calculation Summary
                  </Title>
                  <Row gutter={[16, 8]}>
                    <Col span={4}>
                      <Text>Gross:</Text>
                      <div>
                        <Text strong>
                          <Money value={selectedReturnTotals.gross} />
                        </Text>
                      </div>
                    </Col>
                    <Col span={4}>
                      <Text>Tax:</Text>
                      <div>
                        <Text strong>
                          <Money value={selectedReturnTotals.tax} />
                        </Text>
                      </div>
                    </Col>
                    <Col span={4}>
                      <Text>Avg Disc:</Text>
                      <div>
                        <Text strong>
                          <Money
                            value={selectedReturnTotals.average_discount}
                            negative
                          />
                        </Text>
                      </div>
                    </Col>
                    <Col span={4}>
                      <Text>Special Disc:</Text>
                      <div>
                        <Text strong>
                          <Money
                            value={selectedReturnTotals.special_discount}
                            negative
                          />
                        </Text>
                      </div>
                    </Col>
                    <Col span={4}>
                      <Text>Promo Disc:</Text>
                      <div>
                        <Text strong>
                          <Money
                            value={selectedReturnTotals.promotion_discount}
                            negative
                          />
                        </Text>
                      </div>
                    </Col>
                    <Col span={4}>
                      <Text>Net Return:</Text>
                      <div>
                        <Text strong style={{ color: "#52c41a", fontSize: 16 }}>
                          <Money value={selectedReturnTotals.net} />
                        </Text>
                      </div>
                    </Col>
                    <Col span={4}>
                      <Text>Shipping Refund:</Text>
                      <div>
                        <Text strong>
                          <Money value={shippingRefundAmount} />
                        </Text>
                      </div>
                    </Col>
                    <Col span={4}>
                      <Text>Total Return Value:</Text>
                      <div>
                        <Text strong style={{ color: "#0958d9", fontSize: 16 }}>
                          <Money value={selectedReturnValue} />
                        </Text>
                      </div>
                    </Col>
                  </Row>
                </div>
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

              <Form.Item
                name="shipping_refund_amount"
                label="Shipping Refund Amount (Optional)"
                extra={`Maximum refundable shipping: ${formatCurrency(Number(
                  saleData?.return_summary?.available_shipping_refund ??
                    saleData?.shipping_cost ??
                    0,
                ))}`}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: "100%" }}
                  placeholder="0.00"
                />
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
                            {payment.payment_method.replace("_", " ")}
                            {payment?.payment_type
                              ? ` (${payment?.payment_type})`
                              : ""}
                            : <Money value={payment.amount} />
                          </Text>
                          {payment.reference && (
                            <div style={{ fontSize: "12px", color: "#666" }}>
                              Ref: {payment.reference}
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

                <Divider />
                <div>
                  <Text>
                    Total Payments: <Money value={getTotalPayments()} />
                  </Text>
                  {saleData && (
                    <div style={{ marginTop: 8 }}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Item return value:{" "}
                          <Money value={selectedReturnTotals.net} />
                        </Text>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Shipping refund value:{" "}
                          <Money value={shippingRefundAmount} />
                        </Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Selected return value:{" "}
                        <Money value={selectedReturnValue} />
                      </Text>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Available sale balance:{" "}
                          <Money
                            value={
                              saleData.return_summary?.available_amount ??
                              saleData.total_amount
                            }
                          />
                        </Text>
                      </div>
                      {Math.abs(getTotalPayments() - selectedReturnValue) >
                        0.01 && (
                        <div>
                          <Text type="danger" style={{ fontSize: 12 }}>
                            Payment total must exactly match selected return
                            value.
                          </Text>
                        </div>
                      )}
                    </div>
                  )}
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
                  <Text
                    type={
                      selectedItems.length > 0 || shippingRefundAmount > 0
                        ? "success"
                        : "danger"
                    }
                  >
                    {selectedItems.length > 0 || shippingRefundAmount > 0 ? (
                      <CheckCircleOutlined style={{ color: "#52c41a" }} />
                    ) : (
                      <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
                    )}{" "}
                    At least one item selected or shipping refund entered
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
                      if (selectedReturnValue <= 0) return "danger";
                      if (selectedReturnValue > availableAmount + 0.01)
                        return "danger";
                      return Math.abs(
                        totalPaymentAmount - selectedReturnValue,
                      ) <= 0.01
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
                      if (
                        Math.abs(totalPaymentAmount - selectedReturnValue) <=
                        0.01
                      ) {
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
                      if (
                        Math.abs(totalPaymentAmount - selectedReturnValue) <=
                        0.01
                      ) {
                        return `Payment amount matches selected return value (${formatCurrency(
                          selectedReturnValue,
                        )})`;
                      } else {
                        return `Payment amount must match selected return value. Entered ${formatCurrency(
                          totalPaymentAmount,
                        )}, expected ${formatCurrency(selectedReturnValue)}`;
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
                    (selectedItems.length === 0 && shippingRefundAmount <= 0) ||
                    !saleData ||
                    !selectedBranch ||
                    payments.length === 0 ||
                    selectedReturnValue <= 0 ||
                    (returnType === "exchange" &&
                      (!exchangeSaleId || !exchangeSaleQuery.data)) ||
                    (() => {
                      const totalPaymentAmount = getTotalPayments();
                      const availableAmount =
                        saleData?.return_summary?.available_amount ??
                        saleData?.total_amount ??
                        0;
                      if (selectedReturnValue > availableAmount + 0.01)
                        return true;
                      return (
                        Math.abs(totalPaymentAmount - selectedReturnValue) >
                        0.01
                      );
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

      {/* Payment Modal - Added destroyOnClose and defaultAmount prop */}
      <Modal
        title="Add Payment"
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <PaymentForm
          onSubmit={addPayment}
          onCancel={() => setPaymentModalVisible(false)}
          defaultAmount={remainingRefundAmount}
        />
      </Modal>
    </div>
  );
};

// Payment Form Component - Updated with Bank Name and Default Amount
const PaymentForm = ({
  onSubmit,
  onCancel,
  defaultAmount,
}: {
  onSubmit: (payment: CreateReturnPaymentForm) => void;
  onCancel: () => void;
  defaultAmount: number;
}) => {
  const [form] = Form.useForm();
  const selectedMethod = Form.useWatch("payment_method", form);
  const requiresProvider = paymentMethodRequiresProvider(selectedMethod);

  const handleSubmit = async (values: any) => {
    await form.validateFields();
    
    // Clean up: If method doesn't require provider, remove payment_type
    if (!requiresProvider) {
      values.payment_type = undefined;
    }

    onSubmit(values);
    form.resetFields();
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        amount: defaultAmount > 0 ? Number(defaultAmount.toFixed(2)) : undefined,
      }}
    >
      <Form.Item
        name="payment_method"
        label="Payment Method"
        rules={[{ required: true, message: "Please select payment method" }]}
      >
        <Select
          onChange={() => {
            form.setFieldsValue({ payment_type: undefined });
          }}
        >
          {Object.values(PaymentMethod).map((method) => (
            <Option key={method} value={method}>
              {method.replace("_", " ")}
            </Option>
          ))}
        </Select>
      </Form.Item>

      {/* Conditionally show Bank / Provider selection */}
      {requiresProvider && (
        <Form.Item
          name="payment_type"
          label={getPaymentProviderPlaceholder(selectedMethod)}
          rules={[{ required: true, message: "Please select a provider" }]}
        >
          <Select
            showSearch
            allowClear
            placeholder={getPaymentProviderPlaceholder(selectedMethod)}
            options={getPaymentProviderOptions(selectedMethod)}
            optionFilterProp="label"
          />
        </Form.Item>
      )}

      <Form.Item
        name="amount"
        label="Amount"
        rules={[
          { required: true, message: "Please enter amount" },
          {
            validator: async (_, value) => {
              if (value === undefined || value === null) return;
              if (Number(value) <= 0) {
                throw new Error("Amount must be greater than 0");
              }
            },
          },
        ]}
      >
        <InputNumber
          style={{ width: "100%" }}
          min={0}
          step={0.01}
          addonBefore={takaPrefix}
        />
      </Form.Item>

      <Form.Item name="reference" label="Reference">
        <Input placeholder="Transaction reference..." />
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

export default CreateReturn;