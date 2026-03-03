import { Spin } from "antd";

const FullScreenLoader = () => {
  return (
    <div className="h-screen w-screen flex justify-center items-center dark:bg-black">
      <Spin size="large" />
    </div>
  );
};

export default FullScreenLoader;
