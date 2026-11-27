"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  Alignment,
  BlockQuote,
  Bold,
  ClassicEditor,
  Essentials,
  FontBackgroundColor,
  FontColor,
  FontFamily,
  FontSize,
  GeneralHtmlSupport,
  Heading,
  HorizontalLine,
  HtmlComment,
  Image,
  ImageInsertViaUrl,
  ImageToolbar,
  Italic,
  Link,
  List,
  Paragraph,
  RemoveFormat,
  SourceEditing,
  Strikethrough,
  Table,
  TableCellProperties,
  TableProperties,
  TableToolbar,
  Underline,
  type EditorConfig,
} from "ckeditor5";
import "ckeditor5/ckeditor5.css";

import { joinEmailDocument, splitEmailDocument } from "@/lib/mailer/html-email";

/**
 * CKEditor 5 for full-HTML emails, with a "Source" button that shows and
 * edits the HTML. CKEditor edits a document's <body>; the <head> and the
 * <body> tag itself are kept aside and put back on every change, so a
 * complete email document survives editing. (CKEditor's own Full Page
 * plugin is a paid add-on.)
 *
 * General HTML Support keeps the email's tables, inline styles and
 * attributes as written, minus anything script-like; the HTML is sanitized
 * again when it's saved and sent (lib/mailer/html-email.ts).
 *
 * Licence: CKEditor 5 is GPL-2.0+ or commercial. NEXT_PUBLIC_CKEDITOR_LICENSE_KEY
 * takes a commercial (or free-plan) key; without one it runs under "GPL".
 */

export interface HtmlEmailEditorHandle {
  /** Inserts text (a {{token}}) at the cursor. False while the Source view is open. */
  insertText(text: string): boolean;
  /** Applies any edits still in the Source view and returns the current document. */
  flush(): string;
}

const CONFIG: EditorConfig = {
  licenseKey: process.env.NEXT_PUBLIC_CKEDITOR_LICENSE_KEY || "GPL",
  plugins: [
    Essentials,
    Paragraph,
    Heading,
    Bold,
    Italic,
    Underline,
    Strikethrough,
    RemoveFormat,
    FontFamily,
    FontSize,
    FontColor,
    FontBackgroundColor,
    Alignment,
    List,
    Link,
    Image,
    ImageInsertViaUrl,
    ImageToolbar,
    Table,
    TableToolbar,
    TableProperties,
    TableCellProperties,
    HorizontalLine,
    BlockQuote,
    GeneralHtmlSupport,
    HtmlComment,
    SourceEditing,
  ],
  toolbar: {
    items: [
      "sourceEditing",
      "|",
      "undo",
      "redo",
      "|",
      "heading",
      "fontFamily",
      "fontSize",
      "|",
      "bold",
      "italic",
      "underline",
      "strikethrough",
      "fontColor",
      "fontBackgroundColor",
      "removeFormat",
      "|",
      "alignment",
      "bulletedList",
      "numberedList",
      "|",
      "link",
      "insertImage",
      "insertTable",
      "horizontalLine",
      "blockQuote",
    ],
    shouldNotGroupWhenFull: false,
  },
  htmlSupport: {
    allow: [{ name: /.*/, attributes: true, classes: true, styles: true }],
    disallow: [
      { name: /^(script|iframe|object|embed|form|input|button|textarea|select|option|svg|math|template)$/ },
      { name: /.*/, attributes: [{ key: /^on/i, value: true }] },
    ],
  },
  link: { defaultProtocol: "https://", allowedProtocols: ["https?", "mailto", "tel"] },
  image: { toolbar: ["imageTextAlternative"] },
  table: { contentToolbar: ["tableColumn", "tableRow", "mergeTableCells", "tableProperties", "tableCellProperties"] },
  fontSize: { options: [12, 14, "default", 18, 20, 24, 30], supportAllValues: true },
  fontFamily: { supportAllValues: true },
};

export function HtmlEmailEditor({
  html,
  onChange,
  handle,
}: {
  /** The full email document. */
  html: string;
  onChange: (html: string) => void;
  handle?: MutableRefObject<HtmlEmailEditorHandle | null>;
}) {
  const editorRef = useRef<ClassicEditor | null>(null);
  const shell = useRef(splitEmailDocument(html));
  const emitted = useRef(html);
  const initialInner = useRef(shell.current.inner);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  function sourceEditing(editor: ClassicEditor): SourceEditing {
    return editor.plugins.get("SourceEditing") as SourceEditing;
  }

  function emit(): string {
    const editor = editorRef.current;
    if (!editor) return emitted.current;
    const doc = joinEmailDocument(shell.current.before, editor.getData(), shell.current.after);
    if (doc !== emitted.current) {
      emitted.current = doc;
      onChangeRef.current(doc);
    }
    return doc;
  }

  // A new document from outside (AI generation, a template picked): load it.
  useEffect(() => {
    if (html === emitted.current) return;
    shell.current = splitEmailDocument(html);
    emitted.current = html;
    const editor = editorRef.current;
    if (!editor) {
      initialInner.current = shell.current.inner;
      return;
    }
    const source = sourceEditing(editor);
    if (source.isSourceEditingMode) source.isSourceEditingMode = false;
    editor.setData(shell.current.inner);
    // CKEditor normalises markup; report what it actually holds.
    emitted.current = joinEmailDocument(shell.current.before, editor.getData(), shell.current.after);
  }, [html]);

  useEffect(() => {
    if (!handle) return;
    handle.current = {
      insertText(text) {
        const editor = editorRef.current;
        if (!editor || sourceEditing(editor).isSourceEditingMode) return false;
        editor.model.change((writer) => {
          editor.model.insertContent(writer.createText(text));
        });
        editor.editing.view.focus();
        return true;
      },
      flush() {
        const editor = editorRef.current;
        if (editor) {
          const source = sourceEditing(editor);
          if (source.isSourceEditingMode) source.updateEditorData();
        }
        return emit();
      },
    };
    return () => {
      handle.current = null;
    };
  });

  return (
    <div className="mailer-html-editor overflow-hidden rounded-xl border border-navy-950/10 bg-white text-navy-950 [&_.ck-editor__editable]:max-h-[560px] [&_.ck-editor__editable]:min-h-[360px] [&_.ck-source-editing-area_textarea]:font-mono [&_.ck-source-editing-area_textarea]:text-xs">
      <CKEditor
        editor={ClassicEditor}
        config={CONFIG}
        data={initialInner.current}
        onReady={(editor) => {
          editorRef.current = editor;
          // Show the Source view's edits in the preview as soon as it closes.
          sourceEditing(editor).on("change:isSourceEditingMode", () => emit());
        }}
        onAfterDestroy={() => {
          editorRef.current = null;
        }}
        onChange={() => emit()}
      />
    </div>
  );
}
