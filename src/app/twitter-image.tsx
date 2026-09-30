import { ShareImage, shareImageContentType, shareImageSize } from "@/lib/share-image";

export const runtime = "nodejs";

export const alt = "Cornhole News — news, discussion, and community";
export const size = shareImageSize;
export const contentType = shareImageContentType;

export default function TwitterImage() {
  return ShareImage();
}
