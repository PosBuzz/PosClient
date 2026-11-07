import { formatCurrency } from "../../utils/formatters";
import { takaPrefix } from "../../components/Currency";
import { ClearOutlined, EyeOutlined, PrinterOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
} from "antd";
import InputNumber from "../../components/NumberInput";
import { useEffect, useRef, useState } from "react";
import { Alert, Typography } from "antd";
import {
  barcodeIsValid,
  barcodeDisplayValue,
  defaultLayout,
  labelGeometry,
  labelStyles,
  labelPrintDocument,
  printLabelDocument,
  type LabelLayout,
} from "./label-layout";
import Barcode from "react-barcode";
import { inventoryApi } from "../../api/inventory-api";
import { productApi } from "../../api/product-api";
import PageTitle from "../../components/PageTitle";
import { queryKeys } from "../../constants/queryKeys";
import { useAuthStore } from "../../stores/authStore";
import { useMessageStore } from "../../stores/messageStore";
import {
  ProductListItem,
  ProductVariantSummary,
} from "../../types/product.types";
import { setPageTitle } from "../../utils/setPageTitle";

const { Option } = Select;

interface ProductOption {
  id: number;
  label: string;
  productCode?: string;
  sku?: string;
  barcode: string;
  price: number;
  productName: string;
  variantName: string;
  taxMethod: string;
  taxPercentage: number;
}

