const CLOUD_NAME = "v6pkogdi";
const UPLOAD_PRESET = "trusthome_uploads";

export function documentResourceType(file) {
  return file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf") ? "raw" : "auto";
}

export async function uploadPrivateDocument(file, signature, resourceType = "image") {
  if (!signature?.signature || !signature?.apiKey || !signature?.cloudName || !signature?.params) {
    throw new Error("The private document upload could not be authorized.");
  }
  if (!signature.params.public_id || !signature.params.upload_preset || signature.params.type !== "authenticated") {
    throw new Error("The private document upload configuration is invalid.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", signature.apiKey);
  formData.append("signature", signature.signature);
  Object.entries(signature.params).forEach(([key, value]) => formData.append(key, String(value)));

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/${resourceType}/upload`,
    { method: "POST", body: formData },
  );
  const data = await response.json();
  if (!response.ok || !data.public_id || !data.format || !["image", "raw"].includes(data.resource_type)) {
    throw new Error(data.error?.message || "Private document upload failed.");
  }
  return { publicId: data.public_id, format: data.format, resourceType: data.resource_type };
}

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