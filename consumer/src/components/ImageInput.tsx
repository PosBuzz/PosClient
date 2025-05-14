import React, { useState } from "react";
import { Form, Upload, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { fileUploadProps } from "../utils/upload";
import { useMessageStore } from "../stores/messageStore";

interface ImageInputProps {
  name: string;
  label?: string;
  // onClick: () => void;
  // disabled?: boolean; // Optional prop
}

const ImageInput: React.FC<ImageInputProps> = ({ name, label }) => {
  const { messageApi } = useMessageStore();
  const [loading, setLoading] = useState(false);

  const l = label
    ? label
    : name.replace("_", " ").replace(/^([a-z])|\s+([a-z])/g, function ($1) {
        return $1.toUpperCase();
      });

  const normFile = (e) => {
    if (Array.isArray(e)) {
      return e;
    }
    return e && e.fileList;
  };

  const beforeUpload = (file) => {
    const isJpgOrPng = file.type === "image/jpeg" || file.type === "image/png";
    if (!isJpgOrPng) {
      messageApi?.error("You can only upload JPG/PNG file!");
      return false;
    }

    const isLessThan10MB = file.size / 1024 / 1024 < 10;
    if (!isLessThan10MB) {
      messageApi?.error("Image must be smaller than 10MB!");
      return false;
    }

    return true;
  };

  const handleChange = (info) => {
    if (info.file.status === "uploading") {
      setLoading(true);
      return;
    }

    if (info.file.status === "done") {
      setLoading(false);
    } else if (info.file.status === "error") {
      setLoading(false);
      messageApi?.error(`${info.file.name} upload failed.`);
    }
  };

  return (
    <>
      <Form.Item
        label={l}
        name={name}
        valuePropName="fileList"
        getValueFromEvent={normFile}
        rules={[
          {
            required: false,
            message: `Please upload ${l.toLowerCase()}`,
          },
        ]}
      >
        <Upload
          accept=".jpg, .jpeg, .png"
          className="featured-image"
          name="file"
          {...fileUploadProps}
          maxCount={1}
          listType="picture-card"
          beforeUpload={beforeUpload}
          onChange={handleChange}
        >
          {loading ? (
            "Uploading..."
          ) : (
            <span
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <UploadOutlined />
              Upload
            </span>
          )}
        </Upload>
      </Form.Item>
    </>
  );
};

export default ImageInput;
