import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Form, Spin, Tabs } from "antd";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { productApi } from "../../api/product-api";
import { useMessageStore } from "../../stores/messageStore";
import {
  ProductFormData,
  ProductVariant,
  TaxMethod,
} from "../../types/product.types";
import BasicInformationTab from "./BasicInformationTab";
import VariantsTab from "./VariantsTab";
import PageTitle from "../../components/PageTitle";
import CenterLoader from "../../components/CenterLoader";

export default function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const [form] = Form.useForm<ProductFormData>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("basic");
  const queryClient = useQueryClient();
  const { messageApi } = useMessageStore();
  const [isInitialized, setIsInitialized] = useState(false);

  // Central state with proper typing
  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    code: "",
    description: "",
    category_id: undefined,
    brand_id: undefined,
    tag_ids: [],
    has_variants: false,
    tax_method: TaxMethod.EXCLUSIVE,
    tax: 0,
    variants: [],
  });

  // Fetch product data if in edit mode
  const { data: productData, isLoading: isLoadingProduct } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productApi.getProduct(Number(id!)),
    enabled: isEditMode,
    staleTime: 60 * 1000,
  });

  // Initialize form data
  useEffect(() => {
    if (productData && isEditMode && !isInitialized) {
      const newFormData: ProductFormData = {
        name: productData.name || "",
        code: productData.code || "",
        description: productData.description || "",
        category_id: productData.category_id,
        brand_id: productData.brand_id,
        tag_ids: productData.tags?.map((tag: any) => tag.tag.id) || [],
        has_variants: productData.has_variants || false,
        tax_method:
          (productData.tax_method as TaxMethod) || TaxMethod.EXCLUSIVE,
        tax: Number(productData.tax) || 0,
        variants:
          productData.variants?.map((variant: any) => ({
            id: variant.id,
            name: variant.name,
            sku: variant.sku || "",
            barcode: variant.barcode || "",
            cost_price: variant.cost_price
              ? parseFloat(variant.cost_price)
              : null,
            regular_price: variant.regular_price
              ? parseFloat(variant.regular_price)
              : null,
            wholesale_price: variant.wholesale_price
              ? parseFloat(variant.wholesale_price)
              : null,
            sale_unit_id: variant.sale_unit_id,
            purchase_unit_id: variant.purchase_unit_id,
            warranty_period: variant.warranty_period,
            image: variant.image || "",
            is_default: variant.is_default,
            attributes:
              variant.VariantAttribute?.map((attr: any) => ({
                id: attr.id,
                name: attr.name,
                value: attr.value,
              })) || [],
          })) || [],
      };

      // Ensure at least one variant exists even for edit mode
      if (newFormData.variants.length === 0) {
        newFormData.variants = [
          {
            name: newFormData.has_variants
              ? "Variant 1"
              : newFormData.name || "Default",
            is_default: true,
            cost_price: null,
            regular_price: null,
            wholesale_price: null,
            sale_unit_id: null,
            purchase_unit_id: null,
            sku: "",
            barcode: "",
            warranty_period: null,
            image: "",
            attributes: [],
          },
        ];
      }

      setFormData(newFormData);
      form.setFieldsValue(newFormData);
      setIsInitialized(true);
    } else if (
      !isEditMode &&
      formData.variants.length === 0 &&
      !isInitialized
    ) {
      // Initialize with default variant for new products
      const defaultVariant: ProductVariant = {
        name: "Default",
        is_default: true,
        cost_price: null,
        regular_price: null,
        wholesale_price: null,
        sale_unit_id: null,
        purchase_unit_id: null,
        sku: "",
        barcode: "",
        warranty_period: null,
        image: "",
        attributes: [],
      };

      const newFormData = { ...formData, variants: [defaultVariant] };
      setFormData(newFormData);
      setIsInitialized(true);
    }
  }, [productData, isEditMode, form, isInitialized, formData]);

  // Optimized field update handler
  const updateFormField = useCallback(
    <K extends keyof ProductFormData>(field: K, value: ProductFormData[K]) => {
      setFormData((prev) => {
        if (prev[field] === value) return prev;
        const newData = { ...prev, [field]: value };
        return newData;
      });
    },
    []
  );

  // Sync form values when formData changes
  useEffect(() => {
    if (isInitialized) {
      form.setFieldsValue(formData);
    }
  }, [formData, form, isInitialized]);

  // Variant management handlers with proper numbering
  const updateVariant = useCallback(
    (index: number, variantData: Partial<ProductVariant>) => {
      setFormData((prev) => {
        const newVariants = [...prev.variants];
        if (newVariants[index]) {
          newVariants[index] = { ...newVariants[index], ...variantData };
          return { ...prev, variants: newVariants };
        }
        return prev;
      });
    },
    []
  );

  const addVariant = useCallback(() => {
    setFormData((prev) => {
      const newVariant: ProductVariant = {
        name: `Variant ${prev.variants.length + 1}`,
        cost_price: null,
        regular_price: null,
        wholesale_price: null,
        sale_unit_id: null,
        purchase_unit_id: null,
        sku: "",
        barcode: "",
        warranty_period: null,
        image: "",
        attributes: [],
      };

      const newVariants = [...prev.variants, newVariant];
      return { ...prev, variants: newVariants };
    });

    return formData.variants.length;
  }, [formData.variants.length]);

  const deleteVariant = useCallback((index: number) => {
    setFormData((prev) => {
      if (prev.variants.length <= 1) return prev;

      // Remove the variant at the specified index
      const newVariants = prev.variants.filter((_, i) => i !== index);

      // Renumber the remaining variants to maintain sequential numbering
      const renumberedVariants = newVariants.map((variant, i) => ({
        ...variant,
        name: prev.has_variants ? `Variant ${i + 1}` : variant.name,
      }));

      return { ...prev, variants: renumberedVariants };
    });
  }, []);

  const handleVariantToggle = useCallback((checked: boolean) => {
    setFormData((prev) => {
      let newVariants = [...prev.variants];

      if (!checked && newVariants.length > 1) {
        // When switching to simple product, keep only the first variant and rename it to match product name
        newVariants = [
          {
            ...newVariants[0],
            name: prev.name || "Default",
            is_default: true,
          },
        ];
      } else if (checked && newVariants.length === 0) {
        // If no variants exist, create first variant
        newVariants = [
          {
            name: "Variant 1",
            is_default: true,
            cost_price: null,
            regular_price: null,
            wholesale_price: null,
            sale_unit_id: null,
            purchase_unit_id: null,
            sku: "",
            barcode: "",
            warranty_period: null,
            image: "",
            attributes: [],
          },
        ];
      } else if (checked) {
        // Renumber existing variants when switching to variant mode
        newVariants = newVariants.map((variant, index) => ({
          ...variant,
          name: `Variant ${index + 1}`,
          is_default: index === 0, // Only first variant is default
        }));
      } else {
        // For simple product, ensure we have exactly one variant that matches the product name
        if (newVariants.length === 0) {
          newVariants = [
            {
              name: prev.name || "Default",
              is_default: true,
              cost_price: null,
              regular_price: null,
              wholesale_price: null,
              sale_unit_id: null,
              purchase_unit_id: null,
              sku: "",
              barcode: "",
              warranty_period: null,
              image: "",
              attributes: [],
            },
          ];
        } else {
          // Update the first (and only) variant's name to match product name
          newVariants[0] = {
            ...newVariants[0],
            name: prev.name || "Default",
            is_default: true,
          };
        }
      }

      return {
        ...prev,
        has_variants: checked,
        variants: newVariants,
      };
    });
  }, []);

  // Update variant name when product name changes for simple products
  useEffect(() => {
    if (
      !formData.has_variants &&
      formData.variants.length > 0 &&
      formData.name
    ) {
      setFormData((prev) => ({
        ...prev,
        variants: [
          {
            ...prev.variants[0],
            name: prev.name,
            is_default: true,
          },
        ],
      }));
    }
  }, [formData.name, formData.has_variants]);

  // Save mutation with proper payload formatting
  const saveProductMutation = useMutation({
    mutationFn: async (values: ProductFormData) => {
      console.log("Form data before submission:", values);

      // Ensure we always have at least one variant (required by backend)
      let variants = values.variants || [];

      if (variants.length === 0) {
        // Create a default variant if none exists (this shouldn't happen with our logic, but just in case)
        const defaultVariant: ProductVariant = {
          name: values.has_variants ? "Variant 1" : values.name || "Default",
          sku: "",
          barcode: "",
          cost_price: null,
          regular_price: null,
          wholesale_price: null,
          sale_unit_id: null,
          purchase_unit_id: null,
          warranty_period: null,
          image: "",
          is_default: true,
          attributes: [],
        };
        variants = [defaultVariant];

        messageApi?.error(
          "Please fill in all required variant fields before submitting"
        );
        return Promise.reject(new Error("Missing variant data"));
      }

      const submitData = {
        name: values.name,
        code: values.code || undefined,
        description: values.description || undefined,
        category_id: values.category_id || undefined,
        brand_id: values.brand_id || undefined,
        tag_ids: values.tag_ids || [],
        has_variants: values.has_variants,
        tax_method: values.tax_method,
        tax: values.tax,
        variants: variants.map((variant, index) => ({
          ...(variant.id && { id: variant.id }), // Include ID only for existing variants
          name: variant.name,
          sku: variant.sku || undefined,
          barcode: variant.barcode || undefined,
          cost_price: variant.cost_price || "0.00",
          regular_price: variant.regular_price?.toString() || "0.00",
          wholesale_price: variant.wholesale_price?.toString() || undefined,
          sale_unit_id: variant.sale_unit_id,
          purchase_unit_id: variant.purchase_unit_id,
          warranty_period: variant.warranty_period || undefined,
          image: variant.image || undefined,
          is_default: !values.has_variants || index === 0, // For simple products, always default. For variants, only first is default
          attributes: (variant.attributes || [])
            .filter((attr) => attr.name && attr.value)
            .map((attr) => ({
              name: attr.name,
              value: attr.value,
            })),
        })),
      };

      console.log("Submit data with variants:", submitData);

      return isEditMode
        ? productApi.updateProduct(Number(id), submitData)
        : productApi.createProduct(submitData);
    },
    onSuccess: (data) => {
      messageApi?.success(
        `Product ${isEditMode ? "updated" : "created"} successfully`
      );
      queryClient.invalidateQueries({ queryKey: ["products"] });

      if (!isEditMode) {
        navigate(`/products/${data.id}/edit`);
      }
    },
    onError: (error: any) => {
      console.error("Save error:", error);
      messageApi?.error(
        `Failed to ${isEditMode ? "update" : "create"} product: ${
          error.response?.data?.message || error.message || "Unknown error"
        }`
      );
    },
  });

  // Form submission with proper validation
  const handleSubmit = useCallback(
    async (values: ProductFormData) => {
      console.log("Handle submit called with:", values);

      if (!values.name?.trim()) {
        messageApi?.error("Product name is required");
        return;
      }

      // Ensure we have the latest formData with variants
      const currentFormData = { ...formData };

      // Check if variants exist and have length
      if (!currentFormData.variants || currentFormData.variants.length === 0) {
        messageApi?.error("At least one variant is required");
        return;
      }

      // Validate required fields for each variant
      for (let i = 0; i < currentFormData.variants.length; i++) {
        const variant = currentFormData.variants[i];
        if (
          !variant.cost_price ||
          !variant.regular_price ||
          !variant.sale_unit_id ||
          !variant.purchase_unit_id
        ) {
          const variantLabel = currentFormData.has_variants
            ? `Variant ${i + 1}`
            : "Product";
          messageApi?.error(
            `${variantLabel} is missing required fields (cost price, regular price, sale unit, purchase unit)`
          );
          return;
        }
      }

      // Use formData instead of form values to ensure we have the latest state
      await saveProductMutation.mutateAsync(currentFormData);
    },
    [saveProductMutation, messageApi, formData]
  );

  // Memoized tab items
  const tabItems = useMemo(
    () => [
      {
        key: "basic",
        label: "Basic Information",
        children: (
          <BasicInformationTab
            formData={formData}
            updateFormField={updateFormField}
            onDescriptionGenerated={(description) =>
              updateFormField("description", description)
            }
            onVariantToggle={handleVariantToggle}
          />
        ),
      },
      {
        key: "variants",
        label: formData.has_variants ? "Variants" : "Product Details",
        children: (
          <VariantsTab
            formData={formData}
            updateVariant={updateVariant}
            addVariant={addVariant}
            deleteVariant={deleteVariant}
          />
        ),
      },
    ],
    [
      formData,
      updateFormField,
      handleVariantToggle,
      updateVariant,
      addVariant,
      deleteVariant,
    ]
  );

  if (isLoadingProduct) {
    return <CenterLoader />;
  }

  return (
    <>
      <PageTitle
        title={isEditMode ? "Edit Product" : "Add New Product"}
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Products", href: "/products" },
          { title: isEditMode ? "Edit Product" : "Add New Product" },
        ]}
        rightSection={
          <Button
            type="primary"
            loading={saveProductMutation.isPending}
            onClick={() => form.submit()}
          >
            {isEditMode ? "Update Product" : "Save Product"}
          </Button>
        }
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={formData}
      >
        <Card className="shadow-sm">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
          />
        </Card>
      </Form>
    </>
  );
}
