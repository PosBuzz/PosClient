import {
	ArrowLeftOutlined,
	BankOutlined,
	CalculatorOutlined,
	CarOutlined,
	CreditCardOutlined,
	DeleteOutlined,
	DollarOutlined,
	FileTextOutlined,
	MobileOutlined,
	MoneyCollectOutlined,
	PayCircleOutlined,
	PercentageOutlined,
	PlusOutlined,
	SaveOutlined,
	SearchOutlined,
	ShoppingCartOutlined,
	SwapOutlined,
	TagOutlined,
	WalletOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Badge,
	Button,
	Card,
	Col,
	Divider,
	Form,
	Input,
	InputNumber,
	Radio,
	Row,
	Select,
	Space,
	Table,
	Tooltip,
	Typography,
} from "antd";
import { useEffect, useState } from "react";
import { BsCash } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import { get, post } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { salesApi } from "../../api/sales-api";
import CustomerModal from "../../components/CustomerModal";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useAuthStore } from "../../stores/authStore";
import { useMessageStore } from "../../stores/messageStore";
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

const { Option } = Select;
const { Text } = Typography;

const NewSale = () => {
	const [form] = Form.useForm();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { user } = useAuthStore();
	const { messageApi } = useMessageStore();

	// Watch form values for real-time calculations
	const discountAmount = Form.useWatch("discount_amount", form) || 0;
	const shippingCost = Form.useWatch("shipping_cost", form) || 0;

	// State
	const [selectedItems, setSelectedItems] = useState<SaleItem[]>([]);
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [filteredVariants, setFilteredVariants] = useState<ProductVariantForSale[]>([]);
	const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
	const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
	const [customerModalOpen, setCustomerModalOpen] = useState(false);
	const [priceType, setPriceType] = useState<PriceType>(PriceType.REGULAR);
	const [discountType, setDiscountType] = useState<DiscountType>(DiscountType.FLAT);
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
		queryFn: () => salesApi.getProductsForSale(selectedBranch!),
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
		taxMethod: string,
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
		const existingItem = selectedItems.find((item) => item.variant_id === variant.id);

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
				variant.tax_method || "EXCLUSIVE",
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
						: item,
				),
			);
		} else {
			const { line_total, tax_amount } = calculateTaxAndTotal(
				price,
				1,
				Number(variant.tax_percentage) || 0,
				variant.tax_method || "EXCLUSIVE",
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
				messageApi?.success(`Added ${product.product_name} - ${product.name} to sale`);
			} else {
				messageApi?.error(`Product not found for barcode: ${barcode}`);
			}
		} catch (error: any) {
			console.error("Error scanning barcode:", error);
			messageApi?.error("Failed to scan barcode");
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
			const isTypingInInput =
				activeElement &&
				(activeElement.tagName === "INPUT" ||
					activeElement.tagName === "TEXTAREA" ||
					activeElement.role === "textbox" ||
					activeElement.classList.contains("ant-select-selection-search-input") ||
					activeElement.classList.contains("ant-input") ||
					activeElement.classList.contains("ant-input-number-input") ||
					activeElement.closest(".ant-select-dropdown") ||
					activeElement.closest(".ant-input") ||
					activeElement.closest(".ant-input-number") ||
					activeElement.getAttribute("contenteditable") === "true");

			// DEBUG: Log what's happening
			console.log(
				"Key pressed:",
				event.key,
				"isTypingInInput:",
				isTypingInInput,
				"activeElement:",
				activeElement?.tagName,
				activeElement?.className,
			);

			// If user is typing in input, do NOTHING with barcode logic
			if (isTypingInInput) {
				console.log("User is typing in input - ignoring for barcode");
				return; // Exit early, don't interfere with input
			}

			// POS RULE: Barcode scanner ONLY works when NOT in input fields
			// Handle Enter key (end of barcode scan)
			if (event.key === "Enter") {
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
					setBarcodeBuffer((prev) => prev + event.key);

					// Blur any focused input to prevent interference
					if (activeElement && activeElement.blur) {
						activeElement.blur();
					}
				} else {
					// Regular typing outside inputs - still capture for potential barcode
					setBarcodeBuffer((prev) => prev + event.key);
				}
			}
		};

		// Add global keydown listener with highest priority (capture phase)
		document.addEventListener("keydown", handleKeyPress, true);

		// Cleanup
		return () => {
			document.removeEventListener("keydown", handleKeyPress, true);
		};
	}, [lastKeyTime, barcodeBuffer, selectedBranch, form]);

	const updateItemQuantity = (variantId: number, quantity: number) => {
		if (quantity <= 0) {
			removeItem(variantId);
			return;
		}

		setSelectedItems((items) =>
			items.map((item) => {
				if (item.variant_id === variantId) {
					// Find the variant to get tax_method
					const variant = productsForSaleQuery.data?.find((v) => v.id === variantId);
					const { line_total, tax_amount } = calculateTaxAndTotal(
						Number(item.unit_price),
						quantity,
						Number(item.tax_percentage) || 0,
						variant?.tax_method || "EXCLUSIVE",
					);

					return {
						...item,
						quantity,
						tax_amount: Number(tax_amount) || 0,
						line_total: Number(line_total) || 0,
					};
				}
				return item;
			}),
		);
	};

	const removeItem = (variantId: number) => {
		setSelectedItems((items) => items.filter((item) => item.variant_id !== variantId));
	};

	const calculateTotals = () => {
		// Calculate subtotal (price before tax for both exclusive and inclusive)
		const subtotal = selectedItems.reduce((sum, item) => {
			// For both inclusive and exclusive tax, we need the base amount (price without tax)
			const variant = productsForSaleQuery.data?.find((v) => v.id === item.variant_id);
			const taxMethod = variant?.tax_method || "EXCLUSIVE";

			if (taxMethod === "INCLUSIVE") {
				// For inclusive tax, the subtotal is the line_total minus tax
				return sum + (Number(item.line_total) - Number(item.tax_amount));
			} else {
				// For exclusive tax, the subtotal is the base price (unit_price * quantity)
				return sum + Number(item.unit_price) * Number(item.quantity);
			}
		}, 0);

		const totalTax = selectedItems.reduce(
			(sum, item) => sum + (Number(item.tax_amount) || 0),
			0,
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
			messageApi?.error("Please add at least one item to the sale");
			return;
		}

		// Check if payments are configured
		if (salePayments.length === 0) {
			messageApi?.error("Please add at least one payment method");
			return;
		}

		const totals = calculateTotals();
		const totalPaymentAmount = salePayments.reduce((sum, payment) => sum + payment.amount, 0);

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
			items: selectedItems.map((item) => ({
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
			await salesApi.createSale(saleData);

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

			messageApi?.success("Sale created successfully!");

			// Reset form selections except branch
			setSelectedItems([]);
			setSelectedCustomer(null);
			setPriceType(PriceType.REGULAR);
			setDiscountType(DiscountType.FLAT);
			setSalePayments([
				{
					payment_method: PaymentMethod.CASH,
					amount: 0,
					reference: "",
					notes: "",
				},
			]);
			form.setFieldsValue({
				customer_id: undefined,
				discount_amount: 0,
				shipping_cost: 0,
				notes: "",
				// Keep branch_id as is
			});
			//   navigate(`/sales/view/${createdSale.id}`);
		} catch (error: any) {
			console.error("Error creating sale:", error);
			messageApi?.error(error.response?.data?.message || "Failed to create sale");
		} finally {
			setLoading(false);
		}
	};

	// Update default payment amount when totals change
	useEffect(() => {
		const totals = calculateTotals();
		if (salePayments.length === 1 && salePayments[0].payment_method === PaymentMethod.CASH) {
			const currentTotalPaid = salePayments.reduce((sum, p) => sum + p.amount, 0);
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
						onChange={(value) => updateItemQuantity(record.variant_id, value || 1)}
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
			render: (record: SaleItem) => `$${(Number(record.tax_amount) || 0).toFixed(2)}`,
		},
		{
			title: "Total",
			key: "line_total",
			render: (record: SaleItem) => `$${(Number(record.line_total) || 0).toFixed(2)}`,
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
		<div
			style={{
				height: "100vh",
				display: "flex",
				flexDirection: "column",
			}}
		>
			<Card
				className="!rounded-none !border-none"
				bodyStyle={{
					padding: "12px 12px 16px 12px",
					flex: 1,
					display: "flex",
					flexDirection: "column",
					minHeight: 0,
				}}
			>
				<CustomerModal
					open={customerModalOpen}
					onClose={() => setCustomerModalOpen(false)}
					onCreateCustomer={async (customer) => {
						try {
							const newCustomer = await post(endpoints.createCustomer, customer);
							setSelectedCustomer(newCustomer);
							setCustomers([...customers, newCustomer]);
							form.setFieldsValue({ customer_id: newCustomer.id });
							queryClient.invalidateQueries({ queryKey: [queryKeys.customers] });
							messageApi?.success("Customer created successfully");
						} catch (error) {
							console.error("Error creating customer:", error);
							messageApi?.error("Failed to create customer");
						}
					}}
				/>

				<div
					style={{
						flex: 1,
						display: "flex",
						flexDirection: "column",
						minHeight: 0,
						maxHeight: "100%",
					}}
				>
					{/* Compact Header */}
					<div
						style={{
							padding: "6px 10px",
							marginBottom: 12,
							borderRadius: 12,
							boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<Typography.Title
							level={4}
							style={{
								margin: 0,
								display: "flex",
								alignItems: "center",
								gap: 12,
							}}
						>
							Point of Sale
						</Typography.Title>
						<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
							{selectedItems.length > 0 && (
								<Badge
									count={`${selectedItems.length} items`}
									style={{
										fontSize: 14,
										height: 28,
										lineHeight: "28px",
										borderRadius: 14,
										padding: "0 12px",
									}}
								/>
							)}
							<Button
								type="primary"
								icon={<ArrowLeftOutlined />}
								onClick={() => navigate("/")}
							>
								Back
							</Button>
						</div>
					</div>

					<Form
						form={form}
						onFinish={onFinish}
						layout="vertical"
						style={{
							flex: 1,
							display: "flex",
							flexDirection: "column",
							minHeight: 0,
							maxHeight: "100%",
							height: "100%",
						}}
					>
						<Row gutter={12} style={{ flex: 1, minHeight: 0, maxHeight: "100%" }}>
							{/* Left Column - Controls & Product Selection */}
							<Col
								xs={24}
								lg={10}
								style={{
									display: "flex",
									flexDirection: "column",
									minHeight: 0,
									maxHeight: "100%",
								}}
							>
								{/* Top Controls - Branch, Customer, Price Type */}
								<Card
									style={{
										marginBottom: 12,
										borderRadius: 12,
										boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
									}}
									bodyStyle={{ padding: 12 }}
								>
									<Row gutter={[12, 12]}>
										<Col span={8}>
											<Form.Item
												label={
													<span style={{ fontWeight: 600, fontSize: 13 }}>
														Branch
													</span>
												}
												name="branch_id"
												rules={[
													{ required: true, message: "Select branch" },
												]}
												style={{ marginBottom: 0 }}
											>
												<Select
													placeholder="Select branch"
													onChange={(value) => {
														handleBranchChange(value);
														// Remove focus after selection
														setTimeout(() => {
															const activeElement =
																document.activeElement as HTMLElement;
															if (
																activeElement &&
																activeElement.blur
															) {
																activeElement.blur();
															}
														}, 0);
													}}
													loading={loading}
													// size="large"
												>
													{userBranches.map((branch) => (
														<Option key={branch.id} value={branch.id}>
															{branch.name}
														</Option>
													))}
												</Select>
											</Form.Item>
										</Col>
										<Col span={10}>
											<Form.Item
												label={
													<span style={{ fontWeight: 600, fontSize: 13 }}>
														Customer
													</span>
												}
												name="customer_id"
												style={{ marginBottom: 0 }}
											>
												<div style={{ display: "flex", gap: 8 }}>
													<Select
														placeholder="Walk-in customer"
														showSearch
														allowClear
														optionFilterProp="children"
														value={selectedCustomer?.id}
														onChange={(value) => {
															const customer = customers.find(
																(c) => c.id === value,
															);
															setSelectedCustomer(customer || null);
															form.setFieldsValue({
																customer_id: value,
															});
															// Remove focus after selection
															setTimeout(() => {
																const activeElement =
																	document.activeElement as HTMLElement;
																if (
																	activeElement &&
																	activeElement.blur
																) {
																	activeElement.blur();
																}
															}, 0);
														}}
														style={{ flex: 1 }}
														//   size="large"
													>
														{customers.map((customer) => (
															<Option
																key={customer.id}
																value={customer.id}
															>
																{customer.name} • {customer.phone}
															</Option>
														))}
													</Select>
													<Tooltip title="Add customer">
														<Button
															icon={<PlusOutlined />}
															onClick={() =>
																setCustomerModalOpen(true)
															}
															// size="large"
															style={{
																borderColor: "#52c41a",
																color: "#52c41a",
															}}
														/>
													</Tooltip>
												</div>
											</Form.Item>
										</Col>
										<Col span={6}>
											<Form.Item
												label={
													<span style={{ fontWeight: 600, fontSize: 13 }}>
														Pricing
													</span>
												}
												style={{ marginBottom: 0 }}
											>
												<Button
													icon={<SwapOutlined />}
													onClick={() =>
														setPriceType(
															priceType === PriceType.REGULAR
																? PriceType.WHOLESALE
																: PriceType.REGULAR,
														)
													}
													type={
														priceType === PriceType.WHOLESALE
															? "primary"
															: "default"
													}
													// size="large"
													style={{ width: "100%" }}
												>
													{priceType === PriceType.WHOLESALE
														? "Wholesale"
														: "Retail"}
												</Button>
											</Form.Item>
										</Col>
									</Row>
								</Card>

								{/* Product Search - Prominent */}
								<Card
									style={{
										marginBottom: 12,
										borderRadius: 12,
										boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
									}}
									bodyStyle={{ padding: 12 }}
								>
									<div
										style={{
											marginBottom: 8,
											display: "flex",
											alignItems: "center",
											gap: 8,
										}}
									>
										<div
											style={{
												width: 32,
												height: 32,
												borderRadius: 8,
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
											}}
										>
											<ShoppingCartOutlined style={{ fontSize: 16 }} />
										</div>
										<span style={{ fontWeight: 600, fontSize: 15 }}>
											Add Products
										</span>
									</div>
									<Select
										placeholder={
											<>
												<SearchOutlined /> Search product name, SKU or scan
												barcode...
											</>
										}
										showSearch
										allowClear
										style={{ width: "100%" }}
										optionFilterProp="children"
										value={null}
										//   size="large"
										onChange={(value) => {
											if (value) {
												const selectedVariant = filteredVariants.find(
													(v) => v.id === value,
												);
												if (selectedVariant) {
													addToSale(selectedVariant);
												}
											}
											// Remove focus after selection
											setTimeout(() => {
												const activeElement =
													document.activeElement as HTMLElement;
												if (activeElement && activeElement.blur) {
													activeElement.blur();
												}
											}, 0);
										}}
										filterOption={(input, option) =>
											(
												option?.label?.toString().toLowerCase() || ""
											).includes(input.toLowerCase())
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
												<div
													style={{
														display: "flex",
														alignItems: "center",
														gap: 12,
														padding: "6px 0",
													}}
												>
													{variant.image ? (
														<img
															src={variant.image}
															alt={variant.name}
															style={{
																width: 48,
																height: 48,
																objectFit: "cover",
																borderRadius: 8,
															}}
														/>
													) : (
														<div
															style={{
																width: 48,
																height: 48,
																borderRadius: 8,

																display: "flex",
																alignItems: "center",
																justifyContent: "center",
															}}
														>
															<ShoppingCartOutlined />
														</div>
													)}
													<div style={{ flex: 1 }}>
														<div
															style={{
																fontWeight: 600,
																marginBottom: 3,
																fontSize: 14,
															}}
														>
															{variant.product_name}
														</div>
														<div
															style={{
																fontSize: 12,
																marginBottom: 2,
															}}
														>
															{variant.name}
															{variant.sku &&
																` • SKU: ${variant.sku}`}
														</div>
														<div
															style={{
																fontSize: 15,
																fontWeight: 700,
															}}
														>
															$
															{priceType === PriceType.WHOLESALE
																? variant.wholesale_price ||
																  variant.regular_price
																: variant.regular_price}
														</div>
													</div>
												</div>
											</Option>
										))}
									</Select>
								</Card>

								{/* Discounts & Payments */}
								<Card
									style={{
										borderRadius: 12,
										boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
										marginBottom: 12,
										display: "flex",
										flexDirection: "column",
										flex: "1 1 auto",
										minHeight: 0,
									}}
									bodyStyle={{
										padding: 12,
										display: "flex",
										flexDirection: "column",
										flex: 1,
										minHeight: 0,
									}}
								>
									<Typography.Title
										level={5}
										style={{
											marginBottom: 10,
											display: "flex",
											alignItems: "center",
											gap: 8,
											flexShrink: 0,
										}}
									>
										<TagOutlined />
										Additional Charges
									</Typography.Title>
									<div style={{ flexShrink: 0 }}>
										<Row gutter={[8, 10]}>
											<Col span={12}>
												<Form.Item
													label={
														<span
															style={{
																fontWeight: 600,
																fontSize: 12,
															}}
														>
															Discount Type
														</span>
													}
													style={{ marginBottom: 0 }}
												>
													<Radio.Group
														value={discountType}
														onChange={(e) =>
															setDiscountType(e.target.value)
														}
														buttonStyle="solid"
														style={{ width: "100%" }}
														size="middle"
													>
														<Radio.Button
															value={DiscountType.FLAT}
															style={{
																width: "50%",
																textAlign: "center",
															}}
														>
															<MoneyCollectOutlined className="" />{" "}
															Fixed
														</Radio.Button>
														<Radio.Button
															value={DiscountType.PERCENTAGE}
															style={{
																width: "50%",
																textAlign: "center",
															}}
														>
															<PercentageOutlined className="mr-2" />{" "}
															Percent
														</Radio.Button>
													</Radio.Group>
												</Form.Item>
											</Col>
											<Col span={6}>
												<Form.Item
													label={
														<span
															style={{
																fontWeight: 600,
																fontSize: 12,
															}}
														>
															Discount
														</span>
													}
													name="discount_amount"
													style={{ marginBottom: 0 }}
												>
													<InputNumber
														min={0}
														style={{ width: "100%" }}
														placeholder="0"
														size="middle"
														prefix={
															discountType === DiscountType.PERCENTAGE
																? "%"
																: "$"
														}
														onPressEnter={(e) =>
															(e.target as HTMLInputElement).blur()
														}
													/>
												</Form.Item>
											</Col>
											<Col span={6}>
												<Form.Item
													label={
														<span
															style={{
																fontWeight: 600,
																fontSize: 12,
															}}
														>
															Shipping
														</span>
													}
													name="shipping_cost"
													style={{ marginBottom: 0 }}
												>
													<InputNumber
														min={0}
														style={{ width: "100%" }}
														placeholder="0"
														size="middle"
														prefix="$"
														onPressEnter={(e) =>
															(e.target as HTMLInputElement).blur()
														}
													/>
												</Form.Item>
											</Col>
										</Row>
									</div>

									<Divider style={{ margin: "10px 0", flexShrink: 0 }} />

									<div
										style={{
											flex: 1,
										}}
									>
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
												marginBottom: 8,
											}}
										>
											<Typography.Title level={5} style={{ margin: 0 }}>
												<CreditCardOutlined className="mr-2" /> Payments
											</Typography.Title>
											<Button
												size="small"
												icon={<PlusOutlined />}
												onClick={() => {
													const remainingAmount = Math.max(
														0,
														totals.total -
															salePayments.reduce(
																(sum, p) => sum + p.amount,
																0,
															),
													);
													const newPayment: SalePayment = {
														payment_method: PaymentMethod.CASH,
														amount:
															remainingAmount > 0
																? remainingAmount
																: totals.total,
														reference: "",
														notes: "",
													};
													setSalePayments([...salePayments, newPayment]);
												}}
											>
												Add
											</Button>
										</div>

										<Space
											direction="vertical"
											size={6}
											style={{
												flex: 1,
												minHeight: 0,
												maxHeight: "150px",
												overflowY: "auto",
												overflowX: "hidden",
											}}
										>
											{salePayments.map((payment, index) => (
												<Card
													key={index}
													size="small"
													style={{
														borderRadius: 8,
													}}
													bodyStyle={{ padding: 8 }}
												>
													<Row gutter={6} align="middle">
														<Col span={6}>
															<Select
																size="small"
																value={payment.payment_method}
																onChange={(value) => {
																	const updatedPayments = [
																		...salePayments,
																	];
																	updatedPayments[
																		index
																	].payment_method = value;
																	setSalePayments(
																		updatedPayments,
																	);
																	// Remove focus after selection
																	setTimeout(() => {
																		const activeElement =
																			document.activeElement as HTMLElement;
																		if (
																			activeElement &&
																			activeElement.blur
																		) {
																			activeElement.blur();
																		}
																	}, 0);
																}}
																style={{ width: "100%" }}
																placeholder="Method"
															>
																<Option value={PaymentMethod.CASH}>
																	<BsCash className="mr-2 inline" />{" "}
																	Cash
																</Option>
																<Option value={PaymentMethod.CARD}>
																	<CreditCardOutlined className="mr-2" />{" "}
																	Card
																</Option>
																<Option
																	value={PaymentMethod.CHEQUE}
																>
																	<FileTextOutlined className="mr-2" />{" "}
																	Cheque
																</Option>
																<Option
																	value={
																		PaymentMethod.BANK_TRANSFER
																	}
																>
																	<BankOutlined className="mr-2" />{" "}
																	Transfer
																</Option>
																<Option
																	value={
																		PaymentMethod.MOBILE_MONEY
																	}
																>
																	<MobileOutlined className="mr-2" />{" "}
																	Mobile
																</Option>
																<Option value={PaymentMethod.MFS}>
																	<PayCircleOutlined className="mr-2" />{" "}
																	MFS
																</Option>
																<Option
																	value={PaymentMethod.DEPOSIT}
																>
																	<SaveOutlined className="mr-2" />{" "}
																	Deposit
																</Option>
																<Option
																	value={PaymentMethod.CREDIT}
																>
																	<WalletOutlined className="mr-2" />{" "}
																	Credit
																</Option>
																<Option
																	value={PaymentMethod.EXCHANGE}
																>
																	<SwapOutlined className="mr-2" />{" "}
																	Exchange
																</Option>
															</Select>
														</Col>
														<Col span={6}>
															<InputNumber
																size="small"
																value={payment.amount}
																onChange={(value) => {
																	const updatedPayments = [
																		...salePayments,
																	];
																	updatedPayments[index].amount =
																		value || 0;
																	setSalePayments(
																		updatedPayments,
																	);
																}}
																onPressEnter={(e) =>
																	(
																		e.target as HTMLInputElement
																	).blur()
																}
																min={0}
																precision={2}
																style={{ width: "100%" }}
																placeholder="Amount"
																prefix="$"
															/>
														</Col>
														<Col span={5}>
															<Input
																size="small"
																value={payment.reference}
																onChange={(e) => {
																	const updatedPayments = [
																		...salePayments,
																	];
																	updatedPayments[
																		index
																	].reference = e.target.value;
																	setSalePayments(
																		updatedPayments,
																	);
																}}
																onPressEnter={(e) =>
																	(
																		e.target as HTMLInputElement
																	).blur()
																}
																placeholder="Ref#"
															/>
														</Col>
														<Col span={5}>
															<Input
																size="small"
																value={payment.notes}
																onChange={(e) => {
																	const updatedPayments = [
																		...salePayments,
																	];
																	updatedPayments[index].notes =
																		e.target.value;
																	setSalePayments(
																		updatedPayments,
																	);
																}}
																onPressEnter={(e) =>
																	(
																		e.target as HTMLInputElement
																	).blur()
																}
																placeholder="Notes"
															/>
														</Col>
														<Col span={2}>
															<Tooltip title="Remove">
																<Button
																	size="small"
																	danger
																	type="text"
																	icon={<DeleteOutlined />}
																	onClick={() => {
																		const updatedPayments =
																			salePayments.filter(
																				(_, i) =>
																					i !== index,
																			);
																		setSalePayments(
																			updatedPayments,
																		);
																	}}
																/>
															</Tooltip>
														</Col>
													</Row>
												</Card>
											))}
										</Space>
									</div>
								</Card>
								{/* Action Buttons */}
								<Card
									style={{
										borderRadius: 12,
										boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
										marginTop: "auto",
										flexShrink: 0,
									}}
									bodyStyle={{ padding: 12 }}
								>
									<Form.Item
										label={
											<span style={{ fontWeight: 600, fontSize: 13 }}>
												<FileTextOutlined className="mr-2" /> Sale Notes
											</span>
										}
										name="notes"
										style={{ marginBottom: 10 }}
									>
										<Input.TextArea
											rows={3}
											placeholder="Add any notes about this sale..."
											style={{ borderRadius: 8 }}
											autoSize={{ minRows: 3, maxRows: 3 }}
										/>
									</Form.Item>

									<Row gutter={8}>
										<Col span={8}>
											<Button
												//   onClick={() => navigate("/sales")}
												size="large"
												block
												//   style={{ height: 48, fontWeight: 600 }}
											>
												Cancel
											</Button>
										</Col>
										<Col span={16}>
											<Button
												type="primary"
												htmlType="submit"
												icon={<CalculatorOutlined />}
												size="large"
												disabled={selectedItems.length === 0 || loading}
												loading={loading}
												block
												//   style={{
												//     height: 48,
												//     fontSize: 16,
												//     fontWeight: 700,
												//     border: "none",
												//   }}
											>
												Complete Sale
											</Button>
										</Col>
									</Row>
								</Card>
							</Col>

							{/* Right Column - HIGHLIGHTED Sale Items & Total */}
							<Col
								xs={24}
								lg={14}
								style={{
									display: "flex",
									flexDirection: "column",
									minHeight: 0,
									maxHeight: "100%",
								}}
							>
								{/* Sale Items - FOCUSED */}
								<Card
									style={{
										marginBottom: 12,
										borderRadius: 12,
										boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
										flex: 1,
										minHeight: 0,
										display: "flex",
										flexDirection: "column",
									}}
									bodyStyle={{
										padding: 0,
										display: "flex",
										flexDirection: "column",
										flex: 1,
										minHeight: 0,
									}}
								>
									{/* Header with gradient */}
									<div
										style={{
											padding: "10px 16px",
											borderRadius: "10px 10px 0 0",
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
										}}
									>
										<Typography.Title
											level={5}
											style={{
												margin: 0,
												display: "flex",
												alignItems: "center",
												gap: 8,
											}}
										>
											<ShoppingCartOutlined style={{ fontSize: 18 }} />
											Cart Items
										</Typography.Title>
										{selectedItems.length > 0 && (
											<Badge
												count={selectedItems.length}
												style={{
													backgroundColor: "#52c41a",
													fontSize: 14,
													height: 24,
													lineHeight: "24px",
													boxShadow: "0 2px 8px rgba(82, 196, 26, 0.3)",
												}}
											/>
										)}
									</div>

									<div
										style={{
											padding: 12,
											flex: 1,
											minHeight: 0,
											maxHeight: "300px",
											display: "flex",
											flexDirection: "column",
											overflowY: "auto",
											overflowX: "hidden",
										}}
									>
										{selectedItems.length === 0 ? (
											<div
												style={{
													textAlign: "center",
													padding: "60px 20px",
													color: "#bfbfbf",
													flex: 1,
													display: "flex",
													flexDirection: "column",
													justifyContent: "center",
													alignItems: "center",
												}}
											>
												<ShoppingCartOutlined
													style={{
														fontSize: 64,
														marginBottom: 16,
														opacity: 0.3,
													}}
												/>
												<div style={{ fontSize: 16, fontWeight: 500 }}>
													No items in cart
												</div>
												<div style={{ fontSize: 13, marginTop: 8 }}>
													Search and add products to start
												</div>
											</div>
										) : (
											<div
												style={{
													flex: 1,
													minHeight: 0,
													maxHeight: "100%",
													overflowY: "auto",
													overflowX: "hidden",
												}}
											>
												<Table
													columns={saleItemColumns}
													dataSource={selectedItems}
													rowKey={(record) => record.variant_id}
													size="small"
													pagination={false}
													showHeader={true}
													bordered={false}
													style={{
														background: "transparent",
													}}
												/>
											</div>
										)}
									</div>
								</Card>

								{/* Total Section - HIGHLY FOCUSED */}
								<Card
									style={{
										borderRadius: 12,
										boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
										border: "none",
										marginBottom: 0,
										flexShrink: 0,
									}}
									bodyStyle={{ padding: "12px 16px 16px 16px" }}
								>
									{/* Main Total Display */}
									<div
										style={{
											borderRadius: 12,
											padding: "8px 12px",
											marginBottom: 8,
											backdropFilter: "blur(10px)",
										}}
									>
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
											}}
										>
											<Text
												style={{
													fontSize: 18,
													fontWeight: 600,
												}}
											>
												TOTAL AMOUNT
											</Text>
											<Text
												style={{
													fontSize: 42,
													fontWeight: 800,
													letterSpacing: "-1px",
													textShadow: "0 2px 8px rgba(0,0,0,0.2)",
												}}
											>
												${Math.ceil(Number(totals.total) || 0).toFixed(0)}
											</Text>
										</div>
									</div>

									{/* Breakdown */}
									<Space direction="vertical" style={{ width: "100%" }} size={4}>
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												padding: "8px 12px",
												borderRadius: 8,
											}}
										>
											<Text
												style={{
													fontSize: 14,
												}}
											>
												Subtotal:
											</Text>
											<Text strong style={{ fontSize: 16 }}>
												${(Number(totals.subtotal) || 0).toFixed(2)}
											</Text>
										</div>
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												padding: "8px 12px",
												background: "rgba(255,255,255,0.1)",
												borderRadius: 8,
											}}
										>
											<Text
												style={{
													fontSize: 14,
												}}
											>
												Tax:
											</Text>
											<Text style={{ fontSize: 15 }}>
												${(Number(totals.totalTax) || 0).toFixed(2)}
											</Text>
										</div>
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												padding: "8px 12px",
												background:
													totals.finalDiscount > 0
														? "rgba(255, 214, 102, 0.2)"
														: "rgba(255,255,255,0.1)",
												borderRadius: 8,
												border:
													totals.finalDiscount > 0
														? "1px solid rgba(255, 214, 102, 0.3)"
														: "none",
											}}
										>
											<Text
												style={{
													fontSize: 14,
													fontWeight:
														totals.finalDiscount > 0 ? 600 : 400,
													display: "flex",
													alignItems: "center",
												}}
											>
												{totals.finalDiscount > 0 ? (
													<DollarOutlined className="mr-2" />
												) : (
													""
												)}
												Discount:
											</Text>
											<Text
												strong
												style={{
													fontSize: 15,
												}}
											>
												-${(Number(totals.finalDiscount) || 0).toFixed(2)}
											</Text>
										</div>
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												padding: "8px 12px",
												background: "rgba(255,255,255,0.1)",
												borderRadius: 8,
											}}
										>
											<Text
												style={{
													fontSize: 14,
												}}
											>
												{totals.shippingCost > 0 ? (
													<CarOutlined className="mr-2" />
												) : null}
												Shipping:
											</Text>
											<Text style={{ fontSize: 15 }}>
												${(Number(totals.shippingCost) || 0).toFixed(2)}
											</Text>
										</div>

										<Divider
											style={{
												margin: "4px 0",
											}}
										/>

										{/* Change Display */}
										<div
											style={{
												padding: "8px 12px",
												background:
													Math.max(
														0,
														salePayments.reduce(
															(sum, p) => sum + p.amount,
															0,
														) - totals.total,
													) >= 0
														? "rgba(149, 222, 100, 0.25)"
														: "rgba(255, 120, 117, 0.25)",
												borderRadius: 10,
												border:
													Math.max(
														0,
														salePayments.reduce(
															(sum, p) => sum + p.amount,
															0,
														) - totals.total,
													) >= 0
														? "2px solid rgba(149, 222, 100, 0.5)"
														: "2px solid rgba(255, 120, 117, 0.5)",
											}}
										>
											<div
												style={{
													display: "flex",
													justifyContent: "space-between",
													alignItems: "center",
												}}
											>
												<Text strong style={{ fontSize: 16 }}>
													<MoneyCollectOutlined className="mr-2" />{" "}
													Change:
												</Text>
												<Text
													strong
													style={{
														fontSize: 20,
														fontWeight: 700,
													}}
												>
													$
													{Math.floor(
														Math.max(
															0,
															salePayments.reduce(
																(sum, p) => sum + p.amount,
																0,
															) - totals.total,
														),
													).toFixed(0)}
												</Text>
											</div>
										</div>
									</Space>
								</Card>
							</Col>
						</Row>
					</Form>
				</div>
			</Card>
		</div>
	);
};

export default NewSale;
