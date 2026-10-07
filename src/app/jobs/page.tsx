import JobApplicationForm from "@/components/JobApplicationForm";
import { createEditablePage } from "@/lib/editable-route";

const page = createEditablePage("jobs", JobApplicationForm);

export const revalidate = 0;
export const generateMetadata = page.generateMetadata;
export default page.Page;
