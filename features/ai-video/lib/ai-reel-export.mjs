export const REEL_EXPORTS = {
  standard: {label:'Compact · 720p · smaller file',bitrate:2000000},
  high: {label:'High quality · 720p · larger file',bitrate:4000000},
};
export function clipWindow(duration, requestedStart=0.6){
  const end=Number.isFinite(duration)&&duration>0?duration:0;
  const start=Math.min(Math.max(0,Number(requestedStart)||0),Math.max(0,end-0.25));
  return {start,duration:end-start};
}
export function estimatedReelMegabytes(seconds,quality='standard',audio=true){
  return Math.max(0,seconds)*((REEL_EXPORTS[quality]||REEL_EXPORTS.standard).bitrate+(audio?128000:0))/8000000;
}
