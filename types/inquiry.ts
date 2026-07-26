import { z } from "zod";

export const inquiryFormSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  email: z.string().trim().email("Please enter a valid email address.").max(160),
  message: z.string().trim().min(10, "Please add a few details about your query.").max(2000),
});

export type InquiryFormValues = z.infer<typeof inquiryFormSchema>;
