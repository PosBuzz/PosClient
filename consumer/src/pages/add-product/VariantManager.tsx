import { Button, Input, Space } from "antd";
import { useState } from "react";

interface Variant {
  name: string;
  options: string[];
}

export default function VariantManager() {
  const [variants, setVariants] = useState<Variant[]>([]);

  const handleAddVariant = () => {
    setVariants([...variants, { name: "", options: [""] }]);
  };

  const handleVariantChange = (index: number, key: keyof Variant, value: string | string[]) => {
    const newVariants = [...variants];
    newVariants[index][key] = value;
    setVariants(newVariants);
  };

  return (
    <div className="space-y-4">
      {variants.map((variant, i) => (
        <div key={i} className="space-y-2">
          <Input
            placeholder="Variant name (e.g. Size)"
            value={variant.name}
            onChange={(e) => handleVariantChange(i, "name", e.target.value)}
          />
          <Input.TextArea
            placeholder="Options (comma separated)"
            value={variant.options.join(", ")}
            onChange={(e) =>
              handleVariantChange(i, "options", e.target.value.split(",").map((v) => v.trim()))
            }
          />
        </div>
      ))}
      <Button onClick={handleAddVariant}>Add Variant</Button>
    </div>
  );
}
