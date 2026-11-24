export function completedReelRecord({id,clips,seconds,editor,now=Date.now()}){
 if(!clips.length)throw new Error('A finished reel needs at least one source clip.');
 const unique=[...new Map(clips.map(c=>[c.videoUrl,c])).values()];
 const known=unique.every(c=>Number.isFinite(c.actualCostUsd));
 const story=clips.every(c=>c.ceremony==='story');
 return {id,localReel:true,videoUrl:'local-reel:'+id,ceremony:story?'story':'combined',seconds,resolution:'720p',updated:now,clips:clips.map(c=>({...c})),editor,editableDetails:{title:story?'Complete story':'Complete wedding reel'},...(known?{actualCostUsd:Math.round(unique.reduce((n,c)=>n+c.actualCostUsd,0)*1e10)/1e10}:{})};
}

// A saved complete reel can be picked like a clip: it is expanded into its own clips in their order,
// so a new opening (or ending) can be added around an existing reel.
export function selectedReelSources(clips,orderedUrls){
 const items=orderedUrls.map(url=>clips.find(c=>c.videoUrl===url));
 if(items.some(c=>!c)||new Set(orderedUrls).size!==orderedUrls.length)throw new Error('Select at least two different available source clips.');
 const sources=items.flatMap(c=>c.localReel?(Array.isArray(c.clips)?c.clips:[]):[c]);
 if(sources.length<2||new Set(sources.map(c=>c.videoUrl)).size!==sources.length)throw new Error('Select at least two different available source clips. A clip that is already inside a selected complete reel cannot be added again.');
 if(sources.some(c=>(c.ceremony==='story')!==(sources[0].ceremony==='story')))throw new Error('Choose clips from the same video mode.');
 return sources;
}

// Keep the text, timing, trim and framing choices of any complete reel used in a new combination.
export function mergedReelEditor(clips,orderedUrls){
 const reels=orderedUrls.map(url=>clips.find(c=>c.videoUrl===url)).filter(c=>c?.localReel&&c.editor);
 if(!reels.length)return null;
 const merged={...reels[0].editor};
 for(const key of ['trims','sceneCuts','framing'])merged[key]=Object.assign({},...reels.map(r=>r.editor[key] || {}));
 return merged;
}
