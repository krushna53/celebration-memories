export const ANIMATED_OPENING = 'Begin directly inside the first described animated setting with an establishing medium-wide shot and action already in motion. Use the photo only for character identity, never as a displayed photo, static portrait, collage, slideshow or opening face close-up. Render stylized animated faces, clothing and surroundings from the opening moment; no photorealistic photo-to-cartoon reveal.';
export function continuationDirection(summary=''){
  return 'Continue the previous video from its supplied final animated frame. This frame is continuity reference, not a new photo introduction. Keep the same animated couple and art style, carry movement naturally into the NEW action, then transition to the requested next setting and outfits. No restart, repeated opening portrait, frozen reference frame, recap or replay of earlier events. Previous events (context only, do not replay): '+summary.slice(0,3000)+'.';
}
// Runs only in the browser, on an existing clip. It makes no generation/API call.
export async function continuationFrame(blob){
  const url=URL.createObjectURL(blob),v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';
  function wait(event,action){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>done(new Error('Could not read the last video frame. Try again.')),20000);function done(error){clearTimeout(timer);v.removeEventListener(event,ok);v.removeEventListener('error',bad);error?reject(error):resolve();}function ok(){done();}function bad(){done(new Error('The previous video cannot be decoded.'));}v.addEventListener(event,ok,{once:true});v.addEventListener('error',bad,{once:true});action();});}
  try{
    await wait('loadeddata',()=>{v.src=url;});
    if(!Number.isFinite(v.duration)||!v.videoWidth)throw new Error('The previous video has no readable ending.');
    const time=Math.max(0,v.duration-0.1);if(time>0)await wait('seeked',()=>{v.currentTime=time;});
    const scale=Math.min(1,1280/Math.max(v.videoWidth,v.videoHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(v.videoWidth*scale);canvas.height=Math.round(v.videoHeight*scale);canvas.getContext('2d').drawImage(v,0,0,canvas.width,canvas.height);
    const image=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.9));if(!image)throw new Error('Could not prepare the continuation frame.');
    return new File([image],'previous-clip-ending.jpg',{type:'image/jpeg'});
  }finally{v.removeAttribute('src');v.load();URL.revokeObjectURL(url);}
}
