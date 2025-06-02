import { useState, useCallback } from 'react';
import { 
  ProductFormData, 
  ProductVariant, 
  TaxMethod,
  FormAttribute,
  FormSerial 
} from '../../../types/product.types';
import { BatchData } from '../../../components/BatchAddingForm';
import { useMessageStore } from '../../../stores/messageStore';

// Complete form state interface
export interface ProductFormState {
  // Basic Information
  name: string;
  code: string;
  description: string;
  category_id?: number;
  brand_id?: number;
  tag_ids: number[];
  has_variants: boolean;
  tax_method: TaxMethod;
  tax: number;
  daily_sale_objective: number;
  
  // Variants
  variants: Record<string, ProductVariant>;
}

// Validation state for each field
export interface ValidationState {
  [field: string]: {
    status: 'success' | 'warning' | 'error' | 'validating' | '';
    help: string;
  };
}

// Complex state management hook
export const useProductFormState = (initialData?: ProductFormData) => {
  const { messageApi } = useMessageStore();
  // Create default variant
  const createDefaultVariant = (): ProductVariant => ({
    name: "Default",
    is_default: true,
    regular_price: null,
    wholesale_price: null,
    sale_unit_id: undefined,
    purchase_unit_id: undefined,
    sku: "",
    barcode: "",
    warranty_period: undefined,
    image: "",
    alert_quantity: 0,
    attributes: [],
    serials: [],
    batches: [],
  });

  // Initialize form state
  const [formState, setFormState] = useState<ProductFormState>(() => {
    if (initialData) {
      return {
        name: initialData.name || "",
        code: initialData.code || "",
        description: initialData.description || "",
        category_id: initialData.category_id,
        brand_id: initialData.brand_id,
        tag_ids: initialData.tag_ids || [],
        has_variants: initialData.has_variants || false,
        tax_method: initialData.tax_method || TaxMethod.EXCLUSIVE,
        tax: initialData.tax || 0,
        daily_sale_objective: initialData.daily_sale_objective || 0,
        variants: initialData.variants?.reduce((acc, variant, index) => {
          acc[index.toString()] = variant;
          return acc;
        }, {} as Record<string, ProductVariant>) || { "0": createDefaultVariant() }
      };
    }
    
    return {
      name: "",
      code: "",
      description: "",
      category_id: undefined,
      brand_id: undefined,
      tag_ids: [],
      has_variants: false,
      tax_method: TaxMethod.EXCLUSIVE,
      tax: 0,
      daily_sale_objective: 0,
      variants: { "0": createDefaultVariant() }
    };
  });

  // Validation state
  const [validationState, setValidationState] = useState<ValidationState>({});
  
  // Loading states for async operations
  const [loadingStates, setLoadingStates] = useState({
    saving: false,
    validating: false,
    generating: false
  });
  // Field update function with validation
  const updateField = useCallback((field: string, value: any) => {
    setFormState(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation error when field is updated
    setValidationState(prev => ({
      ...prev,
      [field]: { status: '', help: '' }
    }));
  }, []);
  // Variant management functions
  const updateVariant = useCallback((variantId: string, updates: Partial<ProductVariant>) => {
    setFormState(prev => ({
      ...prev,
      variants: {
        ...prev.variants,
        [variantId]: {
          ...prev.variants[variantId],
          ...updates
        }
      }
    }));

    // Clear validation errors for updated variant fields
    setValidationState(prev => {
      const newState = { ...prev };
      Object.keys(updates).forEach(field => {
        const fieldKey = `variant_${variantId}_${field}`;
        if (newState[fieldKey]) {
          newState[fieldKey] = { status: '', help: '' };
        }
      });
      return newState;
    });
  }, []);

  const addVariant = useCallback(() => {
    const variantKeys = Object.keys(formState.variants);
    const newIndex = variantKeys.length;
    const newVariant: ProductVariant = {
      ...createDefaultVariant(),
      name: `Variant ${newIndex + 1}`,
      is_default: newIndex === 0
    };

    setFormState(prev => ({
      ...prev,
      variants: {
        ...prev.variants,
        [newIndex.toString()]: newVariant
      }
    }));

    messageApi?.success(`Variant ${newIndex + 1} added successfully`);
  }, [formState.variants]);

  const deleteVariant = useCallback((variantId: string) => {
    const variants = { ...formState.variants };
    delete variants[variantId];
    
    // Reindex remaining variants
    const reindexedVariants: Record<string, ProductVariant> = {};
    let newIndex = 0;
    
    Object.values(variants).forEach((variant) => {
      reindexedVariants[newIndex.toString()] = {
        ...variant,
        name: formState.has_variants ? `Variant ${newIndex + 1}` : variant.name,
        is_default: newIndex === 0
      };
      newIndex++;
    });

    setFormState(prev => ({
      ...prev,
      variants: reindexedVariants
    }));

    messageApi?.success('Variant deleted successfully');
  }, [formState.variants, formState.has_variants]);

  const duplicateVariant = useCallback((variantId: string) => {
    const sourceVariant = formState.variants[variantId];
    if (!sourceVariant) {
      messageApi?.error('Source variant not found');
      return;
    }

    const newIndex = Object.keys(formState.variants).length;
    const duplicatedVariant: ProductVariant = {
      ...sourceVariant,
      name: formState.has_variants ? `Variant ${newIndex + 1}` : `${sourceVariant.name} Copy`,
      is_default: false,
      sku: '', // Reset SKU to avoid duplicates
      barcode: '', // Reset barcode to avoid duplicates
      serials: [], // Reset serials array
      batches: [], // Reset batches array
    };

    setFormState(prev => ({
      ...prev,
      variants: {
        ...prev.variants,
        [newIndex.toString()]: duplicatedVariant
      }
    }));

    messageApi?.success('Variant duplicated successfully');
  }, [formState.variants, formState.has_variants]);

  // Variant attribute management
  const addVariantAttribute = useCallback((variantId: string, attribute: FormAttribute) => {
    updateVariant(variantId, {
      attributes: [...(formState.variants[variantId]?.attributes || []), attribute]
    });
  }, [formState.variants, updateVariant]);

  const updateVariantAttribute = useCallback((variantId: string, attributeIndex: number, updates: Partial<FormAttribute>) => {
    const variant = formState.variants[variantId];
    if (!variant) return;
    
    const updatedAttributes = [...variant.attributes];
    updatedAttributes[attributeIndex] = { ...updatedAttributes[attributeIndex], ...updates };
    
    updateVariant(variantId, { attributes: updatedAttributes });
  }, [formState.variants, updateVariant]);

  const deleteVariantAttribute = useCallback((variantId: string, attributeIndex: number) => {
    const variant = formState.variants[variantId];
    if (!variant) return;
    
    const updatedAttributes = variant.attributes.filter((_, index) => index !== attributeIndex);
    updateVariant(variantId, { attributes: updatedAttributes });
  }, [formState.variants, updateVariant]);

  // Variant serial management
  const addVariantSerial = useCallback((variantId: string, serial: FormSerial) => {
    updateVariant(variantId, {
      serials: [...(formState.variants[variantId]?.serials || []), serial]
    });
  }, [formState.variants, updateVariant]);
  const updateVariantSerial = useCallback((variantId: string, serialIndex: number, updates: Partial<FormSerial>) => {
    const variant = formState.variants[variantId];
    if (!variant || !variant.serials) return;
    
    const updatedSerials = [...variant.serials];
    updatedSerials[serialIndex] = { ...updatedSerials[serialIndex], ...updates };
    
    updateVariant(variantId, { serials: updatedSerials });
  }, [formState.variants, updateVariant]);
  const deleteVariantSerial = useCallback((variantId: string, serialIndex: number) => {
    const variant = formState.variants[variantId];
    if (!variant || !variant.serials) return;
    
    const updatedSerials = variant.serials.filter((_, index) => index !== serialIndex);
    updateVariant(variantId, { serials: updatedSerials });
  }, [formState.variants, updateVariant]);

  // Variant batches management
  const updateVariantBatches = useCallback((variantId: string, batches: BatchData[]) => {
    updateVariant(variantId, { batches });
  }, [updateVariant]);

  // Product type toggle (simple vs variants)
  const toggleProductType = useCallback((hasVariants: boolean) => {
    setFormState(prev => {
      const variants = { ...prev.variants };
      
      if (!hasVariants && Object.keys(variants).length > 1) {
        // Keep only first variant for simple product
        const firstVariant = variants["0"];
        return {
          ...prev,
          has_variants: false,
          variants: {
            "0": {
              ...firstVariant,
              name: prev.name || "Default",
              is_default: true
            }
          }
        };
      } else {
        // Update variant names for variant mode
        const updatedVariants: Record<string, ProductVariant> = {};
        Object.keys(variants).forEach((key, index) => {
          updatedVariants[key] = {
            ...variants[key],
            name: hasVariants ? `Variant ${index + 1}` : variants[key].name,
            is_default: index === 0
          };
        });
        
        return {
          ...prev,
          has_variants: hasVariants,
          variants: updatedVariants
        };
      }
    });
  }, []);

  // Auto-generation utilities
  const generateSKU = useCallback((variantId: string) => {
    const baseName = formState.name || "Product";
    const timestamp = Date.now().toString().slice(-6);
    const prefix = baseName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 3)
      .padEnd(3, "0");
    const sku = `${prefix}-SKU-${timestamp}`;
    
    updateVariant(variantId, { sku });
    messageApi?.success('SKU generated successfully');
  }, [formState.name, updateVariant]);
  const generateBarcode = useCallback((variantId: string) => {
    const countryCode = "123";
    const manufacturerCode = Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, "0");
    const productCode = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    const baseNumber = countryCode + manufacturerCode + productCode;

    // Calculate EAN-13 check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(baseNumber[i]);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const barcode = baseNumber + checkDigit;
    
    updateVariant(variantId, { barcode });
    messageApi?.success('Barcode generated successfully');
  }, [updateVariant]);

  // Comprehensive validation
  const validateForm = useCallback((): boolean => {
    const errors: ValidationState = {};
    let isValid = true;

    // Validate basic information
    if (!formState.name.trim()) {
      errors['name'] = { status: 'error', help: 'Product name is required' };
      isValid = false;
    } else if (formState.name.length < 2) {
      errors['name'] = { status: 'error', help: 'Name must be at least 2 characters' };
      isValid = false;
    } else if (formState.name.length > 100) {
      errors['name'] = { status: 'error', help: 'Name cannot exceed 100 characters' };
      isValid = false;
    }

    if (formState.code && formState.code.length > 50) {
      errors['code'] = { status: 'error', help: 'Code cannot exceed 50 characters' };
      isValid = false;
    }

    if (formState.description && formState.description.length > 500) {
      errors['description'] = { status: 'error', help: 'Description cannot exceed 500 characters' };
      isValid = false;
    }

    if (formState.tax < 0 || formState.tax > 100) {
      errors['tax'] = { status: 'error', help: 'Tax must be between 0 and 100' };
      isValid = false;
    }

    // Validate variants
    const variantKeys = Object.keys(formState.variants);
    if (variantKeys.length === 0) {
      errors['variants'] = { status: 'error', help: 'At least one variant is required' };
      isValid = false;
    }

    variantKeys.forEach((key) => {
      const variant = formState.variants[key];
      const variantField = `variant_${key}`;

      if (!variant.name?.trim()) {
        errors[`${variantField}_name`] = { status: 'error', help: 'Variant name is required' };
        isValid = false;
      }

      const regularPrice = typeof variant.regular_price === 'string' ? parseFloat(variant.regular_price) : variant.regular_price;
      if (!regularPrice || regularPrice <= 0) {
        errors[`${variantField}_regular_price`] = { status: 'error', help: 'Regular price is required and must be greater than 0' };
        isValid = false;
      }

      if (!variant.sale_unit_id) {
        errors[`${variantField}_sale_unit_id`] = { status: 'error', help: 'Sale unit is required' };
        isValid = false;
      }

      if (!variant.purchase_unit_id) {
        errors[`${variantField}_purchase_unit_id`] = { status: 'error', help: 'Purchase unit is required' };
        isValid = false;
      }

      const wholesalePrice = typeof variant.wholesale_price === 'string' ? parseFloat(variant.wholesale_price) : variant.wholesale_price;
      if (wholesalePrice && wholesalePrice < 0) {
        errors[`${variantField}_wholesale_price`] = { status: 'error', help: 'Wholesale price must be positive' };
        isValid = false;
      }

      if (variant.alert_quantity && variant.alert_quantity < 0) {
        errors[`${variantField}_alert_quantity`] = { status: 'error', help: 'Alert quantity must be non-negative' };
        isValid = false;
      }

      // Validate attributes
      variant.attributes.forEach((attr, index) => {
        if (!attr.name?.trim()) {
          errors[`${variantField}_attr_${index}_name`] = { status: 'error', help: 'Attribute name is required' };
          isValid = false;
        }
        if (!attr.value?.trim()) {
          errors[`${variantField}_attr_${index}_value`] = { status: 'error', help: 'Attribute value is required' };
          isValid = false;
        }
      });

      // Validate serials
      if (variant.serials) {
        variant.serials.forEach((serial, index) => {
          if (!serial.serial_number?.trim()) {
            errors[`${variantField}_serial_${index}_number`] = { status: 'error', help: 'Serial number is required' };
            isValid = false;
          }
        });
      }
    });    setValidationState(errors);
    return isValid;
  }, [formState]);  // Initialize form with existing product data
  const initializeFormData = useCallback((productData: ProductFormData) => {
    setFormState({
      name: productData.name || "",
      code: productData.code || "",
      description: productData.description || "",
      category_id: productData.category_id,
      brand_id: productData.brand_id,
      tag_ids: productData.tag_ids || [],
      has_variants: productData.has_variants || false,
      tax_method: productData.tax_method || TaxMethod.EXCLUSIVE,
      tax: productData.tax || 0,
      daily_sale_objective: productData.daily_sale_objective || 0,
      variants: productData.variants?.reduce((acc, variant, index) => {
        acc[index.toString()] = {
          ...variant,
          // Ensure arrays are properly initialized
          attributes: variant.attributes || [],
          serials: variant.serials || [],
          batches: variant.batches || [],
        };
        return acc;
      }, {} as Record<string, ProductVariant>) || { "0": createDefaultVariant() }
    });
    setValidationState({});
  }, []);

  // Reset form to initial state
  const resetForm = useCallback(() => {
    setFormState({
      name: "",
      code: "",
      description: "",
      category_id: undefined,
      brand_id: undefined,
      tag_ids: [],
      has_variants: false,
      tax_method: TaxMethod.EXCLUSIVE,
      tax: 0,
      daily_sale_objective: 0,
      variants: { "0": createDefaultVariant() }
    });
    setValidationState({});
    setLoadingStates({ saving: false, validating: false, generating: false });
  }, []);

  // Convert state to API format
  const getFormDataForAPI = useCallback(() => {
    const variants = Object.values(formState.variants).map((variant) => ({      ...variant,
      regular_price: variant.regular_price?.toString() || "0.00",
      wholesale_price: variant.wholesale_price?.toString() || undefined,
      attributes: variant.attributes.filter(attr => attr.name && attr.value),
      serials: variant.serials?.filter(serial => serial.serial_number) || [],
    }));

    return {
      name: formState.name,
      code: formState.code || undefined,
      description: formState.description || undefined,
      category_id: formState.category_id || undefined,
      brand_id: formState.brand_id || undefined,
      tag_ids: formState.tag_ids,
      has_variants: formState.has_variants,
      tax_method: formState.tax_method,
      tax: formState.tax,
      daily_sale_objective: formState.daily_sale_objective,
      variants,
    };
  }, [formState]);

  // Loading state management
  const setLoading = useCallback((key: keyof typeof loadingStates, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  }, []);
  return {
    // State
    formState,
    validationState,
    loadingStates,
    
    // Basic field updates
    updateField,
    
    // Variant management
    updateVariant,
    addVariant,
    deleteVariant,
    duplicateVariant,
    
    // Variant attributes
    addVariantAttribute,
    updateVariantAttribute,
    deleteVariantAttribute,
    
    // Variant serials
    addVariantSerial,
    updateVariantSerial,
    deleteVariantSerial,
    
    // Variant batches
    updateVariantBatches,
    
    // Product type
    toggleProductType,
    
    // Utilities
    generateSKU,
    generateBarcode,
    validateForm,
    initializeFormData,
    resetForm,
    getFormDataForAPI,
    setLoading,
  };
};
