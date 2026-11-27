import {STORY_OUTFITS,sceneWardrobePrompt} from "./ai-story-wardrobe.mjs";
import {ANIMATED_OPENING,continuationDirection} from "./ai-continuation.mjs";
import { SCENE_DESCRIPTION_LIMIT, CONTINUATION_SUMMARY_LIMIT, STORY_TEXT_LIMIT } from "./ai-video-limits.mjs";
export const PHOTO_LIKENESS_STYLE = "Photo likeness · light animation";
export const STORY_STYLES = ["Illustrated romance", "Stylized 3D animation", "Watercolour storybook", PHOTO_LIKENESS_STYLE];
export const STORY_STYLE_DETAILS = {
  "Illustrated romance":"Soft illustrated characters, clean outlines, warm cinematic colours and gentle expressive movement.",
  "Stylized 3D animation":"Rounded 3D animated characters, dimensional faces, soft material textures, cinematic lighting and expressive cartoon movement; avoid photorealistic skin.",
  "Watercolour storybook":"Hand-painted 2D storybook illustration, visible watercolour washes, delicate paper texture, pastel colours and gently animated painted characters.",
  [PHOTO_LIKENESS_STYLE]:"Polished illustrated 3D likeness: the couple keep recognisable facial features from the uploaded photo, with clean illustrated outlines, expressive eyes, smooth animated movement and warm cinematic lighting; never photorealistic footage."
};
// How the uploaded couple should look. The likeness style keeps recognisable faces in a clearly animated illustration;
// every other style turns them into clearly stylised cartoon characters.
export function characterDirection(style){
 if(style===PHOTO_LIKENESS_STYLE)return "Turn the uploaded couple into polished stylized 3D illustrated versions of themselves from the very first visible frame. Keep both people clearly recognisable from the photo: the same face shape, eyes, nose, smile, skin tone, hairstyle and hairline. Use clean illustrated outlines, expressive animated eyes, smooth illustrated skin shading, natural blinking and gentle animated movement; never photorealistic footage and never different characters. Keep these same animated faces consistent across scenes.";
 return "Reimagine the uploaded couple as clearly stylized cartoon characters from the very first visible frame. Use the photo only as loose inspiration for broad appearance and hairstyles; do not preserve realistic photographic faces, skin texture or exact facial likeness. Prioritise the selected animation style over photo realism. Keep these animated character designs consistent across scenes.";
}
export const newStoryEvent = () => ({ id: crypto.randomUUID(), title: "", description: "", location: "", date: "", caption: "", wardrobe:"auto",brideOutfit:"",groomOutfit:"" });
export function storyScenePrompt(event, { style = STORY_STYLES[0], seconds = 5, index = 0, count = 1 } = {}) {
  return `Create scene ${index + 1} of ${count} of a personal love-story film, ${seconds} seconds long, portrait 9:16. ${characterDirection(style)} Visual style: ${style}; ${style===PHOTO_LIKENESS_STYLE ? "clearly illustrated animated faces recognisably based on the uploaded photo, rather than photorealistic footage" : "clearly animated illustrated characters rather than photorealistic footage"}. Scene title: ${event.title}. What happens: ${event.description}. ${sceneWardrobePrompt(event,index)} ${event.location ? `Setting: ${event.location}.` : ""} Warm cinematic lighting, expressive eyes, natural blinking, silent smiles and gentle believable gestures. Establish the location and then use a slow camera move to follow the action. Leave the upper third clear for editable story captions. NO text, dates, names, captions, logos or watermarks inside the generated footage. No talking, dialogue, lip-sync, narration or singing. Instrumental romantic music only. No distorted faces or hands. Do not add an introductory photo slideshow. This is one scene; do not invent or skip other life events.`;
}
export function validStoryScene(value) {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const limits = { title: 80, caption: 160, location: 120, date: 20, projectId: 80, id: 80, previousSummary:CONTINUATION_SUMMARY_LIMIT, animation:100, storyText:STORY_TEXT_LIMIT };
  if(value.storyText !== undefined && (typeof value.storyText !== "string" || !value.storyText.trim())) return false;
  if(value.part !== undefined && (!Number.isInteger(value.part) || value.part < 1 || value.part > 100)) return false;
  if(value.scenes !== undefined && (!Array.isArray(value.scenes) || value.scenes.length < 1 || value.scenes.length > 6 || !value.scenes.every(scene => scene && typeof scene === "object" && ["id","title","description","location","date","wardrobe","brideOutfit","groomOutfit"].every(key => scene[key] === undefined || typeof scene[key] === "string" && scene[key].length <= ({id:80,title:80,description:SCENE_DESCRIPTION_LIMIT,location:120,date:20,wardrobe:30,brideOutfit:240,groomOutfit:240}[key]))))) return false;
  if(value.scenes?.some(scene=>scene.wardrobe !== undefined && !STORY_OUTFITS.some(([id])=>id===scene.wardrobe)))return false;
  return Object.entries(limits).every(([key, limit]) => value[key] === undefined || typeof value[key] === "string" && value[key].length <= limit)
    && Number.isInteger(value.index) && value.index >= 0 && value.index < 6
    && Number.isInteger(value.count) && value.count >= 1 && value.count <= 6;
}

