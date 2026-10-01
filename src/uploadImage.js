const CLOUD_NAME = "v6pkogdi";
const UPLOAD_PRESET = "trusthome_uploads";

export async function uploadToCloudinary(file, resourceType = "auto", { assetFolder, tags = [] } = {}) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  if (assetFolder) formData.append("asset_folder", assetFolder);
  if (tags.length) formData.append("tags", tags.join(","));

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();
  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message || "Cloudinary upload failed.");
  }
  return data.secure_url;
}