import SimpleProductForm from "./SimpleProductForm";
import VariantManager from "./VariantManager";

interface VariantsTabProps {
  formData: any;
  updateVariant: (index: number, variantData: any) => void;
  addVariant: () => number;
  deleteVariant: (index: number) => void;
  isEditMode?: boolean;
}

export default function VariantsTab({
  formData,
  updateVariant,
  addVariant,
  deleteVariant,
  isEditMode = false,
}: VariantsTabProps) {
  // Add safety checks
  if (!formData) {
    return <div>Loading...</div>;
  }

  const variants = formData.variants || [];

  return (
    <div className="space-y-6!">      {formData.has_variants ? (
        <VariantManager
          variants={variants}
          updateVariant={updateVariant}
          addVariant={addVariant}
          deleteVariant={deleteVariant}
          isEditMode={isEditMode}
        />
      ) : (
        <SimpleProductForm
          variant={variants[0] || {}}
          updateVariant={(variantData) => updateVariant(0, variantData)}
          productName={formData.name || ""}
          isEditMode={isEditMode}
        />
      )}
    </div>
  );
}
