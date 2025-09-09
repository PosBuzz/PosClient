import { PrinterOutlined, EyeOutlined, ClearOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Switch,
  message,
  Space,
  Divider,
  Select,
  Modal,
} from "antd";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Barcode from "react-barcode";
import PageTitle from "../../components/PageTitle";
import { setPageTitle } from "../../utils/setPageTitle";
import { productApi } from "../../api/product-api";
import { queryKeys } from "../../constants/queryKeys";
import { Product, ProductVariantDetailed } from "../../types/product.types";

const { Option } = Select;

interface BarcodePrintData {
  BarcodeValue: string;
  ProductName?: string;
  Price?: string;
  PrintBarcodeOnly: boolean;
  VatIncluded?: boolean;
  VatPercentage?: number;
  Quantity: number;
}

interface ProductOption {
  id: number;
  label: string;
  barcode: string;
  price: number;
  productName: string;
  variantName: string;
  taxMethod: string;
  taxPercentage: number;
}

const BarcodePrinting = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<BarcodePrintData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [previewModalVisible, setPreviewModalVisible] = useState(false);

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
      data.data.forEach((product: Product) => {
        product.variants?.forEach((variant: ProductVariantDetailed) => {
          if (variant.barcode) {
            options.push({
              id: variant.id || 0,
              label: `${product.name} - ${variant.name}`,
              barcode: variant.barcode,
              price: Number(variant.regular_price) || 0,
              productName: product.name,
              variantName: variant.name,
              taxMethod: product.tax_method || "INCLUSIVE",
              taxPercentage: product.tax || 21.0,
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

  useEffect(() => {
    setPageTitle("Barcode Printing");
  }, []);

  const handlePreview = () => {
    const values = form.getFieldsValue();

    const printData: BarcodePrintData = {
      BarcodeValue: values.BarcodeValue || "",
      Quantity: values.Quantity || 1,
      PrintBarcodeOnly: values.PrintBarcodeOnly || false,
    };

    // Only include optional fields if not printing barcode only
    if (!printData.PrintBarcodeOnly) {
      if (values.ProductName?.trim()) {
        printData.ProductName = values.ProductName.trim();
      }
      if (values.Price && values.Price > 0) {
        printData.Price = values.Price.toFixed(2);
      }
      // Only include VAT if percentage is not 0 or empty
      if (
        values.vatPercentage &&
        values.vatPercentage > 0 &&
        values.Price &&
        values.Price > 0
      ) {
        printData.VatIncluded = values.vatIncluded === true; // Ensure boolean
        printData.VatPercentage = values.vatPercentage;
      }
    }

    console.log("Print data:", printData);
    setPreviewData(printData);
    setPreviewModalVisible(true);
  };

  const handlePrint = async () => {
    try {
      await form.validateFields();
      setLoading(true);

      const values = form.getFieldsValue();
      const printData: BarcodePrintData = {
        BarcodeValue: values.BarcodeValue,
        Quantity: values.Quantity || 1,
        PrintBarcodeOnly: values.PrintBarcodeOnly || false,
      };

      // Only include optional fields if not printing barcode only
      if (!printData.PrintBarcodeOnly) {
        if (values.ProductName?.trim()) {
          printData.ProductName = values.ProductName.trim();
        }
        if (values.Price && values.Price > 0) {
          printData.Price = values.Price.toString();
        }
        // Only include VAT if percentage is not 0 or empty
        if (
          values.vatPercentage &&
          values.vatPercentage > 0 &&
          values.Price &&
          values.Price > 0
        ) {
          printData.VatIncluded = values.vatIncluded === true; // Ensure boolean
          printData.VatPercentage = values.vatPercentage;
        }
      }

      console.log("Sending barcode print request:", printData);

      const response = await fetch(
        "http://localhost:8080/print-barcode-label",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(printData),
        }
      );

      if (response.ok) {
        message.success("Barcode label printed successfully!");
      } else {
        const errorText = await response.text();
        message.error("Failed to print barcode label: " + errorText);
      }
    } catch (error: any) {
      console.error("Print error:", error);
      if (error.message?.includes("fetch")) {
        message.error(
          "Printing agent is not running. Please start the printing agent and try again."
        );
      } else {
        message.error(
          "Failed to print barcode label. Please check your input."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    form.resetFields();
    setPreviewData(null);
    setPreviewModalVisible(false);
  };

  return (
    <div>
      <PageTitle
        title="Barcode Printing"
        breadcrumbs={[
          { title: "Home", href: "/" },
          { title: "Barcode Printing" },
        ]}
      />

      <Row gutter={24}>
        <Col xs={24} lg={18} xl={20}>
          <Card title="Label Configuration" size="small">
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                Quantity: 1,
                PrintBarcodeOnly: false,
                vatIncluded: true,
                vatPercentage: 21.0,
              }}
            >
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
                        form.resetFields();
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
                          {product.label} | Barcode: {product.barcode} | Price: $
                          {parseFloat(product.price.toString()).toFixed(2)}
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
                      prefix="$"
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
                  <Form.Item
                    label="VAT Percentage"
                    name="vatPercentage"
                  >
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
                    name="Quantity"
                    rules={[{ required: true, message: "Please enter quantity" }]}
                  >
                    <InputNumber min={1} max={100} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={12} lg={6}>
                  <Form.Item name="PrintBarcodeOnly" valuePropName="checked" label="Print Barcode Only">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Row justify="center">
                <Col>
                  <Space size="large">
                    <Button
                      type="default"
                      icon={<EyeOutlined />}
                      onClick={handlePreview}
                      size="large"
                    >
                      Preview
                    </Button>
                    <Button
                      type="primary"
                      icon={<PrinterOutlined />}
                      loading={loading}
                      onClick={handlePrint}
                      size="large"
                    >
                      Print Label
                    </Button>
                    <Button 
                      icon={<ClearOutlined />} 
                      onClick={handleClear}
                      size="large"
                    >
                      Clear
                    </Button>
                  </Space>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>
      </Row>

      {/* Preview Modal */}
      <Modal
        title="Barcode Label Preview"
        visible={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewModalVisible(false)}>
            Close
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
          >
            Print This Label
          </Button>,
        ]}
        width={400}
      >
        {previewData && (
          <div
            style={{
              border: "2px dashed #d9d9d9",
              padding: "24px",
              textAlign: "center",
              backgroundColor: "#ffffff",
              color: "#000000",
              fontFamily: "monospace",
              fontSize: "12px",
              lineHeight: "1.4",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* Barcode component */}
            <div
              style={{
                marginBottom: "0",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Barcode
                value={previewData.BarcodeValue}
                displayValue={!previewData.PrintBarcodeOnly}
                width={1.5}
                height={60}
                background="#ffffff"
                lineColor="#000000"
              />
            </div>

            {!previewData.PrintBarcodeOnly && previewData.ProductName && (
              <div
                style={{
                  marginBottom: "4px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  color: "#000000",
                }}
              >
                {previewData.ProductName}
              </div>
            )}

            {!previewData.PrintBarcodeOnly && previewData.Price && (
              <div
                style={{
                  marginBottom: "4px",
                  fontSize: "11px",
                  color: "#000000",
                }}
              >
                ${previewData.Price}
                {previewData.VatIncluded !== undefined && (
                  <span>
                    {" "}
                    ({previewData.VatIncluded ? "inc." : "exc."} VAT{" "}
                    {previewData.VatPercentage}%)
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BarcodePrinting;
