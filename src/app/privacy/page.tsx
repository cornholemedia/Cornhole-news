import { createEditablePage } from "@/lib/editable-route";

const page = createEditablePage("privacy");

export const revalidate = 3600;
export const generateMetadata = page.generateMetadata;
export default page.Page;
