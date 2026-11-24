export function applyGeneratedClip(clips, clip, replaceUrl) {
  const existing=clips.findIndex(item=>item.videoUrl === clip.videoUrl);
  if(existing >= 0) return clips.map((item,i)=>i === existing?{...item,...clip,actualCostUsd:Number.isFinite(clip.actualCostUsd)?clip.actualCostUsd:item.actualCostUsd}:item);
  const replace=replaceUrl?clips.findIndex(item=>item.videoUrl === replaceUrl):-1;
  if(replace >= 0) return clips.map((item,i)=>i === replace?{...clip,editableDetails:item.editableDetails}:item);
  return [...clips,clip];
}
