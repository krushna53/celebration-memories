"use client";

import dynamic from "next/dynamic";

/**
 * DownloadBookButton, loaded in the browser only. It pulls in
 * @react-pdf/renderer, and Next.js preloads every server route at startup:
 * if the PDF library is anywhere in the server bundle it builds a document
 * on load and reads pdfkit's standard-font files, which Netlify's function
 * bundle doesn't include — an unhandled rejection that crashed the whole
 * server (site-wide 502s). With ssr:false the server bundle never has it.
 */
export const LazyDownloadBookButton = dynamic(() => import("@/features/life-story/download-book-button").then((m) => m.DownloadBookButton), {
  ssr: false,
});
