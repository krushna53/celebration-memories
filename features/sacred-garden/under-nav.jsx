"use client";
import { useLayoutEffect, useRef, useState } from "react";

/**
 * Puts a full-height page right under the site's fixed header. The header is about 66px tall, and
 * bars above <main> (like the concierge banner) come and go, so the gap is measured instead of fixed.
 * Children read --sg-nav (the header's height) for their sticky panes.
 */
export default function UnderNav({ children }) {
  const ref = useRef(null);
  const [space, setSpace] = useState({ nav: 66, pad: 66 });
  useLayoutEffect(() => {
    const measure = () => {
      const header = document.querySelector("body > header");
      const nav = header ? Math.round(header.getBoundingClientRect().height) : 0;
      const top = ref.current ? Math.round(ref.current.getBoundingClientRect().top + window.scrollY) : 0;
      setSpace({ nav, pad: Math.max(0, nav - top) });
    };
    measure();
    const seen = new ResizeObserver(measure);
    seen.observe(document.body);
    return () => seen.disconnect();
  }, []);
  return <div ref={ref} style={{ "--sg-nav": `${space.nav}px`, paddingTop: space.pad }}>{children}</div>;
}
