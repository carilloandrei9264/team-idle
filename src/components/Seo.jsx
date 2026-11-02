import { useEffect } from "react";
import { updatePageMetadata } from "../lib/seo";

export default function Seo({
  title,
  description,
  path,
  image,
  type,
  robots,
  structuredData,
}) {
  const structuredDataJson = structuredData ? JSON.stringify(structuredData) : "";

  useEffect(() => {
    updatePageMetadata({
      title,
      description,
      path,
      image,
      type,
      robots,
      structuredData: structuredDataJson ? JSON.parse(structuredDataJson) : null,
    });
  }, [title, description, path, image, type, robots, structuredDataJson]);

  return null;
}
