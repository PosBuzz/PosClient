import { UploadOutlined } from "@ant-design/icons";
import { Form, Upload } from "antd";
import React, { useEffect, useState } from "react";
import { useMessageStore } from "../stores/messageStore";
import { fileUploadProps } from "../utils/upload";

interface ImageInputProps {
  name: string;
  label?: string;
  value?: string[]; // For direct usage (non-form)
  onChange?: (urls: string[]) => void; // For direct usage (non-form)
  maxCount?: number;
  required?: boolean;
  useForm?: boolean; // Whether to use Form.Item wrapper
}

const ImageInput: React.FC<ImageInputProps> = ({
  name,
  label,
  value = [],
  onChange,
  maxCount = 1,
  required = false,
  useForm = true,
}) => {
  const { messageApi } = useMessageStore();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);

  const l = label
    ?.replace("_", " ")
    .replace(/^([a-z])|\s+([a-z])/g, function ($1) {
      return $1.toUpperCase();
    });

  // Convert URLs to file objects for display
  useEffect(() => {
    if (value && value.length > 0) {
      const files = value.map((url, index) => ({
        uid: `existing-${index}`,
        name: `image-${index}.jpg`,
        status: "done",
        url: url,
        thumbUrl: url,
        response: {
          success: true,
          data: {
            secure_url: url,
          },
        },
      }));
      setFileList(files);
    } else {
      setFileList([]);
    }
  }, [value]);

  const normFile = (e: any) => {
    if (Array.isArray(e)) {
      return e;
    }
    return e && e.fileList;
  };

  const beforeUpload = (file: any) => {
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

  const handleChange = (info: any) => {
    setFileList(info.fileList);

    if (info.file.status === "uploading") {
      setLoading(true);
      return;
    }

    if (info.file.status === "done") {
      setLoading(false);

      // Extract URLs from successful uploads
      if (onChange) {
        const urls = info.fileList
          .filter(
            (file: any) => file.status === "done" && file.response?.success
          )
          .map(
            (file: any) =>
              file.response.data.secure_url ||
              file.response.data.url ||
              file.url
          )
          .filter(Boolean);

        onChange(urls);
      }
    } else if (info.file.status === "error") {
      setLoading(false);
      messageApi?.error(`${info.file.name} upload failed.`);
    } else if (info.file.status === "removed") {
      // Handle file removal
      if (onChange) {
        const urls = info.fileList
          .filter(
            (file: any) => file.status === "done" && file.response?.success
          )
          .map(
            (file: any) =>
              file.response.data.secure_url ||
              file.response.data.url ||
              file.url
          )
          .filter(Boolean);

        onChange(urls);
      }
    }
  };

  const uploadComponent = (
    <Upload
      accept=".jpg, .jpeg, .png"
      className="featured-image"
      name="file"
      {...fileUploadProps}
      maxCount={maxCount}
      listType="picture-card"
      beforeUpload={beforeUpload}
      onChange={handleChange}
      fileList={fileList}
      onRemove={(file) => {
        // Handle manual removal
        const newFileList = fileList.filter((f) => f.uid !== file.uid);
        setFileList(newFileList);

        if (onChange) {
          const urls = newFileList
            .filter(
              (file: any) => file.status === "done" && file.response?.success
            )
            .map(
              (file: any) =>
                file.response.data.secure_url ||
                file.response.data.url ||
                file.url
            )
            .filter(Boolean);

          onChange(urls);
        }
      }}
    >
      {fileList.length >= maxCount ? null : loading ? (
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
  );

  // Return with Form.Item wrapper if useForm is true
  if (useForm) {
    return (
      <Form.Item
        label={l ?? ""}
        name={name}
        valuePropName="fileList"
        getValueFromEvent={normFile}
        rules={[
          {
            required: required,
            message: `Please upload ${l?.toLowerCase()}`,
          },
        ]}
      >
        {uploadComponent}
      </Form.Item>
    );
  }

  // Return without Form.Item wrapper for direct usage
  return (
    <div>
      {l && <label className="block text-sm font-medium mb-1">{l}</label>}
      {uploadComponent}
    </div>
  );
};

export default ImageInput;