const LIKENESS_OPENING="Begin directly inside the first described setting with an establishing medium-wide shot and action already in motion. Use the photo only for both people's recognisable facial identity, never as a displayed photo, static portrait, collage, slideshow or opening face close-up. Show the same polished illustrated animated faces from the opening moment; no photorealistic photo-to-animation reveal or sudden style change.";
export function storyFilmPrompt(events, options={}) {
  const prompt=baseStoryFilmPrompt(events,options);
  if(options.style!==PHOTO_LIKENESS_STYLE)return prompt;
  // Replace generic cartoon-only wording with the recognisable illustrated-face direction.
  return prompt
    .replace("animated personal love-story video","polished illustrated 3D personal love-story video")
    .replace("consistent animated character designs and clothing within each beat","the same recognisable illustrated faces and consistent clothing within each beat")
    .replace(ANIMATED_OPENING,LIKENESS_OPENING);
}
function baseStoryFilmPrompt(events, {style=STORY_STYLES[0],seconds=15,part=1,previousSummary=""}={}) {
  const freeform=typeof events === "string";
  const timeline=freeform?events:events.map((event,i)=>{
    const start=(i*seconds/events.length).toFixed(1),end=((i+1)*seconds/events.length).toFixed(1);
    return start+"–"+end+"s, scene "+(i+1)+": "+event.title+". "+event.description+" "+sceneWardrobePrompt(event,i)+" Keep this beat to one clear action; hold a readable medium shot before transitioning."+(event.location?" Setting: "+event.location+".":"");
  }).join("\n");
  return "Create ONE complete "+seconds+"-second vertical 9:16 animated personal love-story video containing "+(freeform?"all the moments in the story below, in their written order":"ALL "+events.length+" scenes below in this exact order")+". Total running time is "+seconds+" seconds, not per scene. "+characterDirection(style)+" Character consistency means the same "+(style===PHOTO_LIKENESS_STYLE?"faces":"cartoon designs")+", not the same outfits: change clothing according to each scene’s wardrobe instructions. Do not use the reference-photo clothes as the default wardrobe. Visual style: "+style+". "+(STORY_STYLE_DETAILS[style] || "")+" "+(part>1?"This is continuation part "+part+". "+continuationDirection(previousSummary)+" Preserve the same couple identity and visual style; show only the NEW scenes below, with no recap or repeated intro. ":"")+"\n"+timeline+"\nRender native full-frame portrait 9:16 footage, without letterboxing, wide inset panels or split screens. Use stable medium or medium-wide shots showing both partners; avoid extreme close-ups and rapid zooms. Prioritise the main action of each beat within its allotted time instead of squeezing in extra gestures. Connect scenes with short, gentle transitions. Use restrained blinking, natural silent smiles and consistent animated character designs and clothing within each beat. Do not repeat, omit or append scenes, and do not introduce wedding ceremonies unless described. "+ANIMATED_OPENING+" No text, captions, dates, logos or watermarks in footage; leave upper third clear for editable headings. No talking, dialogue, lip-sync, narration or singing; soft instrumental music only. No distorted faces or hands.";
}
