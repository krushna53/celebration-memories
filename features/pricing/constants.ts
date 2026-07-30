/**
 * Short-lived cookie carrying a promo code from /pricing into the
 * wizard's Payment step (app/start/[token]/payment/page.tsx), so a
 * visitor who typed "FREE" on the pricing page doesn't have to type it
 * again once they reach the end of the wizard — see PaymentPanel's
 * `initialPromoCode` prop. Deliberately just a convenience prefill, not
 * an auto-redemption: the host still clicks "Apply" once they're there,
 * after their draft/account exist, same as redeemPromoCodeAction always
 * required.
 *
 * Kept in its own plain module rather than actions.ts: a "use server"
 * file may only export async functions (Next.js build error otherwise),
 * so a shared string constant can't live there.
 */
export const PROMO_COOKIE = "cm_promo_code";
