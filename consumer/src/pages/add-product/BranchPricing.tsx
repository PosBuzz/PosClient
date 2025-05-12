import { InputNumber, Select, Space } from "antd";

const branches = [
  { id: 1, name: "Main Branch" },
  { id: 2, name: "Outlet 1" },
];

export default function BranchPricing() {
  return (
    <div className="space-y-4">
      {branches.map((branch) => (
        <div key={branch.id} className="flex items-center space-x-4">
          <span className="w-32">{branch.name}</span>
          <InputNumber min={0} placeholder="Price" className="w-full" />
        </div>
      ))}
    </div>
  );
}
