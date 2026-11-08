import s from "./InviteCard.module.css";

/**
 * Linen-paper look for a full-width page: `hero` on top, then every section on one continuous
 * paper with floral vines and corner bouquets, and the `footer` below.
 * Sections switch to their linen styles through data-theme="linen" on the page wrapper.
 * caption: small note at the very end.
 */
export default function InviteCard({ hero, footer, caption, children }) {
  return <div className={s.page} data-theme="linen">
    {hero}
    <div className={s.paper}>
      <span className={`${s.corner} ${s.tl}`} aria-hidden="true" />
      <span className={`${s.corner} ${s.tr}`} aria-hidden="true" />
      <div className={s.content}>{children}</div>
      <span className={`${s.corner} ${s.bl}`} aria-hidden="true" />
      <span className={`${s.corner} ${s.br}`} aria-hidden="true" />
    </div>
    {footer}
    {caption && <p className={s.caption}>{caption}</p>}
  </div>;
}
