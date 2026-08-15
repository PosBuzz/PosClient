// Helper function to upload a file to Cloudinary
export const uploadToCloudinary = async (file) => {
  try {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", import.meta.env.VITE_UPLOAD_PRESET);
      formData.append("folder", "posbuzz");

      fetch(
        `https://api.cloudinary.com/v1_1/${
          import.meta.env.VITE_CLOUD_NAME
        }/image/upload`,
        {
          method: "POST",
          body: formData,
        },
      )
        .then((response) => response.json())
        .then((result) => {
          // Check if eager transformations exist and use the first one's secure_url if available
          const eagerSecureUrl =
            result.eager && result.eager.length > 0
              ? result.eager[0].secure_url
              : null;

          resolve({
            success: true,
            data: {
              secure_url: eagerSecureUrl || result.secure_url, // Prefer eager URL if available
              url: result.url,
              public_id: result.public_id,
              // Include the full eager array for more flexibility if needed
              eager: result.eager || [],
            },
          });
        })
        .catch((error) => {
          reject({
            success: false,
            error: error.message,
          });
        });
    });
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw error;
  }
};

export const getImageUrlForCloudinaryImage = (formValues, fileInputName) => {
  if (formValues[fileInputName] && Array.isArray(formValues[fileInputName])) {
    const file = formValues[fileInputName][0];
    if (
      file &&
      file.status === "done" &&
      file.response &&
      file.response.success &&
      file.response?.data?.secure_url
    ) {
      return file.response?.data?.secure_url;
    } else if (
      file &&
      file.status === "done" &&
      file.response &&
      file.response.success &&
      file.response?.data?.url
    ) {
      return file.response?.data?.url;
    } else if (file && file.thumbUrl) {
      return file.thumbUrl;
    }
  }

  return null;
};

export const getImageUrlForCloudinaryImageMultiple = (
  formValues,
  fileInputName,
) => {
  if (formValues[fileInputName] && Array.isArray(formValues[fileInputName])) {
    // Map over all files and extract the URL or thumbUrl
    const urls = formValues[fileInputName]
      .map((file) => {
        if (
          file &&
          file.status === "done" &&
          file.response &&
          file.response.success &&
          file.response?.data?.secure_url
        ) {
          return file.response?.data?.secure_url;
        } else if (
          file &&
          file.status === "done" &&
          file.response &&
          file.response.success &&
          file.response?.data?.url
        ) {
          return file.response?.data?.url;
        } else if (file && file.thumbUrl) {
          return file.thumbUrl;
        }
        return undefined; // Explicitly return undefined if no valid URL or thumbUrl
      })
      .filter((url) => url !== undefined); // Filter out undefined values

    return urls.length > 0 ? urls : null; // Return the array of URLs or null if no URLs
  }

  return null;
};

// Custom upload props for Ant Design Upload component to use direct Cloudinary API
export const fileUploadProps = {
  customRequest: async (options: any) => {
    const { file, onSuccess, onError, onProgress } = options;

    try {
      // Handle progress updates
      if (onProgress) {
        const updateProgress = (percent: number) => {
          onProgress({ percent });
        };

        // Simulate progress for better UX
        const progressInterval = setInterval(() => {
          updateProgress(Math.random() * 100);
        }, 1000);

        const result = await uploadToCloudinary(file);

        clearInterval(progressInterval);
        updateProgress(100);

        if (onSuccess) {
          onSuccess(result, file);
        }
      } else {
        const result = await uploadToCloudinary(file);
        if (onSuccess) {
          onSuccess(result, file);
        }
      }
    } catch (error) {
      if (onError) {
        onError(error);
      }
    }
  },
};
