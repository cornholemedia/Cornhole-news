import ContactForm from "@/components/ContactForm";
import { createEditablePage } from "@/lib/editable-route";

const page = createEditablePage("contact", ContactForm);

export const revalidate = 0;
export const generateMetadata = page.generateMetadata;
export default page.Page;
