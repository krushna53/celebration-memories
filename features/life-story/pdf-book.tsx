import { Document, Image, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { storyParagraphs } from "@/lib/life-story";
import type { LifeStoryBundle, LifeStoryPhoto } from "@/types/life-story";

/*
 * The Life Story as a printable A4 book. Client-only: imported lazily by
 * DownloadBookButton. Uses the PDF standard fonts (Times / Helvetica) so
 * nothing has to be downloaded — chapters are always written in English
 * (see the life-story Edge Function's instructions).
 */

const NAVY = "#1e1b4b";
const GOLD = "#e5503c";
const IVORY = "#fdf6ec";

const s = StyleSheet.create({
  cover: { backgroundColor: NAVY, color: IVORY, padding: 56, justifyContent: "center", alignItems: "center" },
  coverPhoto: { width: 300, height: 360, objectFit: "cover", borderWidth: 8, borderColor: IVORY, marginBottom: 36 },
  eyebrow: { fontFamily: "Helvetica", fontSize: 9, letterSpacing: 4, textTransform: "uppercase", color: "#ffc7bc" },
  coverTitle: { fontFamily: "Times-Bold", fontSize: 38, textAlign: "center", marginTop: 14 },
  coverSubtitle: { fontFamily: "Times-Italic", fontSize: 16, textAlign: "center", marginTop: 12, color: "#faeedd" },
  coverSpan: { fontFamily: "Helvetica", fontSize: 11, letterSpacing: 3, marginTop: 18, color: "#ffc7bc" },
  page: { backgroundColor: IVORY, color: NAVY, paddingTop: 64, paddingBottom: 72, paddingHorizontal: 64, fontFamily: "Times-Roman" },
  contentsTitle: { fontFamily: "Times-Bold", fontSize: 24, marginBottom: 24 },
  contentsRow: { flexDirection: "row", justifyContent: "space-between", fontSize: 12, marginBottom: 10 },
  chapterNo: { fontFamily: "Helvetica", fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: GOLD },
  chapterTitle: { fontFamily: "Times-Bold", fontSize: 26, marginTop: 6 },
  period: { fontFamily: "Helvetica", fontSize: 10, color: "#3f358a", marginTop: 4, marginBottom: 18 },
  paragraph: { fontSize: 12, lineHeight: 1.65, marginBottom: 10, textAlign: "justify" },
  figure: { marginTop: 14, marginBottom: 6, alignItems: "center" },
  photo: { maxWidth: "100%", maxHeight: 320, objectFit: "contain" },
  caption: { fontFamily: "Times-Italic", fontSize: 10, color: "#3f358a", marginTop: 6, textAlign: "center" },
  footer: { position: "absolute", bottom: 32, left: 64, right: 64, flexDirection: "row", justifyContent: "space-between", fontFamily: "Helvetica", fontSize: 8, color: "#3f358a" },
  colophon: { fontFamily: "Helvetica", fontSize: 9, color: "#3f358a", textAlign: "center" },
});

function Figure({ photo }: { photo: LifeStoryPhoto }) {
  const caption = [photo.caption, photo.yearLabel].filter(Boolean).join(" · ");
  return (
    <View style={s.figure} wrap={false}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
      <Image src={photo.url} style={s.photo} />
      {caption ? <Text style={s.caption}>{caption}</Text> : null}
    </View>
  );
}

export function LifeStoryBook({ bundle }: { bundle: LifeStoryBundle }) {
  const { story, chapters, photos } = bundle;
  const title = story.title || story.subjectName;
  const cover = photos.find((p) => p.id === story.coverPhotoId) ?? photos[0] ?? null;

  return (
    <Document title={title} author="EveryMoment" subject={`The life story of ${story.subjectName}`}>
      <Page size="A4" style={s.cover}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
        {cover ? <Image src={cover.url} style={s.coverPhoto} /> : null}
        <Text style={s.eyebrow}>A life story</Text>
        <Text style={s.coverTitle}>{title}</Text>
        {story.subtitle ? <Text style={s.coverSubtitle}>{story.subtitle}</Text> : null}
        {story.lifeSpan ? <Text style={s.coverSpan}>{story.lifeSpan}</Text> : null}
      </Page>

      {chapters.length > 1 ? (
        <Page size="A4" style={s.page}>
          <Text style={s.contentsTitle}>Contents</Text>
          {chapters.map((c, i) => (
            <View key={c.id} style={s.contentsRow}>
              <Text>
                {i + 1}. {c.title}
              </Text>
              <Text style={{ color: "#3f358a" }}>{c.period}</Text>
            </View>
          ))}
        </Page>
      ) : null}

      {chapters.map((chapter, i) => (
        <Page key={chapter.id} size="A4" style={s.page} wrap>
          <Text style={s.chapterNo}>Chapter {i + 1}</Text>
          <Text style={s.chapterTitle}>{chapter.title}</Text>
          <Text style={s.period}>{chapter.period || " "}</Text>
          {storyParagraphs(chapter.body).map((p, n) => (
            <Text key={n} style={s.paragraph}>
              {p}
            </Text>
          ))}
          {photos
            .filter((p) => p.chapterId === chapter.id && p.id !== cover?.id)
            .map((p) => (
              <Figure key={p.id} photo={p} />
            ))}
          <View style={s.footer} fixed>
            <Text>{title}</Text>
            <Text render={({ pageNumber }) => String(pageNumber)} />
          </View>
        </Page>
      ))}

      <Page size="A4" style={[s.page, { justifyContent: "flex-end" }]}>
        <Text style={s.colophon}>
          Made with love on{" "}
          <Link src="https://everymoment.in" style={{ color: GOLD }}>
            EveryMoment
          </Link>
        </Text>
      </Page>
    </Document>
  );
}
