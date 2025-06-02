import React from 'react';
import { ProductFormState, ValidationState } from "../hooks/useProductFormState";
import StateSimpleProductForm from './StateSimpleProductForm';
import StateVariantManager from './StateVariantManager';

interface StateVariantsTabProps {
  formState: ProductFormState;
  validationState: ValidationState;
  onFieldUpdate: (field: string, value: any) => void;
  onVariantUpdate: (variantId: string, updates: any) => void;
  onAddVariant: () => void;
  onDeleteVariant: (variantId: string) => void;
  onDuplicateVariant: (variantId: string) => void;
  onAddVariantAttribute: (variantId: string, attribute: any) => void;
  onUpdateVariantAttribute: (variantId: string, attributeIndex: number, updates: any) => void;
  onDeleteVariantAttribute: (variantId: string, attributeIndex: number) => void;
  onAddVariantSerial: (variantId: string, serial: any) => void;
  onUpdateVariantSerial: (variantId: string, serialIndex: number, updates: any) => void;
  onDeleteVariantSerial: (variantId: string, serialIndex: number) => void;
  onBatchesChange: (variantId: string, batches: any[]) => void;
  onGenerateSKU: (variantId: string) => void;
  onGenerateBarcode: (variantId: string) => void;
  isEditMode?: boolean;
}

const StateVariantsTab: React.FC<StateVariantsTabProps> = ({
  formState,
  validationState,
  onFieldUpdate,
  onVariantUpdate,
  onAddVariant,
  onDeleteVariant,
  onDuplicateVariant,
  onAddVariantAttribute,
  onUpdateVariantAttribute,
  onDeleteVariantAttribute,
  onAddVariantSerial,
  onUpdateVariantSerial,
  onDeleteVariantSerial,
  onBatchesChange,
  onGenerateSKU,
  onGenerateBarcode,
  isEditMode = false,
}) => {
  // Safety check for loading state
  if (!formState) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">      {formState.has_variants ? (
        <StateVariantManager
          formState={formState}
          validationState={validationState}
          onVariantUpdate={onVariantUpdate}
          onAddVariant={onAddVariant}
          onDeleteVariant={onDeleteVariant}
          onDuplicateVariant={onDuplicateVariant}
          onAddVariantAttribute={onAddVariantAttribute}
          onUpdateVariantAttribute={onUpdateVariantAttribute}
          onDeleteVariantAttribute={onDeleteVariantAttribute}
          onAddVariantSerial={onAddVariantSerial}
          onUpdateVariantSerial={onUpdateVariantSerial}
          onDeleteVariantSerial={onDeleteVariantSerial}
          onBatchesChange={onBatchesChange}
          onGenerateSKU={onGenerateSKU}
          onGenerateBarcode={onGenerateBarcode}
          isEditMode={isEditMode}
        />
      ) : (
        <StateSimpleProductForm
          formState={formState}
          validationState={validationState}
          variantId="0"
          onVariantUpdate={onVariantUpdate}
          onAddVariantAttribute={onAddVariantAttribute}
          onUpdateVariantAttribute={onUpdateVariantAttribute}
          onDeleteVariantAttribute={onDeleteVariantAttribute}
          onAddVariantSerial={onAddVariantSerial}
          onUpdateVariantSerial={onUpdateVariantSerial}
          onDeleteVariantSerial={onDeleteVariantSerial}
          onBatchesChange={onBatchesChange}
          onGenerateSKU={onGenerateSKU}
          onGenerateBarcode={onGenerateBarcode}
          isEditMode={isEditMode}
        />
      )}
    </div>
  );
};

export default StateVariantsTab;
