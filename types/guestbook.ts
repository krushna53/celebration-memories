import { z } from "zod";

export const guestbookFormSchema = z.object({
  guestName: z.string().trim().min(2, "Please enter your name.").max(120),
  message: z.string().trim().min(2, "Please add a short message.").max(1000),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  consent: z.boolean().refine((v) => v === true, {
    message: "Please agree to the privacy notice to submit your message.",
  }),
});

export type GuestbookFormValues = z.infer<typeof guestbookFormSchema>;
