import { UploadOutlined } from "@ant-design/icons";
import { Button, Form, Upload } from "antd";
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
  listType?: "text" | "picture-circle" | "picture-card" | "picture";
  /** Help shown under the field (Form.Item extra). */
  extra?: React.ReactNode;
  /** Returns a warning for the chosen image's pixel size; the upload still goes ahead. */
  checkImage?: (width: number, height: number) => string | null;
}

const readImageSize = (file: Blob) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      reject(new Error("unreadable image"));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

const ImageInput: React.FC<ImageInputProps> = ({
  name,
  label,
  value = [],
  onChange,
  maxCount = 1,
  required = false,
  useForm = true,
  listType = "picture-card",
  extra,
  checkImage,
}) => {
  const { messageApi } = useMessageStore();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);

  // Add this to track if we've already processed the value prop
  const [initialValueProcessed, setInitialValueProcessed] = useState(false);

  const l = label
    ?.replace("_", " ")
    .replace(/^([a-z])|\s+([a-z])/g, function ($1) {
      return $1.toUpperCase();
    });

  // Convert URLs to file objects for display - only on initial mount or when value changes
  useEffect(() => {
    if ((value && value.length > 0) || value === null) {
      const urls = value || [];
      const files = urls.map((url, index) => ({
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
      setInitialValueProcessed(true);
    } else if (!initialValueProcessed) {
      setFileList([]);
      setInitialValueProcessed(true);
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

    if (checkImage) {
      readImageSize(file)
        .then(({ width, height }) => {
          const advice = checkImage(width, height);
          if (advice) messageApi?.warning(advice, 8);
        })
        .catch(() => undefined);
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
            (file: any) => file.status === "done" && file.response?.success,
          )
          .map(
            (file: any) =>
              file.response.data.secure_url ||
              file.response.data.url ||
              file.url,
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
            (file: any) => file.status === "done" && file.response?.success,
          )
          .map(
            (file: any) =>
              file.response.data.secure_url ||
              file.response.data.url ||
              file.url,
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
      listType={listType}
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
              (file: any) => file.status === "done" && file.response?.success,
            )
            .map(
              (file: any) =>
                file.response.data.secure_url ||
                file.response.data.url ||
                file.url,
            )
            .filter(Boolean);

          onChange(urls);
        }
      }}
    >
      {fileList.length >= maxCount ? null : loading ? (
        "Uploading..."
      ) : listType === "text" ? (
        <Button icon={<UploadOutlined />}>Click to Upload</Button>
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
        extra={extra}
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
