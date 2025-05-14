import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Select,
  Tabs
} from "antd";
import TextArea from "antd/es/input/TextArea";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { productApi } from "../../api/product-api";
import {
  ProductFormValues,
  ProductType,
  TaxMethod,
} from "../../types/product.types";

// Components
import dayjs from "dayjs";
import CenterLoader from "../../components/CenterLoader";
import ImageInput from "../../components/ImageInput";
import PageTitle from "../../components/PageTitle";
import { useMessageStore } from "../../stores/messageStore";
import { getImageUrlForCloudinaryImage } from "../../utils/upload";
import BranchPricing from "./BranchPricing";
import CommonSelector from "./CommonSelector";
import PromoPriceForm from "./PromoPriceForm";
import SerialInput from "./SerialInput";
import VariantManager from "./VariantManager";

const { Option } = Select;

export default function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("1");
  const queryClient = useQueryClient();
  const { messageApi } = useMessageStore();

  // Fetch product data if in edit mode without onSuccess
  const { data: productData, isLoading: isLoadingProduct } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productApi.getProduct(Number(id)),
    enabled: isEditMode,
  });

  // Use useEffect to populate the form when product data is available
  useEffect(() => {
    if (productData && isEditMode) {
      // Transform data for form consumption
      const formData = {
        ...productData,
        // Handle specific fields that need transformation

        // Product basics
        name: productData.name,
        code: productData.code,
        description: productData.description,
        image_url: [
          {
            uid: "-1",
            status: "done",
            thumbUrl: productData.image_url,
          },
        ],

        // Categories and relations
        category_id: productData.category_id,
        brand_id: productData.brand_id,
        product_unit_id: productData.product_unit_id,
        sale_unit_id: productData.sale_unit_id,
        purchase_unit_id: productData.purchase_unit_id,

        // Pricing
        cost: productData.cost,
        price: productData.price,
        wholesale_price: productData.wholesale_price,

        // Settings
        type: productData.type || ProductType.STANDARD,
        tax_method: productData.tax_method,
        product_tax: productData.product_tax,
        alert_quantity: productData.alert_quantity,
        daily_sale_objective: productData.daily_sale_objective,

        // Checkboxes
        featured: Boolean(productData.featured),
        sell_online: Boolean(productData.sell_online),
        in_stock: productData.in_stock !== false, // default to true if undefined

        // Handle arrays
        tags: productData.tags ? productData.tags.map((tag) => tag.id) : [],
        variants: productData.variants || [],
        branch_prices: productData.branch_prices || [],
        serials: productData.serial_numbers
          ? productData.serial_numbers.map((s) => s.serial)
          : [],

        // Handle promotional pricing
        promo_enabled: productData.promo_enabled,
        promotional_price: productData.promotional_price
          ? {
              price: productData.promotional_price.price,
            }
          : undefined,
        promo_date_range: productData.promotional_price
          ? [
              dayjs(productData.promotional_price.starts_at),
              productData.promotional_price.ends_at
                ? dayjs(productData.promotional_price.ends_at)
                : null,
            ]
          : undefined,
      };

      form.setFieldsValue(formData);
    }
  }, [productData, isEditMode, form]);

  // Create product mutation
  const createProduct = useMutation({
    mutationFn: productApi.createProduct,
    onSuccess: () => {
      messageApi?.success("Product created successfully!");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      form.resetFields();
      navigate("/products");
    },
    onError: (error: any) => {
      messageApi?.error(
        `Failed to create product: ${error?.message || "Unknown error"}`
      );
    },
  });

  // Update product mutation
  const updateProduct = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<ProductFormValues>;
    }) => productApi.updateProduct(id, data),
    onSuccess: () => {
      messageApi?.success("Product updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      navigate("/products");
    },
    onError: (error: any) => {
      messageApi?.error(
        `Failed to update product: ${error?.message || "Unknown error"}`
      );
    },
  });

  // Ensure all component data is captured before submission
  const onFinish = (values: any) => {
    // Force validation of all fields, even in hidden tabs
    form.validateFields().then((formValues) => {
      // Process form values to match backend DTO structure
      const promotional_price = formValues.promo_enabled
        ? {
            price: formValues.promotional_price?.price,
            starts_at: formValues.promo_date_range?.[0].toISOString(),
            ends_at: formValues.promo_date_range?.[1]?.toISOString(),
          }
        : undefined;

      // Get image URL from the upload component
      const image_url = getImageUrlForCloudinaryImage(formValues, "image_url");

      // Format variants to match backend
      const variants = formValues.variants?.map((variant: any) => ({
        ...(variant.id ? { id: variant.id } : {}), // Include ID if it exists (for updates)
        option: variant.option,
        value: variant.value,
        item_code: variant.item_code,
        cost: variant.cost,
        price: variant.price,
      }));

      // Format branch prices
      const branch_prices = formValues.branch_prices?.map((bp: any) => ({
        ...(bp.id ? { id: bp.id } : {}), // Include ID if it exists (for updates)
        branch_id: bp.branch_id,
        price: bp.price,
      }));

      // Format serials if they exist
      const serials = formValues.serials || [];

      // Prepare data for API
      const productData: ProductFormValues = {
        ...formValues,
        image_url, // Use the extracted image URL
        featured: formValues.featured || false,
        in_stock: formValues.in_stock !== false,
        sell_online: formValues.sell_online || false,
        variants,
        branch_prices,
        serials,
        promotional_price,

        // remove it
        promo_date_range: undefined,
      };

      if (isEditMode && id) {
        updateProduct.mutate({
          id: Number(id),
          data: productData,
        });
      } else {
        createProduct.mutate(productData);
      }
    });
  };

  const isSubmitting = createProduct.isPending || updateProduct.isPending;

  // Function to handle tab change - ensure form data is preserved
  const handleTabChange = (activeKey: string) => {
    // Save current form values to preserve data across tab changes
    const currentValues = form.getFieldsValue(true);
    form.setFieldsValue(currentValues);
    setActiveTab(activeKey);
  };

  const title = isEditMode ? "Edit Product" : "Add Product";

  return (
    <>
      <PageTitle
        title={title}
        breadcrumbs={[
          {
            title: "Dashboard",
            href: "/",
          },
          {
            title: "Products",
            href: "/products",
          },
          {
            title: title,
          },
        ]}
        rightSection={
          <Button
            type="primary"
            loading={isSubmitting}
            onClick={() => form.submit()}
          >
            {isEditMode ? "Update Product" : "Save Product"}
          </Button>
        }
      />
      <Card className="shadow-md my-6">
        {isEditMode && isLoadingProduct ? (
          <CenterLoader />
        ) : (
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            className="px-1"
            initialValues={{
              type: "STANDARD",
              in_stock: true,
            }}
            // This is crucial - preserve values when fields unmount
            preserve={true}
          >
            <Tabs
              activeKey={activeTab}
              onChange={handleTabChange}
              items={[
                {
                  key: "1",
                  label: "Basic Info",
                  children: (
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2">
                          <Form.Item
                            name="name"
                            label="Product Name"
                            rules={[
                              {
                                required: true,
                                message: "Please enter product name",
                              },
                            ]}
                          >
                            <Input placeholder="Enter product name" />
                          </Form.Item>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Form.Item
                              name="code"
                              label="Product Code/SKU"
                              rules={[
                                {
                                  required: true,
                                  message: "Please enter product code",
                                },
                              ]}
                            >
                              <Input placeholder="Enter unique product code" />
                            </Form.Item>

                            <Form.Item
                              name="type"
                              label="Product Type"
                              rules={[{ required: true }]}
                            >
                              <Select placeholder="Select Type">
                                <Option value={ProductType.STANDARD}>
                                  Standard
                                </Option>
                                <Option value={ProductType.DIGITAL}>
                                  Digital
                                </Option>
                                <Option value={ProductType.SERVICE}>
                                  Service
                                </Option>
                              </Select>
                            </Form.Item>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Form.Item
                              name="category_id"
                              label="Category"
                              rules={[
                                {
                                  required: true,
                                  message: "Please select a category",
                                },
                              ]}
                            >
                              <CommonSelector type="category" />
                            </Form.Item>

                            <Form.Item
                              name="brand_id"
                              label="Brand"
                              rules={[
                                {
                                  required: true,
                                  message: "Please select a brand",
                                },
                              ]}
                            >
                              <CommonSelector type="brand" />
                            </Form.Item>
                          </div>
                        </div>

                        <div className="col-span-1 flex flex-col justify-between">
                          <ImageInput name="image_url" label="Product Image" />

                          <Form.Item name="tags" label="Tags">
                            <CommonSelector type="tag" mode="multiple" />
                          </Form.Item>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <Form.Item
                          name="product_unit_id"
                          label="Product Unit"
                          rules={[
                            {
                              required: true,
                              message: "Please select product unit",
                            },
                          ]}
                        >
                          <CommonSelector type="unit" />
                        </Form.Item>

                        <Form.Item
                          name="purchase_unit_id"
                          label="Purchase Unit"
                        >
                          <CommonSelector type="unit" />
                        </Form.Item>

                        <Form.Item name="sale_unit_id" label="Sale Unit">
                          <CommonSelector type="unit" />
                        </Form.Item>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <Form.Item
                          name="cost"
                          label="Cost Price"
                          rules={[
                            {
                              required: true,
                              message: "Please enter cost price",
                            },
                          ]}
                        >
                          <InputNumber
                            className="w-full!"
                            min={0}
                            placeholder="Product cost"
                            formatter={(value) =>
                              `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                            }
                            parser={(value) =>
                              value!.replace(/\$\s?|(,*)/g, "")
                            }
                          />
                        </Form.Item>

                        <Form.Item
                          name="price"
                          label="Selling Price"
                          rules={[
                            {
                              required: true,
                              message: "Please enter selling price",
                            },
                          ]}
                        >
                          <InputNumber
                            className="w-full!"
                            min={0}
                            placeholder="Regular selling price"
                            formatter={(value) =>
                              `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                            }
                            parser={(value) =>
                              value!.replace(/\$\s?|(,*)/g, "")
                            }
                          />
                        </Form.Item>

                        <Form.Item
                          name="wholesale_price"
                          label="Wholesale Price"
                        >
                          <InputNumber
                            className="w-full!"
                            min={0}
                            placeholder="Optional wholesale price"
                            formatter={(value) =>
                              `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                            }
                            parser={(value) =>
                              value!.replace(/\$\s?|(,*)/g, "")
                            }
                          />
                        </Form.Item>
                      </div>

                      <Form.Item name="description" label="Product Description">
                        <TextArea
                          rows={4}
                          placeholder="Enter detailed product description"
                        />
                      </Form.Item>
                    </div>
                  ),
                },
                {
                  key: "2",
                  label: "Inventory & Settings",
                  children: (
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Form.Item
                          name="daily_sale_objective"
                          label="Daily Sales Target"
                        >
                          <InputNumber
                            type="number"
                            className="w-full!"
                            min={0}
                            placeholder="Optional target"
                          />
                        </Form.Item>

                        <Form.Item
                          name="alert_quantity"
                          label="Low Stock Alert"
                        >
                          <InputNumber
                            className="w-full!"
                            min={0}
                            placeholder="Alert quantity"
                          />
                        </Form.Item>

                        <Form.Item name="product_tax" label="Product Tax">
                          <InputNumber
                            type="number"
                            className="w-full!"
                            min={0}
                            placeholder="Tax % or fixed amount"
                          />
                        </Form.Item>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Form.Item name="tax_method" label="Tax Method">
                          <Select allowClear placeholder="Select tax method">
                            <Option value={TaxMethod.EXCLUSIVE}>
                              Exclusive
                            </Option>
                            <Option value={TaxMethod.INCLUSIVE}>
                              Inclusive
                            </Option>
                          </Select>
                        </Form.Item>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                        <Form.Item name="featured" valuePropName="checked">
                          <Checkbox>Featured Product</Checkbox>
                        </Form.Item>

                        <Form.Item name="sell_online" valuePropName="checked">
                          <Checkbox>Sell Online</Checkbox>
                        </Form.Item>

                        <Form.Item name="in_stock" valuePropName="checked">
                          <Checkbox>In Stock</Checkbox>
                        </Form.Item>
                      </div>
                    </div>
                  ),
                },
                {
                  key: "3",
                  label: "Variants & Branch Pricing",
                  children: (
                    <div className="p-4">
                      <Card title="Product Variants" className="mb-6">
                        <VariantManager />
                      </Card>

                      <Card title="Branch-specific Pricing">
                        <BranchPricing />
                      </Card>
                    </div>
                  ),
                },
                {
                  key: "4",
                  label: "Additional Options",
                  children: (
                    <div className="p-4">
                      <Card title="Promotional Pricing" className="mb-6">
                        <PromoPriceForm />
                      </Card>

                      <Card title="Serial Numbers / IMEI">
                        <SerialInput />
                      </Card>
                    </div>
                  ),
                },
              ]}
            />
          </Form>
        )}
      </Card>
    </>
  );
}
