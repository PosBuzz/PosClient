import {
  Card,
  Input,
  Select,
  Checkbox,
  InputNumber,
  Button,
  Form,
  Divider,
  message,
  Alert,
  Tabs
} from "antd";
import TextArea from "antd/es/input/TextArea";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ProductFormValues, ProductType, TaxMethod } from "../../types/product.types";
import { productApi } from "../../api/product-api";

// Components
import VariantManager from "./VariantManager";
import BranchPricing from "./BranchPricing";
import PromoPriceForm from "./PromoPriceForm";
import SerialInput from "./SerialInput";
import ImageUploader from "./ImageUploader";
import CommonSelector from "./CommonSelector";
import dayjs from "dayjs";

const { Option } = Select;

export default function ProductForm() { 
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("1");
  const queryClient = useQueryClient();

  // Fetch product data if in edit mode
  const { data: productData, isLoading: isLoadingProduct } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productApi.getProduct(Number(id)),
    enabled: isEditMode,
  });

  // Set form values when product data is loaded in edit mode
  useEffect(() => {
    if (isEditMode && productData) {
      // Format data for the form
      const formData = {
        ...productData,
        // Handle promotional pricing
        promo_enabled: Boolean(productData.promotional_price),
        promotional_price: productData.promotional_price ? {
          price: productData.promotional_price.price
        } : undefined,
        promo_date_range: productData.promotional_price ? [
          dayjs(productData.promotional_price.starts_at),
          productData.promotional_price.ends_at ? dayjs(productData.promotional_price.ends_at) : null
        ] : undefined,
      };
      
      form.setFieldsValue(formData);
    }
  }, [form, isEditMode, productData]);

  // Create product mutation
  const createProduct = useMutation({
    mutationFn: productApi.createProduct,
    onSuccess: (data) => {
      message.success('Product created successfully!');
      queryClient.invalidateQueries({ queryKey: ["products"] });
      form.resetFields();
      navigate('/products');
    },
    onError: (error: any) => {
      message.error(`Failed to create product: ${error?.message || 'Unknown error'}`);
    }
  });

  // Update product mutation
  const updateProduct = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ProductFormValues> }) => 
      productApi.updateProduct(id, data),
    onSuccess: (data) => {
      message.success('Product updated successfully!');
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      navigate('/products');
    },
    onError: (error: any) => {
      message.error(`Failed to update product: ${error?.message || 'Unknown error'}`);
    }
  });

  const onFinish = (values: any) => {
    // Process form values to match backend DTO structure
    const promotional_price = values.promo_enabled ? {
      price: values.promotional_price?.price,
      starts_at: values.promo_date_range?.[0],
      ends_at: values.promo_date_range?.[1],
    } : undefined;

    // Format variants to match backend
    const variants = values.variants?.map((variant: any) => ({
      option: variant.option,
      value: variant.value,
      item_code: variant.item_code,
      cost: variant.cost,
      price: variant.price,
    }));

    // Prepare data for API
    const productData: ProductFormValues = {
      ...values,
      featured: values.featured || false,
      in_stock: values.in_stock || true,
      sell_online: values.sell_online || false,
      variants,
      promotional_price,
      // Remove fields that aren't in the backend DTO
      promo_enabled: undefined,
      promo_date_range: undefined,
    };

    if (isEditMode) {
      updateProduct.mutate({
        id: Number(id),
        data: productData
      });
    } else {
      createProduct.mutate(productData);
    }
  };

  const isSubmitting = createProduct.isPending || updateProduct.isPending;

  return (
    <div className="max-w-6xl mx-auto">
      <Card 
        title={isEditMode ? "Edit Product" : "Add New Product"} 
        className="shadow-md my-6"
        extra={
          <div className="space-x-2">
            <Button onClick={() => navigate('/products')}>Cancel</Button>
            <Button 
              type="primary" 
              loading={isSubmitting}
              onClick={() => form.submit()}
            >
              {isEditMode ? "Update Product" : "Save Product"}
            </Button>
          </div>
        }
      >
        {isEditMode && isLoadingProduct ? (
          <div className="py-8 text-center">Loading product data...</div>
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
          >
            <Tabs 
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: '1',
                  label: 'Basic Info',
                  children: (
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2">
                          <Form.Item
                            name="name"
                            label="Product Name"
                            rules={[{ required: true, message: 'Please enter product name' }]}
                          >
                            <Input placeholder="Enter product name" />
                          </Form.Item>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Form.Item
                              name="code"
                              label="Product Code/SKU"
                              rules={[{ required: true, message: 'Please enter product code' }]}
                            >
                              <Input placeholder="Enter unique product code" />
                            </Form.Item>
                            
                            <Form.Item
                              name="type"
                              label="Product Type"
                              rules={[{ required: true }]}
                            >
                              <Select placeholder="Select Type">
                                <Option value={ProductType.STANDARD}>Standard</Option>
                                <Option value={ProductType.DIGITAL}>Digital</Option>
                                <Option value={ProductType.SERVICE}>Service</Option>
                              </Select>
                            </Form.Item>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Form.Item
                              name="category_id"
                              label="Category"
                              rules={[{ required: true, message: 'Please select a category' }]}
                            >
                              <CommonSelector type="category" />
                            </Form.Item>
                            
                            <Form.Item 
                              name="brand_id" 
                              label="Brand"
                              rules={[{ required: true, message: 'Please select a brand' }]}
                            >
                              <CommonSelector type="brand" />
                            </Form.Item>
                          </div>
                        </div>
                        
                        <div className="col-span-1">
                          <Form.Item 
                            name="image_url" 
                            label="Product Image"
                          >
                            <ImageUploader />
                          </Form.Item>
                          
                          <Form.Item 
                            name="tags" 
                            label="Tags"
                          >
                            <CommonSelector type="tag" mode="multiple" />
                          </Form.Item>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <Form.Item
                          name="product_unit_id"
                          label="Product Unit"
                          rules={[{ required: true, message: 'Please select product unit' }]}
                        >
                          <CommonSelector type="unit" />
                        </Form.Item>
                        
                        <Form.Item 
                          name="purchase_unit_id" 
                          label="Purchase Unit"
                        >
                          <CommonSelector type="unit" />
                        </Form.Item>
                        
                        <Form.Item 
                          name="sale_unit_id" 
                          label="Sale Unit"
                        >
                          <CommonSelector type="unit" />
                        </Form.Item>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <Form.Item
                          name="cost"
                          label="Cost Price"
                          rules={[{ required: true, message: 'Please enter cost price' }]}
                        >
                          <InputNumber 
                            className="w-full" 
                            min={0} 
                            placeholder="Product cost"
                            formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                          />
                        </Form.Item>
                        
                        <Form.Item
                          name="price"
                          label="Selling Price"
                          rules={[{ required: true, message: 'Please enter selling price' }]}
                        >
                          <InputNumber 
                            className="w-full" 
                            min={0}
                            placeholder="Regular selling price"
                            formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                          />
                        </Form.Item>
                        
                        <Form.Item 
                          name="wholesale_price" 
                          label="Wholesale Price"
                        >
                          <InputNumber 
                            className="w-full" 
                            min={0}
                            placeholder="Optional wholesale price"
                            formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                          />
                        </Form.Item>
                      </div>
                      
                      <Form.Item name="description" label="Product Description">
                        <TextArea rows={4} placeholder="Enter detailed product description" />
                      </Form.Item>
                    </div>
                  ),
                },
                {
                  key: '2',
                  label: 'Inventory & Settings',
                  children: (
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Form.Item name="daily_sale_objective" label="Daily Sales Target">
                          <InputNumber className="w-full" min={0} placeholder="Optional target" />
                        </Form.Item>
                        
                        <Form.Item name="alert_quantity" label="Low Stock Alert">
                          <InputNumber className="w-full" min={0} placeholder="Alert quantity" />
                        </Form.Item>
                        
                        <Form.Item name="product_tax" label="Product Tax">
                          <Input placeholder="Tax % or fixed amount" />
                        </Form.Item>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Form.Item name="tax_method" label="Tax Method">
                          <Select allowClear placeholder="Select tax method">
                            <Option value={TaxMethod.EXCLUSIVE}>Exclusive</Option>
                            <Option value={TaxMethod.INCLUSIVE}>Inclusive</Option>
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
                  key: '3',
                  label: 'Variants & Branch Pricing',
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
                  key: '4',
                  label: 'Additional Options',
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
            
            <div className="flex justify-end mt-6 space-x-2">
              <Button onClick={() => navigate('/products')}>
                Cancel
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={isSubmitting}
              >
                {isEditMode ? "Update Product" : "Save Product"}
              </Button>
            </div>
          </Form>
        )}
      </Card>
    </div>
  );
}
