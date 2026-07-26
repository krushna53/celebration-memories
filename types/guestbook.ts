import { z } from "zod";

export const guestbookFormSchema = z.object({
  guestName: z.string().trim().min(2, "Please enter your name.").max(120),
  message: z.string().trim().min(2, "Please add a short message.").max(1000),
  country: z.string().trim().max(80).optional().or(z.literal("")),
});

export type GuestbookFormValues = z.infer<typeof guestbookFormSchema>;
