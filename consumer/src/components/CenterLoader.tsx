import { Spin } from "antd";

const CenterLoader = () => {
  return (
    <div className="flex justify-center items-center h-[calc(100vh-112px)]">
      <Spin />
    </div>
  );
};

export default CenterLoader;
