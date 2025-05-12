import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Select, Tooltip } from "antd";
import axios from "axios";
import { useMemo } from "react";

interface CommonSelectorProps {
  value?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  type: "category" | "brand" | "unit";
  subtype?: "product" | "purchase" | "sale";
}

interface OptionType {
  id: number;
  name: string;
}

const fetchOptions = async (
  type: string,
  subtype?: string
): Promise<OptionType[]> => {
  if (type === "unit") {
    return axios.get(`/api/units?subtype=${subtype}`).then((res) => res.data);
  }

  switch (type) {
    case "category":
      return axios.get("/api/categories").then((res) => res.data);
    case "brand":
      return axios.get("/api/brands").then((res) => res.data);
    default:
      return [];
  }
};

export default function CommonSelector({
  value,
  onChange,
  disabled,
  type,
  subtype,
}: CommonSelectorProps) {
  const queryClient = useQueryClient();

  const { data: options1 = [], isLoading } = useQuery({
    queryFn: () => fetchOptions(type, subtype),
    queryKey: ["selector", type, subtype],
  });

  const options = [
    { name: "test 1", id: 1 },
    { name: "test 2", id: 2 },
    { name: "test 3", id: 3 },
    { name: "test 4", id: 4 },
  ];

  const handleAddNew = () => {
    const modalType = {
      category: () => console.log("Open Category Modal"),
      brand: () => console.log("Open Brand Modal"),
      unit: () => console.log("Open Unit Modal"),
    };

    modalType[type]?.();
  };

  const handleEdit = (item: OptionType) => {
    const editType = {
      category: () => console.log("Edit Category", item),
      brand: () => console.log("Edit Brand", item),
      unit: () => console.log("Edit Unit", item),
    };

    editType[type]?.();
  };

  const handleDelete = (id: number) => {
    const deleteType = {
      category: () => console.log("Delete Category", id),
      brand: () => console.log("Delete Brand", id),
      unit: () => console.log("Delete Unit", id),
    };

    deleteType[type]?.();
  };

  const mergedOptions = useMemo(
    () =>
      options.map((opt) => ({
        label: (
          <div className="flex items-center justify-between">
            <span>{opt.name}</span>
            <span className="space-x-1">
              <Tooltip title="Edit">
                <EditOutlined
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(opt);
                  }}
                />
              </Tooltip>
              <Tooltip title="Delete">
                <DeleteOutlined
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(opt.id);
                  }}
                />
              </Tooltip>
            </span>
          </div>
        ),
        value: opt.id,
      })),
    [options]
  );

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium capitalize">Select {type}</span>
        <Tooltip title={`Add new ${type}`}>
          <PlusOutlined onClick={handleAddNew} className="cursor-pointer" />
        </Tooltip>
      </div>
      <Select
        showSearch
        placeholder={`Select ${type}`}
        optionFilterProp="label"
        loading={isLoading}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full"
        options={mergedOptions}
        filterOption={(input, option) =>
          (option?.label as string).toLowerCase().includes(input.toLowerCase())
        }
      />
    </div>
  );
}