const BarcodePrinting = () => {
  const [form] = Form.useForm();
  const { user } = useAuthStore();
  const { messageApi } = useMessageStore();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [previewModalVisible, setPreviewModalVisible] = useState(false);

  // Fetch branches
  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: [queryKeys.branches],
    queryFn: () => inventoryApi.getBranches(),
  });

  // Fetch products with variants that have barcodes
  const { data: productOptions = [], isLoading: loadingProducts } = useQuery({
    queryKey: [queryKeys.products, searchTerm],
    queryFn: () =>
      productApi.getProducts({
        search: searchTerm,
        page: 1,
        limit: 50,
      }),
    select: (data) => {
      // Flatten variants from all products that have barcodes
      const options: ProductOption[] = [];
      data.data.forEach((product: ProductListItem) => {
        product.variants?.forEach((variant: ProductVariantSummary) => {
          if (variant.barcode) {
            options.push({
              id: variant.id || 0,
              label: `${product.name} - ${variant.name}`,
              productCode: product.code,
              sku: variant.sku,
              barcode: variant.barcode,
              price: Number(variant.regular_price) || 0,
              productName: product.name,
              variantName: variant.name,
              taxMethod: product.tax_method || "INCLUSIVE",
              taxPercentage: product.tax ?? 0,
            });
          }
        });
      });
      return options;
    },
  });

  // Handle product selection
  const handleProductSelect = (productId: string) => {
    const product = productOptions.find((p) => p.id.toString() === productId);
    if (product) {
      const isVatIncluded = product.taxMethod === "INCLUSIVE";

      // Set all fields at once to ensure proper state updates
      form.setFieldsValue({
        BarcodeValue: product.barcode,
        ProductName: product.label,
        Price: parseFloat(product.price.toString()),
        vatIncluded: isVatIncluded,
        vatPercentage: product.taxPercentage,
        selectedProduct: productId,
      });

      // Force form to re-render
      //   form.validateFields().catch(() => {});
    }
  };

  // Handle branch selection
  const handleBranchSelect = (branchId: string) => {
    const branch = branches.find((b) => b.id.toString() === branchId);
    if (branch) {
      form.setFieldsValue({
        BranchName: branch.name,
        Location: branch.address || "",
      });
    }
  };

  const values = Form.useWatch([], form) || {};
  const layout = { ...defaultLayout, ...values } as LabelLayout;
  const labelRef = useRef<HTMLDivElement>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const barcode = values.BarcodeValue || "";
  const format = values.format || "CODE128";
  const valid = barcodeIsValid(barcode, format);
  let layoutError = "";
  let geometry: ReturnType<typeof labelGeometry> | undefined;
  try {
    geometry = labelGeometry(layout);
  } catch (error) {
    layoutError = (error as Error).message;
  }
  useEffect(() => {
    const svg = labelRef.current?.querySelector("svg");
    if (svg) {
      svg.setAttribute(
        "viewBox",
        `0 0 ${svg.getAttribute("width")} ${svg.getAttribute("height")}`,
      );
      svg.setAttribute("preserveAspectRatio", "none");
    }
  }, [barcode, format]);
  const documentHtml = async () => {
    await form.validateFields();
    labelGeometry(layout);
    if (!valid) {
      throw new Error("Enter a valid barcode for the selected format.");
    }
    const label = labelRef.current;
    if (!label) throw new Error("Label preview is unavailable.");
    if (
      label.scrollHeight > label.clientHeight + 1 ||
      label.scrollWidth > label.clientWidth + 1
    ) {
      throw new Error(
        "Content does not fit. Increase the label size, reduce text or font size, or hide fields.",
      );
    }
    const svg = label.querySelector("svg");
    const modules = Number(svg?.getAttribute("width")) / 2;
    if (modules && (layout.labelWidth - 2 * layout.padding) / modules < 0.19) {
      throw new Error(
        "Barcode bars are too narrow to scan reliably. Use a wider label or a shorter barcode.",
      );
    }
    return labelPrintDocument(layout, label.outerHTML);
  };
  const handlePreview = async () => {
    try {
      setPreviewHtml(await documentHtml());
      setPreviewModalVisible(true);
    } catch (error) {
      if (error instanceof Error) messageApi?.error(error.message);
    }
  };
  const handlePrint = async () => {
    try {
      const html = await documentHtml();
      setLoading(true);
      await printLabelDocument(html);
    } catch (error) {
      if (error instanceof Error) messageApi?.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  const handleClear = () => {
    form.resetFields();
    setPreviewModalVisible(false);
  };
  const numberField = (
    name: keyof LabelLayout,
    label: string,
    min = 0,
    max = 500,
    step = 0.5,
  ) => (
    <Col xs={12} md={8}>
      <Form.Item
        name={name}
        label={label}
        rules={[{ required: true, message: "Required" }]}
      >
        <InputNumber
          min={min}
          max={max}
          step={step}
          style={{ width: "100%" }}
        />
      </Form.Item>
    </Col>
  );
  return (
    <div>
      {setPageTitle("Barcode Printing")}
      <PageTitle
        title="Barcode Printing"
        breadcrumbs={[
          { title: "Home", href: "/" },
          { title: "Barcode Printing" },
        ]}
      />

      <Row gutter={24}>
        <Col xs={24} lg={16}>
          <Card title="Label Configuration" size="small">
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                ...defaultLayout,
                format: "CODE128",
                showShop: true,
                showBranch: true,
                showLocation: true,
                showProduct: true,
                showPrice: true,
                showValue: true,
                ShopName: user?.company_name || "",
                Quantity: 1,
                PrintBarcodeOnly: false,
                vatIncluded: true,
                vatPercentage: 0,
              }}
            >
              <Alert
                type="info"
                showIcon
                message="Print using your browser"
                description="Choose the matching paper size, use 100% scale, and turn off headers and footers in the print dialog. No printing agent is needed for labels."
                style={{ marginBottom: 16 }}
              />
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="Label preset">
                    <Select
                      value={
                        ["38x25", "50x30", "58x40", "70x40", "100x50"].includes(
                          `${layout.labelWidth}x${layout.labelHeight}`,
                        )
                          ? `${layout.labelWidth}x${layout.labelHeight}`
                          : "custom"
                      }
                      options={[
                        ...["38x25", "50x30", "58x40", "70x40", "100x50"].map(
                          (value) => ({
                            value,
                            label: value.replace("x", " × ") + " mm",
                          }),
                        ),
                        { value: "custom", label: "Custom", disabled: true },
                      ]}
                      onChange={(value) => {
                        const [labelWidth, labelHeight] = value
                          .split("x")
                          .map(Number);
                        form.setFieldsValue({ labelWidth, labelHeight });
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="paper" label="Paper layout">
                    <Select
                      options={[
                        { value: "roll", label: "Label roll / strip" },
                        { value: "sheet", label: "Sheet (A4 or custom)" },
                      ]}
                    />
                  </Form.Item>
                </Col>
                {numberField("labelWidth", "Label width (mm)", 10, 300)}
                {numberField("labelHeight", "Label height (mm)", 10, 500)}
                {numberField("columns", "Labels across", 1, 20, 1)}
                {layout.paper === "sheet" && (
                  <>
                    {numberField("paperWidth", "Paper width (mm)", 10, 1000)}
                    {numberField("paperHeight", "Paper height (mm)", 10, 1000)}
                  </>
                )}
                {numberField("marginX", "Side margins (mm)")}
                {numberField("marginY", "Top/bottom margins (mm)")}
                {numberField("gapX", "Horizontal gap (mm)")}
                {numberField("gapY", "Vertical gap (mm)")}
                {numberField("padding", "Label padding (mm)", 0, 20)}
                {numberField("fontSize", "Text size (pt)", 4, 24)}
                <Col xs={12} md={8}>
                  <Form.Item name="fontFamily" label="Font">
                    <Select
                      options={[
                        { value: "sans", label: "Sans-serif (Arial)" },
                        { value: "serif", label: "Serif (Times)" },
                        { value: "mono", label: "Monospace (Courier)" },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={12} md={8}>
                  <Form.Item
                    name="bold"
                    label="Bold text"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                {numberField("barcodeHeight", "Barcode height (mm)", 4, 100)}
                {numberField("skip", "Skip used labels", 0, 1000, 1)}
                <Col xs={12} md={8}>
                  <Form.Item name="align" label="Text alignment">
                    <Select
                      options={["left", "center", "right"].map((value) => ({
                        value,
                        label: value,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={12} md={8}>
                  <Form.Item name="format" label="Barcode format">
                    <Select
                      options={[
                        "CODE128",
                        "CODE39",
                        "EAN13",
                        "EAN8",
                        "UPC",
                      ].map((value) => ({ value, label: value }))}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Divider>Label content</Divider>
              <Row gutter={16}>
                <Col xs={24} lg={12}>
                  <Form.Item
                    label="Shop Name"
                    name="ShopName"
                    extra="Shop name will be prefilled from your account"
                  >
                    <Input placeholder="Enter shop name (optional)" />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={12}>
                  <Form.Item
                    label="Select Branch"
                    name="selectedBranch"
                    extra="Choose a branch to auto-fill branch name and location"
                  >
                    <Select
                      showSearch
                      placeholder="Select a branch..."
                      optionFilterProp="children"
                      loading={loadingBranches}
                      allowClear
                      onSelect={handleBranchSelect}
                      onClear={() => {
                        form.setFieldsValue({
                          BranchName: "",
                          Location: "",
                        });
                      }}
                      filterOption={(input, option) =>
                        option?.children
                          ?.toString()
                          .toLowerCase()
                          .includes(input.toLowerCase()) ?? false
                      }
                    >
                      {branches.map((branch) => (
                        <Option key={branch.id} value={branch.id.toString()}>
                          {branch.name}
                          {branch.address && ` - ${branch.address}`}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} lg={12}>
                  <Form.Item
                    label="Branch Name"
                    name="BranchName"
                    extra="Leave empty to hide branch name on label"
                  >
                    <Input placeholder="Enter branch name (optional)" />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={12}>
                  <Form.Item
                    label="Location"
                    name="Location"
                    extra="Leave empty to hide location on label"
                  >
                    <Input placeholder="Enter location (optional)" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Row gutter={16}>
                <Col xs={24} lg={12}>
                  <Form.Item
                    label="Select Product"
                    name="selectedProduct"
                    extra="Choose from existing products or enter barcode manually"
                  >
                    <Select
                      showSearch
                      placeholder="Search and select a product..."
                      optionFilterProp="children"
                      loading={loadingProducts}
                      allowClear
                      onSelect={handleProductSelect}
                      onClear={() => {
                        form.resetFields([
                          "BarcodeValue",
                          "ProductName",
                          "Price",
                          "vatIncluded",
                          "vatPercentage",
                        ]);
                      }}
                      onSearch={setSearchTerm}
                      filterOption={(input, option) =>
                        option?.children
                          ?.toString()
                          .toLowerCase()
                          .includes(input.toLowerCase()) ?? false
                      }
                    >
                      {productOptions.map((product) => (
                        <Option key={product.id} value={product.id.toString()}>
                          {product.label}
                          {product.productCode
                            ? ` | Code: ${product.productCode}`
                            : ""}
                          {product.sku ? ` | SKU: ${product.sku}` : ""} |
                          Barcode: {product.barcode} | Price:{" "}
                          {formatCurrency(parseFloat(product.price.toString()))}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} lg={12}>
                  <Form.Item
                    label="Barcode Value"
                    name="BarcodeValue"
                    rules={[
                      { required: true, message: "Please enter barcode value" },
                      {
                        validator: (_, value) =>
                          barcodeIsValid(value || "", format)
                            ? Promise.resolve()
                            : Promise.reject(
                                new Error(
                                  "Invalid barcode or checksum for this format",
                                ),
                              ),
                      },
                    ]}
                  >
                    <Input placeholder="Enter barcode number (e.g., 1234567890123)" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} lg={12}>
                  <Form.Item
                    label="Product Name"
                    name="ProductName"
                    extra="Leave empty to hide product name on label"
                  >
                    <Input placeholder="Enter product name (optional)" />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={12}>
                  <Form.Item
                    label="Price"
                    name="Price"
                    extra="Leave empty to hide price on label"
                  >
                    <InputNumber
                      placeholder="0.00"
                      min={0}
                      step={0.01}
                      precision={2}
                      style={{ width: "100%" }}
                      prefix={takaPrefix}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={12} lg={6}>
                  <Form.Item
                    name="vatIncluded"
                    valuePropName="checked"
                    label="VAT Included"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={12} lg={6}>
                  <Form.Item label="VAT Percentage" name="vatPercentage">
                    <InputNumber
                      min={0}
                      max={100}
                      step={0.1}
                      style={{ width: "100%" }}
                      suffix="%"
                    />
                  </Form.Item>
                </Col>
                <Col xs={12} lg={6}>
                  <Form.Item
                    label="Quantity"
                    name="quantity"
                    rules={[
                      { required: true, message: "Please enter quantity" },
                    ]}
                  >
                    <InputNumber
                      min={1}
                      max={1000}
                      precision={0}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={12} lg={6}>
                  <Form.Item
                    name="PrintBarcodeOnly"
                    valuePropName="checked"
                    label="Print Barcode Only"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Space wrap style={{ marginBottom: 16 }}>
                {[
                  ["showShop", "Shop"],
                  ["showBranch", "Branch"],
                  ["showLocation", "Location"],
                  ["showProduct", "Product"],
                  ["showPrice", "Price / VAT"],
                  ["showValue", "Barcode text"],
                ].map(([name, label]) => (
                  <Form.Item
                    key={name}
                    name={name}
                    valuePropName="checked"
                    label={label}
                  >
                    <Switch />
                  </Form.Item>
                ))}
              </Space>
              <Row justify="center">
                <Col>
                  <Space wrap>
                    <Button
                      type="default"
                      icon={<EyeOutlined />}
                      onClick={handlePreview}
                    >
                      Preview
                    </Button>
                    <Button
                      type="primary"
                      icon={<PrinterOutlined />}
                      loading={loading}
                      onClick={handlePrint}
                    >
                      Print Label
                    </Button>
                    <Button icon={<ClearOutlined />} onClick={handleClear}>
                      Clear
                    </Button>
                  </Space>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Live label preview" style={{ marginTop: 16 }}>
            {layoutError && <Alert type="error" message={layoutError} />}
            <Typography.Paragraph>
              {geometry
                ? `${layout.labelWidth} × ${layout.labelHeight} mm · ${geometry.pages} page(s) · ${layout.quantity} label(s)`
                : "Adjust the dimensions to fit your paper."}
            </Typography.Paragraph>
            <div style={{ overflowX: "auto", padding: 8, background: "#eee" }}>
              <style>{labelStyles(layoutError ? defaultLayout : layout)}</style>
              <div ref={labelRef} className="barcode-label">
                {!values.PrintBarcodeOnly && (
                  <>
                    {values.showShop && values.ShopName && (
                      <strong className="label-line">{values.ShopName}</strong>
                    )}
                    {values.showBranch && values.BranchName && (
                      <div className="label-line">{values.BranchName}</div>
                    )}
                    {values.showLocation && values.Location && (
                      <div className="label-line">{values.Location}</div>
                    )}
                  </>
                )}
                <div className="barcode-symbol">
                  {valid ? (
                    <Barcode
                      value={barcode}
                      format={format}
                      displayValue={false}
                      width={2}
                      height={80}
                      margin={0}
                      marginLeft={22}
                      marginRight={22}
                    />
                  ) : (
                    <span>Enter a valid barcode</span>
                  )}
                </div>
                {!values.PrintBarcodeOnly && (
                  <>
                    {values.showValue && (
                      <div className="label-line barcode-value">
                        {barcodeDisplayValue(barcode, format)}
                      </div>
                    )}
                    {values.showProduct && values.ProductName && (
                      <strong className="label-line">
                        {values.ProductName}
                      </strong>
                    )}
                    {values.showPrice && values.Price != null && (
                      <div className="label-line">
                        {formatCurrency(Number(values.Price))}
                        {values.vatPercentage > 0
                          ? ` (${values.vatIncluded ? "inc." : "exc."} VAT ${values.vatPercentage}%)`
                          : ""}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
              Preview uses your selected dimensions. Hide fields or reduce text
              size if the content does not fit.
            </Typography.Paragraph>
          </Card>
        </Col>
      </Row>

      <Modal
        title="Barcode Label Preview"
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        width={960}
        footer={
          <Button type="primary" onClick={handlePrint}>
            Print Label
          </Button>
        }
      >
        <iframe
          title="Barcode page preview"
          srcDoc={previewHtml}
          onLoad={(event) => {
            const frame = event.currentTarget;
            const doc = frame.contentDocument;
            if (doc && geometry) {
              const scale = Math.min(
                1,
                (frame.clientWidth - 16) / ((geometry.width * 96) / 25.4),
              );
              const style = doc.createElement("style");
              style.textContent = `@media screen{.label-page{zoom:${scale}}}`;
              doc.head.appendChild(style);
            }
          }}
          style={{ width: "100%", height: 550, border: "1px solid #ddd" }}
        />
      </Modal>
    </div>
  );
};
export default BarcodePrinting;
