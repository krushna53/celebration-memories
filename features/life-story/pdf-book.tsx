import { Document, Image, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { storyParagraphs } from "@/lib/life-story";
import { chapterNumberWord } from "@/features/life-story/book-pages";
import type { LifeStoryBundle, LifeStoryPhoto } from "@/types/life-story";

/*
 * The Life Story as a printable book, laid out like a bestselling
 * biography: a 6 × 9 in trade page (prints on A4 / Letter with "fit to
 * page"), cloth-and-gilt cover, half-title, title and dedication pages,
 * contents, and chapters that open with their number, title, epigraph and
 * a large initial, then indented, justified text under running heads.
 * Client-only: imported lazily by DownloadBookButton. Uses the PDF
 * standard fonts (Times) so nothing has to be downloaded — chapters are
 * always written in English (see the life-story Edge Function).
 */

const PAGE_SIZE: [number, number] = [432, 648];
const INK = "#1f1b16";
const SOFT = "#5b5247";
const GILT = "#a8812f";
const PAPER = "#fbf6ea";
const CLOTH = "#1d1a16";

const s = StyleSheet.create({
  cover: { backgroundColor: CLOTH, color: "#f3e7c9", padding: 26 },
  coverFrame: { flex: 1, borderWidth: 1, borderColor: GILT, padding: 30, alignItems: "center", justifyContent: "space-between" },
  coverEyebrow: { fontFamily: "Times-Roman", fontSize: 8, letterSpacing: 3, textTransform: "uppercase", color: "#d9bd7a" },
  coverTitle: { fontFamily: "Times-Roman", fontSize: 30, textAlign: "center", textTransform: "uppercase", letterSpacing: 1.5, marginTop: 10, color: "#f7ecd2" },
  coverSubtitle: { fontFamily: "Times-Italic", fontSize: 13, textAlign: "center", marginTop: 8, color: "#e5d5ae" },
  coverPhoto: { width: 190, height: 238, objectFit: "cover", borderWidth: 2, borderColor: "#d9bd7a" },
  page: { backgroundColor: PAPER, color: INK, paddingTop: 62, paddingBottom: 64, paddingHorizontal: 54, fontFamily: "Times-Roman" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", textAlign: "center" },
  smallCaps: { fontSize: 8, letterSpacing: 3, textTransform: "uppercase", color: SOFT },
  halfTitle: { fontSize: 26, textAlign: "center", marginTop: 14 },
  rule: { width: 60, borderBottomWidth: 0.6, borderBottomColor: GILT, marginVertical: 16 },
  dedication: { fontFamily: "Times-Italic", fontSize: 13, lineHeight: 1.6, textAlign: "center", maxWidth: 260 },
  contentsRow: { flexDirection: "row", fontSize: 11, marginBottom: 9 },
  contentsNo: { width: 22, color: GILT },
  opener: { alignItems: "center", textAlign: "center", marginTop: 70, marginBottom: 26 },
  chapterNo: { fontSize: 8, letterSpacing: 3.5, textTransform: "uppercase", color: GILT },
  chapterTitle: { fontSize: 22, marginTop: 8, textAlign: "center" },
  period: { fontFamily: "Times-Italic", fontSize: 10, color: SOFT, marginTop: 5 },
  epigraph: { fontFamily: "Times-Italic", fontSize: 10, lineHeight: 1.5, color: SOFT, textAlign: "center", maxWidth: 250 },
  epigraphSource: { fontSize: 7, letterSpacing: 2, textTransform: "uppercase", color: SOFT, marginTop: 4 },
  paragraph: { fontSize: 11, lineHeight: 1.55, textAlign: "justify", textIndent: 16 },
  firstParagraph: { fontSize: 11, lineHeight: 1.55, textAlign: "justify" },
  initial: { fontFamily: "Times-Bold", fontSize: 26, color: GILT },
  figure: { marginVertical: 14, alignItems: "center" },
  photo: { maxWidth: "100%", maxHeight: 300, objectFit: "contain", borderWidth: 4, borderColor: "#ffffff" },
  caption: { fontFamily: "Times-Italic", fontSize: 9, color: SOFT, marginTop: 6, textAlign: "center" },
  runningHead: { position: "absolute", top: 30, left: 54, right: 54, textAlign: "center", fontSize: 7, letterSpacing: 2.5, textTransform: "uppercase", color: SOFT },
  folio: { position: "absolute", bottom: 30, left: 54, right: 54, textAlign: "center", fontSize: 9, color: SOFT },
});

function Figure({ photo }: { photo: LifeStoryPhoto }) {
  const caption = [photo.caption, photo.yearLabel].filter(Boolean).join(", ");
  return (
    <View style={s.figure} wrap={false}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
      <Image src={photo.url} style={s.photo} />
      {caption ? <Text style={s.caption}>{caption}</Text> : null}
    </View>
  );
}

/** The chapter's first paragraph: a large gilt initial and the opening words in capitals. */
function OpeningParagraph({ text }: { text: string }) {
  const lead = text.split(" ").slice(0, 4).join(" ");
  return (
    <Text style={s.firstParagraph}>
      <Text style={s.initial}>{lead.charAt(0)}</Text>
      <Text style={{ letterSpacing: 0.6 }}>{lead.slice(1).toUpperCase()}</Text>
      {text.slice(lead.length)}
    </Text>
  );
}

export function LifeStoryBook({ bundle }: { bundle: LifeStoryBundle }) {
  const { story, chapters, photos } = bundle;
  const title = story.title || story.subjectName;
  const cover = photos.find((p) => p.id === story.coverPhotoId) ?? photos[0] ?? null;

  return (
    <Document title={title} author="EveryMoment" subject={`The life story of ${story.subjectName}`}>
      <Page size={PAGE_SIZE} style={s.cover}>
        <View style={s.coverFrame}>
          <View style={{ alignItems: "center" }}>
            <Text style={s.coverEyebrow}>{story.lifeSpan || "A Life Story"}</Text>
            <Text style={s.coverTitle}>{title}</Text>
            {story.subtitle ? <Text style={s.coverSubtitle}>{story.subtitle}</Text> : null}
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          {cover ? <Image src={cover.url} style={s.coverPhoto} /> : <View />}
          <Text style={s.coverEyebrow}>A Biography</Text>
        </View>
      </Page>

      <Page size={PAGE_SIZE} style={s.page}>
        <View style={s.center}>
          <Text style={s.smallCaps}>A Biography</Text>
          <Text style={s.halfTitle}>{title}</Text>
          {story.subtitle ? <Text style={{ fontFamily: "Times-Italic", fontSize: 12, marginTop: 8 }}>{story.subtitle}</Text> : null}
          <View style={s.rule} />
          {story.lifeSpan ? <Text style={s.smallCaps}>{story.lifeSpan}</Text> : null}
        </View>
      </Page>

      {story.dedication.trim() ? (
        <Page size={PAGE_SIZE} style={s.page}>
          <View style={s.center}>
            <Text style={s.dedication}>{story.dedication}</Text>
          </View>
        </Page>
      ) : null}

      {chapters.length > 1 ? (
        <Page size={PAGE_SIZE} style={s.page}>
          <View style={{ alignItems: "center", marginTop: 40, marginBottom: 10 }}>
            <Text style={s.smallCaps}>Contents</Text>
            <View style={s.rule} />
          </View>
          {chapters.map((c, i) => (
            <View key={c.id} style={s.contentsRow}>
              <Text style={s.contentsNo}>{i + 1}</Text>
              <Text style={{ flex: 1 }}>{c.title}</Text>
              <Text style={{ fontFamily: "Times-Italic", color: SOFT }}>{c.period}</Text>
            </View>
          ))}
        </Page>
      ) : null}

      {chapters.map((chapter, i) => {
        const paragraphs = storyParagraphs(chapter.body);
        return (
          <Page key={chapter.id} size={PAGE_SIZE} style={s.page} wrap>
            <Text
              style={s.runningHead}
              fixed
              render={({ pageNumber, subPageNumber }) => (subPageNumber === 1 ? "" : pageNumber % 2 ? chapter.title : title)}
            />
            <View style={s.opener}>
              <Text style={s.chapterNo}>Chapter {chapterNumberWord(i)}</Text>
              <Text style={s.chapterTitle}>{chapter.title}</Text>
              {chapter.period ? <Text style={s.period}>{chapter.period}</Text> : null}
              <View style={s.rule} />
              {chapter.epigraph ? (
                <View style={{ alignItems: "center" }}>
                  <Text style={s.epigraph}>“{chapter.epigraph.replace(/^["“]|["”]$/g, "")}”</Text>
                  {chapter.epigraphSource ? <Text style={s.epigraphSource}>— {chapter.epigraphSource}</Text> : null}
                </View>
              ) : null}
            </View>
            {paragraphs.map((p, n) => (n === 0 ? <OpeningParagraph key={n} text={p} /> : <Text key={n} style={s.paragraph}>{p}</Text>))}
            {photos
              .filter((p) => p.chapterId === chapter.id && p.id !== cover?.id)
              .map((p) => (
                <Figure key={p.id} photo={p} />
              ))}
            <Text style={s.folio} fixed render={({ pageNumber, subPageNumber }) => (subPageNumber === 1 ? "" : String(pageNumber))} />
          </Page>
        );
      })}

      <Page size={PAGE_SIZE} style={s.page}>
        <View style={s.center}>
          <View style={s.rule} />
          <Text style={{ fontFamily: "Times-Italic", fontSize: 11, maxWidth: 260, lineHeight: 1.6 }}>
            This book was written from the memories of the people who love {story.subjectName}.
          </Text>
        </View>
        <Text style={{ fontSize: 8, color: SOFT, textAlign: "center" }}>
          Made with love on{" "}
          <Link src="https://everymoment.in" style={{ color: GILT }}>
            EveryMoment
          </Link>
        </Text>
      </Page>
    </Document>
  );
}
