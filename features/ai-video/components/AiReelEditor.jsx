"use client";
import { useEffect, useRef, useState } from "react";
import { download, readSavedDetails } from "@/features/ai-video/components/ui-helpers";
import {clipWindow,REEL_EXPORTS,estimatedReelMegabytes} from "@/features/ai-video/lib/ai-reel-export.mjs";
import {DEFAULT_LETTERING,drawReelLettering,occasionRevealProgress,reelEditKey,LETTER_FONTS,REEL_FONT_FILES,REEL_HEADING_FONTS,headingFontKey} from "@/features/ai-video/lib/ai-reel-lettering.mjs";
import {weddingSceneRanges,rangesWithCuts,CEREMONY_NAMES} from "@/features/ai-video/lib/ai-wedding-scenes.mjs";
import {drawFullScene} from "@/features/ai-video/lib/reel-framing.mjs";
import {drawCurtainReveal,curtainProgress,CURTAIN_STYLES} from "@/features/ai-video/lib/reel-curtain.mjs";
import {saveCompletedReel} from "@/features/ai-video/lib/ai-video-cache.mjs";
import {completedReelRecord} from "@/features/ai-video/lib/ai-completed-reel.mjs";
import AiReelCost from "@/features/ai-video/components/AiReelCost";
import SocialShareActions from "@/features/ai-video/components/SocialShareActions";

