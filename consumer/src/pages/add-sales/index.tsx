import {
  CalculatorOutlined,
  DeleteOutlined,
  PlusOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  message,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, post } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { salesApi } from "../../api/sales-api";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useAuthStore } from "../../stores/authStore";
import { Customer } from "../../types/customer.types";
import {
  DiscountType,
  PaymentMethod,
  PaymentStatus,
  PriceType,
  ProductVariantForSale,
  SaleFormData,
  SaleItem,
  SalePayment,
} from "../../types/sale.types";
import { setPageTitle } from "../../utils/setPageTitle";
import CustomerModal from "./CustomerModal";

const { Option } = Select;
const { Text } = Typography;

const NewSale = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Watch form values for real-time calculations
  const discountAmount = Form.useWatch("discount_amount", form) || 0;
  const shippingCost = Form.useWatch("shipping_cost", form) || 0;

  // State
  const [selectedItems, setSelectedItems] = useState<SaleItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredVariants, setFilteredVariants] = useState<
    ProductVariantForSale[]
  >([]);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [priceType, setPriceType] = useState<PriceType>(PriceType.REGULAR);
  const [discountType, setDiscountType] = useState<DiscountType>(
    DiscountType.FLAT
  );
  const [loading, setLoading] = useState(false);
  const [salePayments, setSalePayments] = useState<SalePayment[]>([
    {
      payment_method: PaymentMethod.CASH,
      amount: 0,
      reference: "",
      notes: "",
    },
  ]);

  // Barcode scanning state - POS SYSTEM BEHAVIOR:
  // - Barcode scanner works regardless of what input is focused
  // - Enter key outside inputs completes the sale
  // - Fast sequential keystrokes are treated as barcode input
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [lastKeyTime, setLastKeyTime] = useState(0);

  // Reset barcode buffer when component unmounts or branch changes
  useEffect(() => {
    setBarcodeBuffer("");
    setLastKeyTime(0);
  }, [selectedBranch]);

  // Get user's branches from auth store
  const userBranches = user?.branches || [];

  // Load customers using React Query
  const customersQuery = useQuery({
    queryKey: [queryKeys.customers],
    queryFn: async () => {
      const data = await get(endpoints.getCustomers);
      return data.data || data;
    },
    staleTime: queryStaleTimeMap[queryKeys.customers],
  });

  // Load products for sale when branch is selected
  const productsForSaleQuery = useQuery({
    queryKey: [queryKeys.productsForSale, selectedBranch],
    queryFn: () =>
      salesApi.getProductsForSale(selectedBranch!),
    enabled: !!selectedBranch,
    staleTime: queryStaleTimeMap[queryKeys.productsForSale],
  });

  // Set default branch from user's branches
  useEffect(() => {
    if (userBranches.length > 0 && !selectedBranch) {
      // Just select the first branch from user's assigned branches
      const defaultBranch = userBranches[0];
      setSelectedBranch(defaultBranch.id);
      form.setFieldsValue({
        branch_id: defaultBranch.id,
        price_type: PriceType.REGULAR,
        discount_type: DiscountType.FLAT,
        discount_amount: 0,
        shipping_cost: 0,
      });
    }
  }, [userBranches, selectedBranch, form]);

  useEffect(() => {
    if (customersQuery.data) {
      setCustomers(customersQuery.data);
    }
  }, [customersQuery.data]);

  useEffect(() => {
    if (productsForSaleQuery.data) {
      setFilteredVariants(productsForSaleQuery.data);
    }
  }, [productsForSaleQuery.data]);

  // Set initial page title
  useEffect(() => {
    setPageTitle("New Sale");
  }, []);

  const handleBranchChange = (branchId: number) => {
    setSelectedBranch(branchId);
    setSelectedItems([]); // Clear items when branch changes
    form.setFieldsValue({ branch_id: branchId });
  };

  const calculateTaxAndTotal = (
    price: number,
    quantity: number,
    taxPercentage: number,
    taxMethod: string
  ) => {
    const baseAmount = quantity * price;
    let taxAmount: number;
    let lineTotal: number;

    // Ensure taxPercentage is a valid number
    const validTaxPercentage = Number(taxPercentage) || 0;

    if (taxMethod === "INCLUSIVE") {
      // Tax is included in the price - the price already includes tax
      lineTotal = baseAmount; // Price includes tax
      taxAmount = (baseAmount * validTaxPercentage) / (100 + validTaxPercentage);
    } else {
      // Tax is exclusive - added on top of price
      taxAmount = (baseAmount * validTaxPercentage) / 100;
      lineTotal = baseAmount + taxAmount; // Add tax to get total
    }

    // Return precise values without rounding
    return {
      line_total: Number(lineTotal) || 0,
      tax_amount: Number(taxAmount) || 0,
      taxable_amount: Number(baseAmount) || 0,
    };
  };

  const addToSale = (variant: ProductVariantForSale) => {
    // Check if this variant already exists in the sale
    const existingItem = selectedItems.find(
      (item) => item.variant_id === variant.id
    );

    const price =
      priceType === PriceType.WHOLESALE
        ? Number(variant.wholesale_price) || Number(variant.regular_price)
        : Number(variant.regular_price);

    if (existingItem) {
      const newQuantity = existingItem.quantity + 1;
      const { line_total, tax_amount } = calculateTaxAndTotal(
        price,
        newQuantity,
        Number(variant.tax_percentage) || 0,
        variant.tax_method || "EXCLUSIVE"
      );

      setSelectedItems((items) =>
        items.map((item) =>
          item.variant_id === variant.id
            ? {
                ...item,
                quantity: newQuantity,
                unit_price: Number(price) || 0,
                tax_amount: Number(tax_amount) || 0,
                line_total: Number(line_total) || 0,
              }
            : item
        )
      );
    } else {
      const { line_total, tax_amount } = calculateTaxAndTotal(
        price,
        1,
        Number(variant.tax_percentage) || 0,
        variant.tax_method || "EXCLUSIVE"
      );

      const newItem: SaleItem = {
        variant_id: variant.id,
        variant_name: variant.name,
        variant_sku: variant.sku,
        quantity: 1,
        unit_price: Number(price) || 0,
        discount_amount: 0,
        tax_amount: Number(tax_amount) || 0,
        line_total: Number(line_total) || 0,
        product_name: variant.product_name,
        regular_price: Number(variant.regular_price) || 0,
        wholesale_price: Number(variant.wholesale_price) || undefined,
        image: variant.image,
        unit_name: variant.unit_name,
        tax_percentage: Number(variant.tax_percentage) || 0,
      };
      setSelectedItems([...selectedItems, newItem]);
    }
  };

  // Handle barcode scanning
  const handleBarcodeScann = async (barcode: string) => {
    if (!selectedBranch || !barcode.trim()) {
      return;
    }

    try {
      const product = await salesApi.getProductByBarcode(selectedBranch, barcode.trim());
      if (product) {
        addToSale(product);
        message.success(`Added ${product.product_name} - ${product.name} to sale`);
      } else {
        message.error(`Product not found for barcode: ${barcode}`);
      }
    } catch (error: any) {
      console.error("Error scanning barcode:", error);
      message.error("Failed to scan barcode");
    }
  };

  // Global barcode scanner listener - POS style: works everywhere
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      const activeElement = document.activeElement as HTMLElement;

      // If more than 100ms have passed since last key, reset buffer (new scan)
      if (timeDiff > 100) {
        setBarcodeBuffer("");
      }

      setLastKeyTime(currentTime);

      // Check if user is actively typing in an input field - MORE COMPREHENSIVE CHECK
      const isTypingInInput = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.role === 'textbox' ||
        activeElement.classList.contains('ant-select-selection-search-input') ||
        activeElement.classList.contains('ant-input') ||
        activeElement.classList.contains('ant-input-number-input') ||
        activeElement.closest('.ant-select-dropdown') ||
        activeElement.closest('.ant-input') ||
        activeElement.closest('.ant-input-number') ||
        activeElement.getAttribute('contenteditable') === 'true'
      );

      // DEBUG: Log what's happening
      console.log('Key pressed:', event.key, 'isTypingInInput:', isTypingInInput, 'activeElement:', activeElement?.tagName, activeElement?.className);

      // If user is typing in input, do NOTHING with barcode logic
      if (isTypingInInput) {
        console.log('User is typing in input - ignoring for barcode');
        return; // Exit early, don't interfere with input
      }

      // POS RULE: Barcode scanner ONLY works when NOT in input fields
      // Handle Enter key (end of barcode scan)
      if (event.key === 'Enter') {
        if (barcodeBuffer.length > 0) {
          // BARCODE SCAN COMPLETE - always priority
          event.preventDefault();
          event.stopPropagation();
          handleBarcodeScann(barcodeBuffer);
          setBarcodeBuffer("");
          return;
        } else {
          // NO BARCODE BUFFER - submit form (since we're not in input)
          event.preventDefault();
          event.stopPropagation();
          form.submit();
          return;
        }
      } 
      // Handle regular character input (part of barcode) - ONLY when not in input
      else if (event.key.length === 1 && /[a-zA-Z0-9\-_]/.test(event.key)) {
        // Barcode scanner detection logic:
        const isVeryFastTyping = timeDiff < 30;
        const hasExistingBuffer = barcodeBuffer.length > 0;
        const isLikelyBarcodeScanner = isVeryFastTyping || hasExistingBuffer;
        
        if (isLikelyBarcodeScanner) {
          // POS RULE: Barcode scanning overrides everything
          event.preventDefault();
          event.stopPropagation();
          setBarcodeBuffer(prev => prev + event.key);
          
          // Blur any focused input to prevent interference
          if (activeElement && activeElement.blur) {
            activeElement.blur();
          }
        } else {
          // Regular typing outside inputs - still capture for potential barcode
          setBarcodeBuffer(prev => prev + event.key);
        }
      }
    };

    // Add global keydown listener with highest priority (capture phase)
    document.addEventListener('keydown', handleKeyPress, true);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyPress, true);
    };
  }, [lastKeyTime, barcodeBuffer, selectedBranch, form]);

  const updateItemQuantity = (
    variantId: number,
    quantity: number
  ) => {
    if (quantity <= 0) {
      removeItem(variantId);
      return;
    }

    setSelectedItems((items) =>
      items.map((item) => {
        if (item.variant_id === variantId) {
          // Find the variant to get tax_method
          const variant = productsForSaleQuery.data?.find(
            (v) => v.id === variantId
          );
          const { line_total, tax_amount } = calculateTaxAndTotal(
            Number(item.unit_price),
            quantity,
            Number(item.tax_percentage) || 0,
            variant?.tax_method || "EXCLUSIVE"
          );

          return {
            ...item,
            quantity,
            tax_amount: Number(tax_amount) || 0,
            line_total: Number(line_total) || 0,
          };
        }
        return item;
      })
    );
  };

  const removeItem = (variantId: number) => {
    setSelectedItems((items) =>
      items.filter((item) => item.variant_id !== variantId)
    );
  };

  const calculateTotals = () => {
    // Calculate subtotal (price before tax for both exclusive and inclusive)
    const subtotal = selectedItems.reduce((sum, item) => {
      // For both inclusive and exclusive tax, we need the base amount (price without tax)
      const variant = productsForSaleQuery.data?.find(
        (v) => v.id === item.variant_id
      );
      const taxMethod = variant?.tax_method || "EXCLUSIVE";

      if (taxMethod === "INCLUSIVE") {
        // For inclusive tax, the subtotal is the line_total minus tax
        return sum + (Number(item.line_total) - Number(item.tax_amount));
      } else {
        // For exclusive tax, the subtotal is the base price (unit_price * quantity)
        return sum + (Number(item.unit_price) * Number(item.quantity));
      }
    }, 0);

    const totalTax = selectedItems.reduce(
      (sum, item) => sum + (Number(item.tax_amount) || 0),
      0
    );

    const discountAmountNum = Number(discountAmount) || 0;
    const shippingCostNum = Number(shippingCost) || 0;

    // Calculate discount on subtotal (before tax)
    const finalDiscount =
      discountType === DiscountType.PERCENTAGE
        ? (subtotal * discountAmountNum) / 100
        : discountAmountNum;

    // Total = subtotal - discount + tax + shipping
    const total = subtotal - finalDiscount + totalTax + shippingCostNum;

    return {
      subtotal: Number(subtotal),
      totalTax: Number(totalTax),
      finalDiscount: Number(finalDiscount),
      shippingCost: Number(shippingCostNum),
      total: Number(total),
    };
  };

  const onFinish = async (values: any) => {
    if (selectedItems.length === 0) {
      message.error("Please add at least one item to the sale");
      return;
    }

    // Check if payments are configured
    if (salePayments.length === 0) {
      message.error("Please add at least one payment method");
      return;
    }

    const totals = calculateTotals();
    const totalPaymentAmount = salePayments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    // Determine payment status
    let paymentStatus = PaymentStatus.PAID;
    if (totalPaymentAmount < totals.total) {
      paymentStatus = PaymentStatus.PARTIAL;
    } else if (totalPaymentAmount === 0) {
      paymentStatus = PaymentStatus.DUE;
    }

    const saleData: SaleFormData = {
      ...values,
      customer_id: selectedCustomer?.id,
      customer_name: selectedCustomer?.name || values.customer_name,
      customer_phone: selectedCustomer?.phone || values.customer_phone,
      customer_email: selectedCustomer?.email || values.customer_email,
      items: selectedItems.map(item => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        tax_amount: item.tax_amount,
        line_total: item.line_total,
        // Remove batch_id to let backend use FIFO automatically
      })),
      price_type: priceType,
      discount_type: discountType,
      discount_amount: totals.finalDiscount,
      shipping_cost: totals.shippingCost,
      payment_status: paymentStatus,
      received_amount: totalPaymentAmount,
      payments: salePayments,
    };

    try {
      setLoading(true);
      const createdSale = await salesApi.createSale(saleData);

      // Invalidate all relevant caches after sales operation
      queryClient.invalidateQueries({ queryKey: [queryKeys.batches] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.batch] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.inventorySummary] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.lowStockItems] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.stockByVariant] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.variantStock] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.movementHistory] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.expiringBatches] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.products] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.product] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.productVariants] });
      queryClient.invalidateQueries({
        queryKey: [queryKeys.productsForInventory],
      });
      queryClient.invalidateQueries({ queryKey: [queryKeys.productsForSale] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.sales] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.sale] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.salesStats] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.eod] });

      message.success("Sale created successfully!");
      navigate(`/sales/view/${createdSale.id}`);
    } catch (error: any) {
      console.error("Error creating sale:", error);
      message.error(error.response?.data?.message || "Failed to create sale");
    } finally {
      setLoading(false);
    }
  };

  // Update default payment amount when totals change
  useEffect(() => {
    const totals = calculateTotals();
    if (
      salePayments.length === 1 &&
      salePayments[0].payment_method === PaymentMethod.CASH
    ) {
      const currentTotalPaid = salePayments.reduce(
        (sum, p) => sum + p.amount,
        0
      );
      if (currentTotalPaid !== totals.total) {
        setSalePayments([
          {
            ...salePayments[0],
            amount: totals.total,
          },
        ]);
      }
    }
  }, [selectedItems, discountAmount, shippingCost, discountType]);

  const totals = calculateTotals();

  const saleItemColumns = [
    {
      title: "Product",
      key: "product",
      render: (record: SaleItem) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {record.image && (
            <img
              src={record.image}
              alt={record.variant_name}
              style={{
                width: 40,
                height: 40,
                objectFit: "cover",
                borderRadius: 4,
              }}
            />
          )}
          <div>
            <div style={{ fontWeight: 500 }}>{record.product_name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.variant_name}
            </Text>
            {record.variant_sku && (
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  SKU: {record.variant_sku}
                </Text>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Price",
      dataIndex: "unit_price",
      key: "unit_price",
      render: (price: number) => `$${(Number(price) || 0).toFixed(2)}`,
    },
    {
      title: "Quantity",
      key: "quantity",
      render: (record: SaleItem) => (
        <div>
          <InputNumber
            min={1}
            value={record.quantity}
            onChange={(value) =>
              updateItemQuantity(
                record.variant_id,
                value || 1
              )
            }
            onPressEnter={(e) => {
              // Just blur the input, the global handler will handle form submission
              (e.target as HTMLInputElement).blur();
            }}
            style={{ width: 80, marginBottom: 4 }}
          />
          <div style={{ fontSize: 11, color: "#666" }}>{record.unit_name}</div>
        </div>
      ),
    },
    {
      title: "Tax",
      key: "tax",
      render: (record: SaleItem) =>
        `$${(Number(record.tax_amount) || 0).toFixed(2)}`,
    },
    {
      title: "Total",
      key: "line_total",
      render: (record: SaleItem) =>
        `$${(Number(record.line_total) || 0).toFixed(2)}`,
    },
    {
      title: "Action",
      key: "action",
      render: (record: SaleItem) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeItem(record.variant_id)}
        />
      ),
    },
  ];

  return (
    <div>
      <PageTitle
        title="New Sale"
        breadcrumbs={[
          { title: "Home", href: "/" },
          { title: "Sales", href: "/sales" },
          { title: "New Sale" },
        ]}
      />

      <CustomerModal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onCreateCustomer={async (customer) => {
          try {
            const newCustomer = await post(endpoints.createCustomer, customer);
            setSelectedCustomer(newCustomer);
            setCustomers([...customers, newCustomer]);
            form.setFieldsValue({ customer_id: newCustomer.id });

            // Invalidate customers cache
            queryClient.invalidateQueries({
              queryKey: [queryKeys.customers],
            });

            message.success("Customer created successfully");
          } catch (error) {
            console.error("Error creating customer:", error);
            message.error("Failed to create customer");
          }
        }}
      />

      <Form 
        form={form} 
        onFinish={onFinish} 
        layout="vertical"
      >
        <div style={{ borderRadius: 8, marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item
                label="Branch"
                name="branch_id"
                rules={[{ required: true, message: "Please select a branch" }]}
              >
                <Select
                  placeholder="Select branch"
                  onChange={handleBranchChange}
                  loading={loading}
                >
                  {userBranches.map((branch) => (
                    <Option key={branch.id} value={branch.id}>
                      {branch.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Customer" name="customer_id">
                <div style={{ display: "flex", gap: 8 }}>
                  <Select
                    placeholder="Select customer"
                    showSearch
                    allowClear
                    optionFilterProp="children"
                    value={selectedCustomer?.id}
                    onChange={(value) => {
                      const customer = customers.find((c) => c.id === value);
                      setSelectedCustomer(customer || null);
                      form.setFieldsValue({ customer_id: value });
                    }}
                    style={{ flex: 1 }}
                  >
                    {customers.map((customer) => (
                      <Option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.phone})
                      </Option>
                    ))}
                  </Select>
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => setCustomerModalOpen(true)}
                    title="Add new customer"
                  />
                </div>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Price Type">
                <Button
                  icon={<SwapOutlined />}
                  onClick={() =>
                    setPriceType(
                      priceType === PriceType.REGULAR
                        ? PriceType.WHOLESALE
                        : PriceType.REGULAR
                    )
                  }
                  type={
                    priceType === PriceType.WHOLESALE ? "primary" : "default"
                  }
                  style={{ width: "100%" }}
                >
                  {priceType === PriceType.WHOLESALE ? "Wholesale" : "Regular"}
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div style={{ borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Product Selection</h3>
          <Select
            placeholder="Search and select products..."
            showSearch
            allowClear
            style={{ width: "100%" }}
            optionFilterProp="children"
            value={null}
            onChange={(value) => {
              if (value) {
                const selectedVariant = filteredVariants.find(v => v.id === value);
                if (selectedVariant) {
                  addToSale(selectedVariant);
                }
              }
            }}
            filterOption={(input, option) =>
              (option?.label?.toString().toLowerCase() || '').includes(input.toLowerCase())
            }
            loading={productsForSaleQuery.isLoading}
            disabled={!selectedBranch}
          >
            {filteredVariants.map((variant) => (
              <Option 
                key={variant.id} 
                value={variant.id}
                label={`${variant.product_name} - ${variant.name}`}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {variant.image && (
                    <img
                      src={variant.image}
                      alt={variant.name}
                      style={{
                        width: 24,
                        height: 24,
                        objectFit: "cover",
                        borderRadius: 4,
                      }}
                    />
                  )}
                  <div>
                    <span style={{ fontWeight: 500 }}>
                      {variant.product_name} - {variant.name}
                    </span>
                    {variant.sku && (
                      <div style={{ fontSize: 11, color: "#666" }}>
                        SKU: {variant.sku}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#666" }}>
                      $
                      {priceType === PriceType.WHOLESALE
                        ? variant.wholesale_price || variant.regular_price
                        : variant.regular_price}
                    </div>
                  </div>
                </div>
              </Option>
            ))}
          </Select>
        </div>

        <div style={{ borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Sale Items</h3>
          <Table
            columns={saleItemColumns}
            dataSource={selectedItems}
            rowKey={(record) => record.variant_id}
            size="small"
            pagination={false}
            locale={{ emptyText: "No items added yet" }}
          />
        </div>

        <div style={{ borderRadius: 8, marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item label="Discount Type">
                    <Radio.Group
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value)}
                      size="small"
                    >
                      <Radio value={DiscountType.FLAT}>Fixed</Radio>
                      <Radio value={DiscountType.PERCENTAGE}>Percentage</Radio>
                    </Radio.Group>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Discount" name="discount_amount">
                    <InputNumber
                      min={0}
                      style={{ width: "100%" }}
                      size="small"
                      placeholder="0"
                      onPressEnter={(e) => {
                        // Just blur the input, the global handler will handle form submission
                        (e.target as HTMLInputElement).blur();
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Shipping" name="shipping_cost">
                    <InputNumber
                      min={0}
                      style={{ width: "100%" }}
                      size="small"
                      placeholder="0"
                      onPressEnter={(e) => {
                        // Just blur the input, the global handler will handle form submission
                        (e.target as HTMLInputElement).blur();
                      }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Col>
            <Col span={10}>
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 12, fontSize: 14 }}>
                  Payment Methods
                </h4>

                <div style={{ marginBottom: 8 }}>
                  <Button
                    type="dashed"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      const remainingAmount = Math.max(
                        0,
                        totals.total -
                          salePayments.reduce((sum, p) => sum + p.amount, 0)
                      );
                      const newPayment: SalePayment = {
                        payment_method: PaymentMethod.CASH,
                        amount:
                          remainingAmount > 0 ? remainingAmount : totals.total,
                        reference: "",
                        notes: "",
                      };
                      setSalePayments([...salePayments, newPayment]);
                    }}
                    style={{ width: "100%" }}
                  >
                    Add Payment Method
                  </Button>
                </div>

                <div style={{ minHeight: "auto" }}>
                  {salePayments.map((payment, index) => (
                    <div
                      key={index}
                      style={{
                        marginBottom: 8,
                        // padding: 8,
                        // border: '1px solid #d9d9d9',
                        // borderRadius: 4,
                        // backgroundColor: '#fafafa'
                      }}
                    >
                      <Row gutter={4}>
                        <Col span={6}>
                          <Select
                            size="small"
                            value={payment.payment_method}
                            onChange={(value) => {
                              const updatedPayments = [...salePayments];
                              updatedPayments[index].payment_method = value;
                              setSalePayments(updatedPayments);
                            }}
                            style={{ width: "100%" }}
                            placeholder="Method"
                          >
                            <Option value={PaymentMethod.CASH}>Cash</Option>
                            <Option value={PaymentMethod.CARD}>Card</Option>
                            <Option value={PaymentMethod.CHEQUE}>Cheque</Option>
                            <Option value={PaymentMethod.BANK_TRANSFER}>
                              Bank Transfer
                            </Option>
                            <Option value={PaymentMethod.MOBILE_MONEY}>
                              Mobile Money
                            </Option>
                            <Option value={PaymentMethod.MFS}>MFS</Option>
                            <Option value={PaymentMethod.DEPOSIT}>
                              Deposit
                            </Option>
                            <Option value={PaymentMethod.CREDIT}>Credit</Option>
                          </Select>
                        </Col>
                        <Col span={6}>
                          <InputNumber
                            size="small"
                            value={payment.amount}
                            onChange={(value) => {
                              const updatedPayments = [...salePayments];
                              updatedPayments[index].amount = value || 0;
                              setSalePayments(updatedPayments);
                            }}
                            onPressEnter={(e) => {
                              // Just blur the input, the global handler will handle form submission
                              (e.target as HTMLInputElement).blur();
                            }}
                            min={0}
                            precision={2}
                            style={{ width: "100%" }}
                            placeholder="0.00"
                          />
                        </Col>
                        <Col span={6}>
                          <Input
                            size="small"
                            value={payment.reference}
                            onChange={(e) => {
                              const updatedPayments = [...salePayments];
                              updatedPayments[index].reference = e.target.value;
                              setSalePayments(updatedPayments);
                            }}
                            onPressEnter={(e) => {
                              // Just blur the input, the global handler will handle form submission
                              (e.target as HTMLInputElement).blur();
                            }}
                            placeholder="Reference"
                          />
                        </Col>
                        <Col span={4}>
                          <Input
                            size="small"
                            value={payment.notes}
                            onChange={(e) => {
                              const updatedPayments = [...salePayments];
                              updatedPayments[index].notes = e.target.value;
                              setSalePayments(updatedPayments);
                            }}
                            onPressEnter={(e) => {
                              // Just blur the input, the global handler will handle form submission
                              (e.target as HTMLInputElement).blur();
                            }}
                            placeholder="Notes"
                          />
                        </Col>
                        <Col span={2}>
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => {
                              const updatedPayments = salePayments.filter(
                                (_, i) => i !== index
                              );
                              setSalePayments(updatedPayments);
                            }}
                          />
                        </Col>
                      </Row>
                    </div>
                  ))}
                </div>
              </div>
            </Col>
            <Col span={8}>
              <div
                style={{
                  padding: 12,
                  borderRadius: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 12 }}>Subtotal:</Text>
                  <Text style={{ fontSize: 12 }} strong>
                    ${(Number(totals.subtotal) || 0).toFixed(2)}
                  </Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 12 }}>Tax:</Text>
                  <Text style={{ fontSize: 12 }}>
                    ${(Number(totals.totalTax) || 0).toFixed(2)}
                  </Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 12 }}>Discount:</Text>
                  <Text style={{ fontSize: 12 }}>
                    -${(Number(totals.finalDiscount) || 0).toFixed(2)}
                  </Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 12 }}>Shipping:</Text>
                  <Text style={{ fontSize: 12 }}>
                    ${(Number(totals.shippingCost) || 0).toFixed(2)}
                  </Text>
                </div>
                <Divider style={{ margin: "8px 0" }} />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <Text strong>Total:</Text>
                  <Text strong style={{ fontSize: 16 }}>
                    ${(Number(totals.total) || 0).toFixed(2)}
                  </Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 12 }}>Change:</Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color:
                        Math.max(
                          0,
                          salePayments.reduce((sum, p) => sum + p.amount, 0) -
                            totals.total
                        ) >= 0
                          ? "#52c41a"
                          : "#ff4d4f",
                    }}
                  >
                    $
                    {Math.max(
                      0,
                      salePayments.reduce((sum, p) => sum + p.amount, 0) -
                        totals.total
                    ).toFixed(2)}
                  </Text>
                </div>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ borderRadius: 8 }}>
          <Row gutter={16}>
            <Col span={18}>
              <Form.Item label="Notes" name="notes" style={{ marginBottom: 0 }}>
                <Input.TextArea
                  rows={4}
                  placeholder="Optional notes about this sale"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  height: "100%",
                }}
              >
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Button onClick={() => navigate("/sales")} size="large" block>
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<CalculatorOutlined />}
                    size="large"
                    disabled={selectedItems.length === 0 || loading}
                    loading={loading}
                    block
                  >
                    Create Sale
                  </Button>
                </Space>
              </div>
            </Col>
          </Row>
        </div>
      </Form>
    </div>
  );
};

export default NewSale;