const defaults = [
  ["Shri Ganeshaya Namah", "", "", ""],
  ["Mehendi", "2027-02-12", "16:00", "Shree Krishna Lawns, Pune"],
  ["Haldi", "2027-02-13", "10:00", "Shree Krishna Lawns, Pune"],
  ["Sangeet", "2027-02-13", "19:00", "Shree Krishna Lawns, Pune"],
  ["Wedding", "2027-02-14", "11:30", "Shree Krishna Lawns, Pune"],
  ["Reception", "2027-02-14", "19:30", "Shree Krishna Lawns, Pune"],
].map(([title,date,time,venue]) => ({ title,date,time,venue }));
const plans = { "journey-opening": [[0,4/15,0],[4/15,9/15,1],[9/15,1,2]], "journey-finale": [[0,4/15,3],[4/15,11/15,4],[11/15,1,5]] };
export default function AiReelEditor({ clips, onRemove, loadClip, compact = false, details: sharedDetails, events: sharedEvents, music, musicSettings, reelId, reelTitle, initialEdit, onSavedReel, liveScenes, liveStoryScenes, onSelectClip }) {
  const canvas = useRef(null), video = useRef(null), frame = useRef(0);
  const [names,setNames] = useState(""), [events,setEvents] = useState(defaults), [look,setLook] = useState("gold"), [index,setIndex] = useState(0);
  const resolvedNames = sharedDetails ? [sharedDetails.brideName, sharedDetails.groomName].filter(Boolean).join(" & ") : names;
  const resolvedEvents = sharedDetails ? defaults.map((ev,i) => {
    if(i === 0) return {title:sharedDetails.blessing || ev.title,date:"",time:"",venue:""};
    const kind=["", "mehndi","haldi","sangeet","wedding","reception"][i];
    const event=sharedEvents?.find(e=>e.kind===kind);
    return {...ev,title:kind === "wedding" ? sharedDetails.title || ev.title : ev.title,date:event?.date || sharedDetails.date,time:event?.time || sharedDetails.time,venue:event?.venue || [sharedDetails.venue,sharedDetails.city].filter(Boolean).join(", ")};
  }) : events;
  const [lettering,setLettering]=useState(DEFAULT_LETTERING),[fontsReady,setFontsReady]=useState(0);
  // Load the heading fonts used on the reel, then repaint the preview.
  useEffect(()=>{if(typeof FontFace==="undefined"||typeof document==="undefined")return;for(const [family,url] of REEL_FONT_FILES){const face=new FontFace(family,"url("+url+")");face.load().then(f=>{document.fonts.add(f);setFontsReady(n=>n+1);}).catch(()=>{});}},[]);
  const [busy,setBusy] = useState(false), [progress,setProgress] = useState(0), [error,setError] = useState(""), [file,setFile] = useState(null);
  const savedId=useRef(null);
  useEffect(()=>{savedId.current=reelId || null;},[reelId]);
  const [saveMessage,setSaveMessage]=useState("");
  const restored=useRef(false);
  useEffect(() => { try { const saved=JSON.parse(sessionStorage.getItem("everymoment-ai-edit")||"null"); if(saved && typeof saved.names === "string" && Array.isArray(saved.events) && saved.events.length === 6) {setNames(saved.names);setEvents(saved.events);setLook(["gold","white","ivory","champagne","blush","rosegold","mint"].includes(saved.look)?saved.look:"gold");} else {const details=readSavedDetails();if(details)setNames([details.brideName,details.groomName].filter(Boolean).join(" & "));} }catch{} restored.current=true; },[]);
  useEffect(() => {if(restored.current)try{sessionStorage.setItem("everymoment-ai-edit",JSON.stringify({names,events,look}));}catch{}},[names,events,look]);
  const editKey=reelEditKey({names,events,look,clips,details:sharedDetails,sharedEvents,lettering,liveStoryScenes});
  useEffect(() => {setFile(null);},[editKey,music]);
  const [trims,setTrims]=useState({}),[sceneCuts,setSceneCuts]=useState({}),[framing,setFraming]=useState({}),[exportQuality,setExportQuality]=useState("standard");
  useEffect(()=>{if(initialEdit){setNames(initialEdit.names || "");setEvents(initialEdit.events || defaults);setLook(initialEdit.look || "gold");setTrims(initialEdit.trims || {});setSceneCuts(initialEdit.sceneCuts || {});setFraming(initialEdit.framing || {});setExportQuality(initialEdit.exportQuality || "standard");setLettering(initialEdit.lettering || DEFAULT_LETTERING);}},[initialEdit]);
  const [sources,setSources]=useState([]), [combined,setCombined]=useState(true), [playing,setPlaying]=useState(true), [muted,setMuted]=useState(true), [position,setPosition]=useState(0);
  const desiredPlaying=useRef(true), pendingSeek=useRef(0), musicPreview=useRef({ctx:null,source:null});
  const [seekRevision,setSeekRevision]=useState(0);
  const selectedIndex=Math.min(index,Math.max(0,clips.length-1));
  const mediaKey=clips.map(c=>`${c.videoUrl}:${c.token || ""}`).join("|");
  const selected=clips[selectedIndex], previewUrl=sources[selectedIndex]?.url;
  const windows=clips.map((c,i)=>clipWindow(sources[i]?.duration || c.seconds || 15,trims[c.videoUrl] ?? 0.6));
  const selectedTrim=windows[selectedIndex]?.start || 0;
  const durations=windows.map(w=>w.duration);
  useEffect(()=>{setFile(null);},[trims,sceneCuts,framing,exportQuality]);
  const totalDuration=durations.reduce((a,b)=>a+b,0);
  const startOffset=durations.slice(0,selectedIndex).reduce((a,b)=>a+b,0);
  useEffect(() => {
    let alive=true;const urls=[];setSources([]);setPosition(0);
    Promise.all(clips.map(async clip=>{
      const blob=await loadClip(clip);if(!alive)return null;
      const url=URL.createObjectURL(blob);urls.push(url);
      const duration=await new Promise((resolve,reject)=>{const v=document.createElement("video");v.preload="metadata";v.onloadedmetadata=()=>{resolve(v.duration);v.removeAttribute("src");v.load();};v.onerror=()=>reject(new Error("Could not read clip duration."));v.src=url;});
      return {url,duration};
    })).then(next=>{if(alive){setSources(next);setError("");}}).catch(e=>{if(alive){setError(e.message);setPlaying(false);desiredPlaying.current=false;}});
    return()=>{alive=false;urls.forEach(URL.revokeObjectURL);};
  },[mediaKey]); // eslint-disable-line react-hooks/exhaustive-deps
  function unlockMusic(){if(!compact)return;try{const state=musicPreview.current;if(!state.ctx)state.ctx=new AudioContext();void state.ctx.resume().catch(()=>{});}catch{}}
  useEffect(()=>{
    const state=musicPreview.current;
    if(video.current)video.current.muted=compact || muted;
    if(!compact || !music || muted || !playing || busy || !previewUrl)return;
    try{if(!state.ctx)state.ctx=new AudioContext();const source=state.ctx.createBufferSource();source.buffer=music;source.loop=true;source.connect(state.ctx.destination);source.start(0,(startOffset+Math.max(0,(video.current?.currentTime || 0)-selectedTrim))%music.duration);state.source=source;void state.ctx.resume().catch(()=>{});return()=>{try{source.stop();source.disconnect();}catch{}if(state.source===source)state.source=null;};}catch{}
  },[compact,music,muted,playing,busy,selectedIndex,previewUrl,seekRevision,selectedTrim]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>()=>{const state=musicPreview.current;try{state.source?.stop();}catch{}void state.ctx?.close().catch(()=>{});},[]);
  function playback(value){if(value)unlockMusic();desiredPlaying.current=value;setPlaying(value);if(value)video.current?.play().catch(()=>{});else video.current?.pause();}
  function seekFull(t){setSeekRevision(n=>n+1);let i=0,local=t;while(i<durations.length-1&&local>=durations[i]){local-=durations[i];i++;}pendingSeek.current=local;setPosition(t);if(i===selectedIndex&&video.current)video.current.currentTime=local+(windows[i]?.start || 0);else setIndex(i);}
  function playAll(){setCombined(true);seekFull(0);playback(true);}
  function clipEnded(){if(combined&&selectedIndex<clips.length-1){pendingSeek.current=0;setIndex(selectedIndex+1);}else playback(false);}
  function loadedPreview(){if(video.current){video.current.currentTime=selectedTrim+pendingSeek.current;video.current.muted=compact || muted;setSeekRevision(n=>n+1);if(desiredPlaying.current)video.current.play().catch(()=>{});}}
  function changeTrim(clip,value){setTrims(list=>({...list,[clip.videoUrl]:value}));if(selected?.videoUrl===clip.videoUrl&&video.current){pendingSeek.current=0;const start=clipWindow(sources[selectedIndex]?.duration || clip.seconds || 15,value).start;video.current.currentTime=start;setPosition(startOffset);setSeekRevision(n=>n+1);}}
  const stamp=t=>Math.floor(t/60)+":"+String(Math.floor(t%60)).padStart(2,"0");
  const previewControls=<><div className="preview-actions"><button type="button" disabled={busy||!sources.length} onClick={playAll}>▶ Play full reel</button><button type="button" disabled={busy||!sources.length} onClick={()=>playback(!playing)}>{playing?"❚❚ Pause":"▶ Play"}</button><button type="button" onClick={()=>{unlockMusic();setMuted(!muted);if(video.current)video.current.muted=compact || !muted;}}>{muted?"Sound off":"Sound on"}</button></div><label className="hint">{combined?"Combined preview":"Clip preview"} · {stamp(position)} / {stamp(totalDuration)}<input aria-label="Full reel position" type="range" min={0} max={totalDuration} step={0.1} value={Math.min(position,totalDuration)} disabled={busy||!sources.length} onChange={e=>{setCombined(true);seekFull(Number(e.target.value));}} style={{width:"100%"}}/></label></>;
  function paint(v,clip,time=v.currentTime,duration=v.duration) {
    const c=canvas.current, ctx=c?.getContext("2d"); if(!ctx || !(v.videoWidth || v.width)) return;
    {const fr=framing[clip.videoUrl] || {mode:"fill",focusX:50};
    // Pan mode: fill the screen and glide slowly across a wide clip so every guest is seen, with no bars.
    if(fr.mode==="pan"){const start=trims[clip.videoUrl] ?? 0.6,len=Math.max(0.5,(duration||15)-start),p=Math.min(1,Math.max(0,(time-start)/len)),eased=p*p*(3-2*p),from=fr.panFrom ?? 0,to=fr.panTo ?? 100;drawFullScene(ctx,v,c.width,c.height,{mode:"fill",zoom:100,focusX:from+(to-from)*eased});}
    else drawFullScene(ctx,v,c.width,c.height,fr);}
    const fraction=time/(duration||15), plan=plans[clip.ceremony];
    const single={opening:0,blessing:0,engagement:4,sagan:4,cocktail:4,baraat:4,mehndi:1,haldi:2,sangeet:3,wedding:4,reception:5,custom:4};
    const weddingRange=clip.weddingScenes?.length?(rangesWithCuts(weddingSceneRanges(clip.weddingScenes,clip.ceremony,duration||15),sceneCuts[clip.videoUrl],duration||15).find(r=>time>=r.start&&time<r.end) || null):null;
    const weddingScene=weddingRange?.scene || (clip.weddingScenes?.length?clip.weddingScenes.at(-1):null);
    const sceneEvent=resolvedEvents[weddingScene ? single[weddingScene.kind] : plan ? (plan.find(([a,b])=>fraction>=a&&fraction<b)?.[2] ?? plan.at(-1)[2]) : (single[clip.ceremony]??4)];
    // The common reel form is the single source for lettering details: each ceremony uses its own
    // date/time/venue from "Your functions", falling back to the main wedding details when left empty.
    const baseEvent=sharedDetails && weddingScene ? {...sceneEvent,date:sceneEvent.date || sharedDetails.date,time:sceneEvent.time || sharedDetails.time,venue:sceneEvent.venue || [sharedDetails.venue,sharedDetails.city].filter(Boolean).join(", ")} : sceneEvent;
    const savedStory=clip.storyScene?.scenes?.[Math.min(clip.storyScene.scenes.length-1,Math.floor(fraction*clip.storyScene.scenes.length))] || clip.storyScene;
    // Story text (title, location, date) follows the live story form, so edits show without regenerating.
    const liveStory=savedStory?.id?liveStoryScenes?.find(s=>s.id===savedStory.id):null;
    const storyEvent=liveStory?{...savedStory,title:liveStory.title,location:liveStory.location,date:liveStory.date}:savedStory;
    // Each ceremony card owns its title, date, time and venue; the live card wins so edits after generation show without regenerating.
    const liveScene=weddingScene?(liveScenes?.find(s=>s.id===weddingScene.id&&s.kind===weddingScene.kind) || weddingScene):null;
    const mainVenue=sharedDetails?[sharedDetails.venue,sharedDetails.city].filter(Boolean).join(", "):"";
    const ev={...baseEvent,...(weddingScene?{title:liveScene.title || weddingScene.title || CEREMONY_NAMES[weddingScene.kind],date:liveScene.date || (sharedDetails?sharedDetails.date:baseEvent.date),time:liveScene.time || (sharedDetails?sharedDetails.time:baseEvent.time),venue:liveScene.venue || (sharedDetails?mainVenue:baseEvent.venue),theme:liveScene.theme || weddingScene.theme || ""}:{}),...(storyEvent?{title:storyEvent.title || "Our story",date:storyEvent.date || "",time:"",venue:storyEvent.location || ""}:{}),...clip.editableDetails};
    const sceneProgress=weddingRange?(time-weddingRange.start)/(weddingRange.end-weddingRange.start):1;
    // An opening clip (e.g. a Ganpati intro) can run without any ceremony text.
    // Curtain reveal at the start of the clip (default for the opening clip).
    {const curtain=framing[clip.videoUrl]?.curtain || (clip.weddingScenes?.[0]?.kind==="opening"?"royal":"none");if(curtain!=="none"){const start=trims[clip.videoUrl] ?? 0.6;drawCurtainReveal(ctx,c.width,c.height,curtainProgress(time-start),curtain);}}
    if(!framing[clip.videoUrl]?.noText&&weddingScene?.kind!=="opening")drawReelLettering(ctx,{event:ev,names:resolvedNames,look,lettering,panel:clip.weddingLayout==="invitation",reveal:weddingRange?occasionRevealProgress(sceneProgress):1});
  }
  useEffect(() => {
    const draw=()=>{if(!busy&&video.current&&selected&&!video.current.seeking&&video.current.currentTime>=selectedTrim)paint(video.current,selected);frame.current=requestAnimationFrame(draw);};draw();return()=>cancelAnimationFrame(frame.current);
  },[selected,names,events,look,busy,sharedDetails,sharedEvents,selectedTrim,lettering,liveScenes,liveStoryScenes,sceneCuts,framing,fontsReady]); // eslint-disable-line react-hooks/exhaustive-deps
  async function exportVideo(downloadFile=true) {
    setBusy(true);setError("");setSaveMessage("");setProgress(0);setFile(null);playback(false);
    const inputs=[];let output;
    try {
      const mb=await import("mediabunny");const codec=await mb.getFirstEncodableVideoCodec(["avc"],{width:720,height:1280,frameRate:24});if(!codec)throw new Error("MP4 export needs a browser with H.264 encoding. Try current Chrome or Edge.");
      output=new mb.Output({format:new mb.Mp4OutputFormat({fastStart:"in-memory"}),target:new mb.BufferTarget()});
      const source=new mb.CanvasSource(canvas.current,{codec,bitrate:REEL_EXPORTS[exportQuality].bitrate});output.addVideoTrack(source,{frameRate:24});
      const loaded=[];
      for(const clip of clips){const blob=await loadClip(clip);const input=new mb.Input({formats:mb.ALL_FORMATS,source:new mb.BlobSource(blob)});inputs.push(input);const track=await input.getPrimaryVideoTrack();if(!track || !await track.canDecode())throw new Error("Clip could not be decoded in this browser.");const duration=await track.computeDuration();loaded.push({sink:new mb.CanvasSink(track,{poolSize:2}),clip,blob,duration,window:clipWindow(duration,trims[clip.videoUrl] ?? 0.6)});}
      const total=loaded.reduce((s,{window})=>s+Math.ceil(window.duration*24)/24,0);
      const {generateMusic,musicForDuration}=await import("@/features/ai-video/lib/music");const audio=compact ? await musicForDuration(music,total) : await generateMusic("festive",total);const ac=audio ? await mb.getFirstEncodableAudioCodec(["aac"],{numberOfChannels:audio.numberOfChannels,sampleRate:audio.sampleRate}) : null;let audioSource;if(ac){audioSource=new mb.AudioBufferSource({codec:ac,bitrate:128000});output.addAudioTrack(audioSource);}
      await output.start();if(audioSource)await audioSource.add(audio);
      let offset=0;
      for(const {sink,clip,window,duration} of loaded){
        const frames=Math.ceil(window.duration*24),times=Array.from({length:frames},(_,f)=>Math.min(window.start+f/24,Math.max(0,duration-.001)));let f=0;
        for await(const sample of sink.canvasesAtTimestamps(times)){
          if(!sample)throw new Error("A frame could not be decoded. Try another saved MP4.");
          paint(sample.canvas,clip,times[f],duration);await source.add(offset+f/24,1/24);
          if(f%12===0)setProgress((offset+f/24)/total);f++;
        }
        offset+=frames/24;
      }
      source.close();audioSource?.close();await output.finalize();const result=new File([output.target.buffer],"wedding-invitation-reel.mp4",{type:"video/mp4"});setFile(result);setProgress(1);
      if(downloadFile)download(result,result.name);
      try{
        const id=reelId || savedId.current || crypto.randomUUID();savedId.current=id;
        const editor={names,events,look,lettering,trims,sceneCuts,framing,exportQuality,details:sharedDetails,sharedEvents,musicSettings};
        const record=completedReelRecord({id,clips,seconds:total,editor});if(reelTitle)record.editableDetails.title=reelTitle;
        await saveCompletedReel(record,result,loaded.map(({clip,blob})=>({clip,blob})));
        setSaveMessage("Complete reel saved in this browser. Find it at the top of your video gallery.");onSavedReel?.(record);
      }catch{setSaveMessage("The MP4 is ready, but browser storage could not save it. Download a copy before leaving this page.");}
    }catch(e){await output?.cancel().catch(()=>{});setError(e.message||"Could not export this video. Try uploading the saved MP4.");}finally{inputs.forEach(input=>input.dispose());setBusy(false);}
  }
  // Text timing: the AI does not always cut between ceremonies at the planned second, so the owner can move each change.
  function sceneCutInputs(clip,i){
    const scenes=clip.weddingScenes;if(!scenes || scenes.length<2)return null;
    const length=sources[i]?.duration || clip.seconds || 15,planned=weddingSceneRanges(scenes,clip.ceremony,length);
    const current=sceneCuts[clip.videoUrl] || planned.slice(1).map(r=>Number(r.start.toFixed(1)));
    return scenes.slice(1).map((scene,k)=><label key={clip.videoUrl+':cut:'+k}>Clip {i+1} · {scene.title || CEREMONY_NAMES[scene.kind]} text starts at (seconds)<input type="number" min="0" max={length} step="0.1" value={current[k]} onChange={e=>{const next=[...current];next[k]=e.target.value===''?'':Number(e.target.value);setSceneCuts(list=>({...list,[clip.videoUrl]:next}));}}/><button type="button" disabled={selected?.videoUrl!==clip.videoUrl || !video.current} onClick={()=>{if(!video.current)return;const next=[...current];next[k]=Number(video.current.currentTime.toFixed(1));setSceneCuts(list=>({...list,[clip.videoUrl]:next}));}}>Use current time</button></label>);
  }
  const exportSettings=<fieldset className="ai-export-settings" disabled={busy||!clips.length}><legend>Reel finishing · free on this device</legend><div className="fields two"><label>Lettering colour<select value={look} onChange={e=>setLook(e.target.value)}><option value="gold">Elegant gold</option><option value="white">Classic white</option><option value="ivory">Soft ivory</option><option value="champagne">Champagne</option><option value="blush">Blush pink</option><option value="rosegold">Rose gold</option><option value="mint">Mint</option></select></label><label>Text style<select value={lettering.surface || "none"} onChange={e=>setLettering(v=>({...v,surface:e.target.value}))}><option value="none">Text on the video (fade or box below)</option><option value="banner">Cream invitation banner at the top</option><option value="board">Dark board in the lower half</option><option value="arch">Arched invitation card in the middle</option></select></label><label>Text background<select value={lettering.backdrop || "fade"} onChange={e=>setLettering(v=>({...v,backdrop:e.target.value}))}><option value="fade">Soft dark fade (default)</option><option value="strong">Stronger fade · best on bright videos</option><option value="box">Dark box behind the text</option><option value="none">No background · shadow only</option></select></label><label>Ceremony heading size<select value={lettering.heading} onChange={e=>setLettering(v=>({...v,heading:Number(e.target.value)}))}><option value={40}>Small</option><option value={48}>Regular</option><option value={58}>Large</option><option value={68}>Extra large</option></select></label><label>Heading font<select value={headingFontKey(lettering,lettering.surface || "none")} onChange={e=>setLettering(v=>({...v,headingFont:e.target.value}))}>{Object.entries(REEL_HEADING_FONTS).map(([id,f])=><option key={id} value={id}>{f.label}</option>)}</select></label><label>Venue / address size<select value={lettering.address} onChange={e=>setLettering(v=>({...v,address:Number(e.target.value)}))}><option value={26}>Small</option><option value={30}>Regular</option><option value={36}>Large</option><option value={42}>Extra large</option></select></label></div><label>Lettering font<select value={lettering.font} onChange={e=>setLettering(v=>({...v,font:e.target.value}))}>{LETTER_FONTS.map(f=><option key={f}>{f}</option>)}</select></label><p className="hint small">Skip the first 0.6 seconds of each clip by default to remove the reference-photo opening. Increase it if the photo stays longer, or set 0 to keep the full clip. Preview and download use the same trim; total duration becomes shorter.</p>{clips.map((clip,i)=><label key={clip.videoUrl}>Clip {i+1} · skip opening (seconds)<input type="number" min="0" max={Math.max(0,(sources[i]?.duration || clip.seconds || 15)-0.25)} step="0.1" value={trims[clip.videoUrl] ?? 0.6} onChange={e=>changeTrim(clip,e.target.value)}/></label>)}{clips.length>1&&<button type="button" onClick={()=>setFraming(list=>Object.fromEntries(clips.map(c=>[c.videoUrl,{...(list[c.videoUrl] || {}),mode:"pan",panFrom:list[c.videoUrl]?.panFrom ?? 0,panTo:list[c.videoUrl]?.panTo ?? 100}])))}>Use slow pan for all clips</button>}{clips.map((clip,i)=>{const f=framing[clip.videoUrl] || {mode:"fill",focusX:50},setF=patch=>setFraming(list=>({...list,[clip.videoUrl]:{...f,...patch}}));return <div key={clip.videoUrl+':frame'}><label>Clip {i+1} · video framing<select value={f.mode} onChange={e=>setF({mode:e.target.value})}><option value="fill">Fill the screen (crops the sides of a wide video)</option><option value="pan">Fill the screen and slowly pan across (shows everyone, no bars)</option><option value="invite">Invitation layout · whole video below, designed space on top (no blur)</option><option value="fit">Show the whole video (blurred bars)</option></select></label><label>Clip {i+1} · curtain reveal at the start<select value={f.curtain || (clip.weddingScenes?.[0]?.kind==="opening"?"royal":"none")} onChange={e=>setF({curtain:e.target.value})}>{Object.entries(CURTAIN_STYLES).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label className="ai-auto-suggest"><input type="checkbox" checked={!!f.noText} onChange={e=>setF({noText:e.target.checked})}/>Clip {i+1} · no text on this clip (for an opening or ending)</label>{f.mode==="pan"&&<label>Clip {i+1} · pan direction<select value={(f.panFrom ?? 0)<=(f.panTo ?? 100)?"lr":"rl"} onChange={e=>setF(e.target.value==="lr"?{panFrom:0,panTo:100}:{panFrom:100,panTo:0})}><option value="lr">Left to right</option><option value="rl">Right to left</option></select></label>}{f.mode==="invite"&&<><label>Clip {i+1} · top background<select value={f.background || "cream"} onChange={e=>setF({background:e.target.value})}><option value="cream">Cream invitation</option><option value="night">Night (plum and gold)</option></select></label><label>Clip {i+1} · video size: whole video ↔ bigger<input type="range" min="0" max="100" step="1" value={f.zoom ?? 75} onChange={e=>setF({zoom:Number(e.target.value)})}/></label></>}{f.mode==="fill"&&<><label>Clip {i+1} · zoom: show more people ↔ fill the screen<input type="range" min="0" max="100" step="1" value={f.zoom ?? 100} onChange={e=>setF({zoom:Number(e.target.value)})}/></label><label>Clip {i+1} · keep visible: left ↔ right<input type="range" min="0" max="100" step="1" value={f.focusX ?? 50} onChange={e=>setF({focusX:Number(e.target.value)})}/></label></>}</div>;})}{clips.map((clip,i)=>sceneCutInputs(clip,i))}{clips.some(c=>c.weddingScenes?.length>1)&&<p className="hint small">Play the reel and set the second when each ceremony really appears, so its name, date and venue change with the scene. No credits are used.</p>}<label>Download quality and file size<select value={exportQuality} onChange={e=>setExportQuality(e.target.value)}>{Object.entries(REEL_EXPORTS).map(([id,q])=><option key={id} value={id}>{q.label}</option>)}</select></label><p className="hint small">Both downloads are 720 × 1280 H.264 MP4. Compact uses 2 Mbps; High quality uses 4 Mbps, so the higher-quality file is about twice as large: approximately {estimatedReelMegabytes(totalDuration,exportQuality,compact?!!music:true).toFixed(1)} MB. Actual size varies. Trimming, joining and compression use no API credits. The original provider MP4 is unchanged.</p></fieldset>;
  if (compact) return <section aria-label="Generated video reel preview"><p className="preview-label">LIVE PREVIEW · FULL SCENE</p><div className="phone ai-preview-phone"><canvas ref={canvas} width={720} height={1280} className="invite-canvas" />{!selected && <div className="ai-empty-preview"><span aria-hidden="true">＋</span><p>Upload a photo to create your video</p><small>Your generated video will appear here</small></div>}</div>{selected && <video ref={video} src={previewUrl || undefined} playsInline muted style={{display:"none"}} onLoadedData={loadedPreview} onEnded={clipEnded} onTimeUpdate={()=>setPosition(startOffset+Math.max(0,(video.current?.currentTime||0)-selectedTrim))} />}{previewControls}<AiReelCost clips={clips} seconds={totalDuration} /><div className="download-box">{exportSettings}{clips.map((clip,i)=><button className="ai-clip-button" aria-pressed={selectedIndex === i} disabled={busy} type="button" key={clip.videoUrl} onClick={()=>{setCombined(false);pendingSeek.current=0;if(i===selectedIndex&&video.current)video.current.currentTime=windows[i].start;setIndex(i);playback(true);onSelectClip?.(clip);}}>Clip {i+1}: {clip.weddingScenes?.map(s=>s.title || CEREMONY_NAMES[s.kind]).join(", ") || clip.storyScene?.title || clip.ceremony}</button>)}<button type="button" className="primary" disabled={busy||!clips.length} onClick={()=>void exportVideo(false)}>Save complete reel to gallery</button><button type="button" className="primary" disabled={busy||!clips.length} onClick={()=>void exportVideo(true)}>{busy?`Making your reel… ${Math.round(progress*100)}%`:"↓ Download reel (MP4, 9:16 HD)"}</button>{saveMessage&&<p role="status" className="hint">{saveMessage}</p>}{error&&<p role="alert" className="error">{error}</p>}{file&&<><p role="status" className="hint">Reel ready · {(file.size/1000000).toFixed(1)} MB</p><SocialShareActions file={file} type="invitation reel"/></>}</div></section>;
  return <section className="ai-reel-editor" aria-label="Edit generated reel"><h2>Create your reel</h2><p className="hint">Names, dates and venues below stay editable. Opening + finale clips together make the full wedding film. Export uses instrumental music from the site.</p>
    <div className="ai-editor-grid"><fieldset disabled={busy}><legend>Your invitation details</legend>
      <label>Couple names<input value={names} maxLength={80} onChange={e=>setNames(e.target.value)}/></label>
      <label>Lettering<select value={look} onChange={e=>setLook(e.target.value)}><option value="gold">Elegant gold</option><option value="white">Classic white</option><option value="ivory">Soft ivory</option><option value="champagne">Champagne</option><option value="blush">Blush pink</option><option value="rosegold">Rose gold</option><option value="mint">Mint</option></select></label><label>Text style<select value={lettering.surface || "none"} onChange={e=>setLettering(v=>({...v,surface:e.target.value}))}><option value="none">Text on the video (fade or box below)</option><option value="banner">Cream invitation banner at the top</option><option value="board">Dark board in the lower half</option><option value="arch">Arched invitation card in the middle</option></select></label><label>Text background<select value={lettering.backdrop || "fade"} onChange={e=>setLettering(v=>({...v,backdrop:e.target.value}))}><option value="fade">Soft dark fade (default)</option><option value="strong">Stronger fade · best on bright videos</option><option value="box">Dark box behind the text</option><option value="none">No background · shadow only</option></select></label>
      {events.map((ev,i)=><details key={i}><summary>{ev.title}</summary>{["title","date","time","venue"].map(key=><label key={key}>{key}<input type={key==="date"?"date":key==="time"?"time":"text"} maxLength={80} value={ev[key]} onChange={e=>setEvents(list=>list.map((v,j)=>j===i?{...v,[key]:e.target.value}:v))}/></label>)}</details>)}
      {clips.map((clip,i)=><p key={clip.videoUrl}><button type="button" onClick={()=>setIndex(i)}>Preview {i+1}: {clip.ceremony}</button> <button type="button" onClick={()=>{onRemove(i);setIndex(0);}}>Remove</button></p>)}
    </fieldset><div><canvas ref={canvas} width={720} height={1280} className="ai-editor-canvas"/>{selected&&<video key={selected.videoUrl} ref={video} src={previewUrl || undefined} controls playsInline muted={muted} onLoadedData={loadedPreview} onEnded={clipEnded} onPlay={()=>{desiredPlaying.current=true;setPlaying(true);}} onPause={()=>{if(!video.current?.ended){desiredPlaying.current=false;setPlaying(false);}}} onTimeUpdate={()=>setPosition(startOffset+Math.max(0,(video.current?.currentTime||0)-selectedTrim))} className="ai-editor-source"/>}{previewControls}<AiReelCost clips={clips} seconds={totalDuration} /><p className="hint small">Use the video controls to play or scrub the preview above. The full scene stays visible; extra portrait space uses a blurred background.</p>
      {exportSettings}<button type="button" className="primary" disabled={busy||!clips.length} onClick={()=>void exportVideo(true)}>{busy?`Exporting ${Math.round(progress*100)}%` : "Download edited reel (MP4)"}</button>{error&&<p role="alert">{error}</p>}{file&&<SocialShareActions file={file} type="invitation reel"/>}
    </div></div></section>;
}
