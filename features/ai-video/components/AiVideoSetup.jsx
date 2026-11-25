"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { FULL_PROMPT_LIMIT, CONTINUATION_SUMMARY_LIMIT } from "@/features/ai-video/lib/ai-video-limits.mjs";
import { applyGeneratedClip } from "@/features/ai-video/lib/ai-clip-update.mjs";
import {cachedVideo,saveVideoCopy,completedReels,renameCompletedReel} from "@/features/ai-video/lib/ai-video-cache.mjs";
import {hasRepeatedGenerationPrompt,REPEATED_PROMPT_ERROR,storyContinuationContext,savedStoryContext} from "@/features/ai-video/lib/ai-prompt-audit.mjs";
import {continuationFrame} from "@/features/ai-video/lib/ai-continuation.mjs";
import AiReelCost from "@/features/ai-video/components/AiReelCost";
import AiWeddingScenes from "@/features/ai-video/components/AiWeddingScenes";
import {weddingSceneDefaults,weddingScenesPrompt,validWeddingScenes,migrateWeddingScenes,CEREMONY_LABELS} from "@/features/ai-video/lib/ai-wedding-scenes.mjs";
import AiStoryBuilder from "@/features/ai-video/components/AiStoryBuilder";
import AiSavedVideos from "@/features/ai-video/components/AiSavedVideos";
import { PHOTO_LIKENESS_STYLE, STORY_STYLES, storyFilmPrompt, newStoryEvent } from "@/features/ai-video/lib/ai-story.mjs";
import { creditUnits, creditCents } from "@/features/ai-video/lib/ai-credits.mjs";
import AiReelEditor from "@/features/ai-video/components/AiReelEditor";
import { AI_CEREMONIES, AI_WEDDING_STYLES } from "@/features/ai-video/lib/ai-wedding-prompt.mjs";
import GenerationCostDialog from "@/features/ai-video/components/GenerationCostDialog";
import { AI_VIDEO_MODELS, estimateAiVideo } from "@/features/ai-video/lib/ai-video-pricing.mjs";

const fileData = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error("Could not read this photo.")); r.readAsDataURL(file); });
async function digest(file) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())), (n) => n.toString(16).padStart(2, "0")).join(""); }
export default function AiVideoSetup({ renderEditor, editorProps = {}, mode, onModeChange,onRestoreReel, topFields = null, hideSaved = false }) {
  const [photo, setPhoto] = useState(null), [preview, setPreview] = useState("");
  const [sharedPhoto,setSharedPhoto]=useState(null),[reusePhoto,setReusePhoto]=useState(true);
  const [model, setModel] = useState(AI_VIDEO_MODELS[0].id), [resolution, setResolution] = useState("720p"), [seconds, setSeconds] = useState(15);
  const [style, setStyle] = useState("Marathi wedding"), [ceremony, setCeremony] = useState("film-part-1");
  const [storyMode,setStoryMode]=useState(false),[storyEvents,setStoryEvents]=useState([{id:"story-1",title:"",description:"",location:"",date:""}]),[storyAnimation,setStoryAnimation]=useState(PHOTO_LIKENESS_STYLE);
  const storyProject=useRef("");
  const [storyPart,setStoryPart]=useState(1),[previousStory,setPreviousStory]=useState("");
  const [recoverable,setRecoverable]=useState([]);
  useEffect(()=>{try{const clips=JSON.parse(sessionStorage.getItem("everymoment-ai-clips") || "[]");if(Array.isArray(clips)&&clips.length>1)setRecoverable(clips);}catch{}},[]);
  const [localReels,setLocalReels]=useState([]),[editingReel,setEditingReel]=useState(null),[currentReelId,setCurrentReelId]=useState(null);
  useEffect(()=>{void completedReels().then(setLocalReels).catch(()=>{});},[]);
  function reelSaved(record){setLocalReels(list=>[record,...list.filter(r=>r.id!==record.id)]);setCurrentReelId(record.id);}
  async function refreshGallery(){try{setLocalReels(await completedReels());}catch{setHistoryError("Could not read completed reels from this browser.");}await loadHistory();}
  const [history,setHistory]=useState([]),[historyBusy,setHistoryBusy]=useState(false),[historyError,setHistoryError]=useState("");

  const [previousVideo,setPreviousVideo]=useState("");
  const [continuationPhoto,setContinuationPhoto]=useState(false);
  const [weddingDraft,setWeddingDraft]=useState({}),[weddingLayout,setWeddingLayout]=useState("cinematic"),[weddingLook,setWeddingLook]=useState("likeness");
  const weddingKey=style+":"+ceremony;
  const weddingScenes=useMemo(()=>weddingDraft[weddingKey] || weddingSceneDefaults(style,ceremony),[weddingDraft,weddingKey,style,ceremony]);
  function changeWeddingStyle(nextStyle){setWeddingDraft(list=>({...list,[nextStyle+":"+ceremony]:migrateWeddingScenes(weddingScenes,nextStyle)}));setStyle(nextStyle);}
  const [promptDraft, setPromptDraft] = useState(null);
  const promptKey = storyMode ? JSON.stringify([storyEvents,storyAnimation,seconds,storyPart,previousStory]) : JSON.stringify([style,ceremony,seconds,previousVideo,weddingScenes,weddingLayout,weddingLook]);
  const defaultPrompt = useMemo(() => storyMode ? storyFilmPrompt(storyEvents,{style:storyAnimation,seconds,part:storyPart,previousSummary:previousStory}) : weddingScenesPrompt({style,ceremony,seconds,scenes:weddingScenes,layout:weddingLayout,look:weddingLook,previousCeremony:previousVideo}), [style, ceremony, seconds, storyMode, storyEvents, storyAnimation, storyPart, previousStory, previousVideo,weddingScenes,weddingLayout,weddingLook]);
  const promptText = promptDraft?.key === promptKey ? promptDraft.text : defaultPrompt;
  const [clips, setClips] = useState([]);
  const [accessCode, setAccessCode] = useState(""), [config, setConfig] = useState(null);
  const [error, setError] = useState(""), [quote, setQuote] = useState(null), [busy, setBusy] = useState(false);
  const [job, setJob] = useState(null), [token, setToken] = useState(""), [polling, setPolling] = useState(false);
  const [refreshingCharge, setRefreshingCharge] = useState(false), [chargeMessage, setChargeMessage] = useState("");
  const chargeLock = useRef(false);
  useEffect(() => { setChargeMessage(""); }, [token]);
  const [workspaceStarted,setWorkspaceStarted] = useState(false);
  const photoInput=useRef(null), editForm=useRef(null), replacement=useRef(null);
  const [editingClip,setEditingClip]=useState(null);
  const [selectingClip,setSelectingClip]=useState(false);
  const mediaCache=useRef(new Map()),selectLock=useRef(false);
  const [continuingVideo,setContinuingVideo]=useState(false);
  useEffect(()=>{if(mode){setContinuingVideo(false);setPreviousVideo("");if(continuationPhoto){setPhoto(sharedPhoto);setReusePhoto(!!sharedPhoto);}setContinuationPhoto(false);setStoryMode(mode === "story");if(mode === "story"&&!storyProject.current){storyProject.current=crypto.randomUUID();setSeconds(15);}}},[mode]);
  useEffect(() => { if (workspaceStarted) try { sessionStorage.setItem("everymoment-ai-clips", JSON.stringify(clips.filter(c => c.videoUrl.startsWith("https://")))); } catch {} }, [clips,workspaceStarted]);
  useEffect(() => { if(job?.state === "done" && job.videoUrl){const clip={videoUrl:job.videoUrl,ceremony:job.ceremony,token,storyScene:job.storyScene,seconds:job.seconds,actualCostUsd:job.actualCostUsd,customPrompt:job.customPrompt,style:job.style,weddingScenes:job.weddingScenes,weddingLayout:job.weddingLayout};setClips(list=>applyGeneratedClip(list,clip,replacement.current?.token === token?replacement.current.videoUrl:null));} },[job,token]);
  useEffect(()=>{if(job?.state === "done"&&job.videoUrl&&token){void loadClip({videoUrl:job.videoUrl,token},AbortSignal.timeout(60000)).catch(()=>{});}},[job?.state,job?.videoUrl,token]); // eslint-disable-line react-hooks/exhaustive-deps
  const lock = useRef(false), version = useRef(0);
  const estimate = useMemo(() => estimateAiVideo({ model, resolution, seconds }), [model, resolution, seconds]);
  const accessReady = config?.ready && (config.accessRequired === false || Boolean(accessCode));
  const active = selectingClip || busy || job?.state === "pending" || job?.state === "starting";
  // Free-film allowance from the server (visitor mode): one paid film per visitor, every scene inside that one clip.
  const filmsLimited = Boolean(config?.films && !config.films.unlimited);
  const filmsLeft = filmsLimited ? Math.max(0, config.films.left - (job && job.state !== "failed" ? 1 : 0)) : Infinity;
  useEffect(() => { let alive = true; fetch("/api/ai-video/config").then((r) => r.json()).then((v) => alive && setConfig(v)).catch(() => alive && setConfig({ ready: false, message: "Could not reach the generation server. Restart local dev or check the deployed function." }));
    return () => { alive = false; version.current++; };
  }, []);
  useEffect(() => { if (!photo) { setPreview(""); return; } const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url); }, [photo]);
  useEffect(() => { setQuote(null); version.current++; }, [model, resolution, seconds, style, ceremony, promptText, promptKey, storyMode, accessCode]);
  async function api(action, body, signal) {
    const response = await fetch(`/api/ai-video/${action}`, { method: "POST", headers: { "content-type": "application/json", "x-ai-access-code": accessCode }, body: JSON.stringify(body), signal });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Request failed. No automatic paid retry was made."); return data;
  }
  async function loadHistory(){if(!accessReady)return;setHistoryBusy(true);setHistoryError("");try{const data=await api("history",{});let edits={};try{edits=JSON.parse(localStorage.getItem("everymoment-video-edits")||"{}");}catch{}setHistory(data.clips.map(c=>({...c,editableDetails:edits[c.id]?{title:edits[c.id].title}:undefined})));}catch{setHistoryError("Could not load previous videos. Check the server and refresh videos.");}finally{setHistoryBusy(false);}}
  function editHistory(id,details){if(localReels.some(r=>r.id===id)){setLocalReels(list=>list.map(r=>r.id===id?{...r,editableDetails:details}:r));void renameCompletedReel(id,details.title).catch(()=>setHistoryError("Could not save the reel heading in this browser."));return;}setHistory(list=>list.map(c=>c.id===id?{...c,editableDetails:details}:c));const entry=history.find(c=>c.id===id);setClips(list=>list.map(c=>c.videoUrl===entry?.videoUrl?{...c,editableDetails:details}:c));try{const edits=JSON.parse(localStorage.getItem("everymoment-video-edits")||"{}");edits[id]=details;localStorage.setItem("everymoment-video-edits",JSON.stringify(edits));}catch{}}
  async function openCombinedSources(sources,editor=null){
    if(active || sources.length<2)return false;
    setSelectingClip(true);setHistoryError("");
    try{
      for(const c of sources)await loadClip(c,AbortSignal.timeout(20000));
      await useSavedClip(sources[0],{keepReel:true});setClips(sources);setEditingReel(editor?{clips:sources,editor}:{clips:sources});setCurrentReelId(null);if(editor)onRestoreReel?.(editor);return true;
    }catch{setHistoryError("These clips could not be combined because a source video is unavailable. Try another playable clip or your browser copy.");return false;}finally{setSelectingClip(false);}
  }
  async function recoverLastReel(){
    const sources=recoverable.filter(c=>storyMode?c.ceremony==="story":c.ceremony!=="story").map(c=>({...c,token:history.find(h=>h.videoUrl===c.videoUrl)?.token || c.token}));
    return openCombinedSources(sources);
  }
  function hideUnavailable(videoUrl){setHistory(list=>list.filter(c=>c.videoUrl !== videoUrl));mediaCache.current.delete(videoUrl);}
  async function useSavedClip(clip,{keepReel=false}={}){
    if(clip.localReel){
      if(active || selectLock.current)return;
      try{await loadClip(clip);for(const source of clip.clips)await loadClip(source,AbortSignal.timeout(20000));}catch{setHistoryError("This complete reel cannot be reopened for editing because its browser copy or source clips are unavailable.");return;}
      await useSavedClip(clip.clips[0],{keepReel:true});
      setClips(clip.clips);setEditingReel(clip);setCurrentReelId(clip.id);onRestoreReel?.(clip.editor);return;
    }
    if(active || selectLock.current)return;
    selectLock.current=true;setSelectingClip(true);
    try{await loadClip(clip,AbortSignal.timeout(20000));}catch(e){if(e.code === "VIDEO_EXPIRED")hideUnavailable(clip.videoUrl);else setHistoryError("Could not open this video right now. Check the connection, then try again.");return;}finally{selectLock.current=false;setSelectingClip(false);}

    setContinuingVideo(false);setPreviousVideo("");setContinuationPhoto(false);setEditingClip(clip); resetJob(); setPhoto(reusePhoto?sharedPhoto:null); if(photoInput.current)photoInput.current.value="";
    const nextStory=clip.ceremony === "story", nextStyle=clip.style || "Marathi wedding", duration=clip.seconds || 15;
    setStoryMode(nextStory); onModeChange?.(nextStory?"story":"wedding");
    setModel(clip.model || AI_VIDEO_MODELS[0].id);setResolution(["480p","720p"].includes(clip.resolution)?clip.resolution:"720p");setSeconds(duration);setStyle(nextStyle);
    if(nextStory){const savedEvents=clip.storyScene?.scenes || [{...newStoryEvent(),title:clip.storyScene?.title || "Our story",description:clip.storyScene?.storyText || clip.storyScene?.description || "",location:clip.storyScene?.location || "",date:clip.storyScene?.date || ""}];setStoryAnimation(clip.storyScene?.animation || PHOTO_LIKENESS_STYLE);setStoryEvents(savedEvents);setStoryPart(clip.storyScene?.part || 1);setPreviousStory(savedStoryContext(clip.storyScene?.previousSummary || ""));storyProject.current=clip.storyScene?.projectId || crypto.randomUUID();setPromptDraft(null);}
    else{const ceremony=clip.ceremony || "wedding",scenes=clip.weddingScenes || weddingSceneDefaults(nextStyle,ceremony),layout="cinematic";setCeremony(ceremony);setWeddingDraft(list=>({...list,[nextStyle+":"+ceremony]:scenes}));setWeddingLayout(layout);setPromptDraft(clip.customPrompt?{key:JSON.stringify([nextStyle,ceremony,duration,"",scenes,layout]),text:clip.customPrompt}:null);}
    setQuote(null);setTimeout(()=>editForm.current?.scrollIntoView({behavior:"smooth",block:"start"}),0);
    setWorkspaceStarted(true);if(!keepReel){setEditingReel(null);setCurrentReelId(null);setClips([clip]);}}
  useEffect(()=>{if(accessReady){void loadHistory();}},[accessReady,job?.state,job?.videoUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  function startStory(){setStoryMode(true);if(!storyProject.current)storyProject.current=crypto.randomUUID();setSeconds(15);setPromptDraft(null);setQuote(null);setError("");}
  async function loadClip(clip, signal) {
    if(mediaCache.current.has(clip.videoUrl))return mediaCache.current.get(clip.videoUrl);
    const stored=await cachedVideo(clip.videoUrl);if(stored)return stored;
    if (clip.videoUrl.startsWith("blob:")) return (await fetch(clip.videoUrl)).blob();
    if(clip.localReel)throw new Error("This complete reel is no longer stored in this browser.");
    if (!clip.token || !accessReady) throw new Error("Enter your generation access code to load this clip, or upload the saved MP4.");
    const response = await fetch("/api/ai-video/media", { method: "POST", headers: { "content-type": "application/json", "x-ai-access-code": accessCode }, body: JSON.stringify({ token: clip.token }), signal });
    if (!response.ok) { const data = await response.json(); const error=new Error(data.error || "Could not load the video right now.");error.code=data.code;throw error; }
    const blob=await response.blob();
    void saveVideoCopy(clip.videoUrl,blob);
    mediaCache.current.set(clip.videoUrl,blob);
    while(mediaCache.current.size>3)mediaCache.current.delete(mediaCache.current.keys().next().value);
    return blob;
  }
  function saveJob(next, nextToken = token) { setJob(next); try { sessionStorage.setItem("everymoment-ai-job", JSON.stringify({ job: next, token: nextToken })); } catch { /* keep tab state */ } }
  const attemptedCharges = useRef(new Set());
  const [refreshingReelCost, setRefreshingReelCost] = useState(false);
  async function refreshReelCost() {
    if (!accessReady || refreshingReelCost) return;
    setRefreshingReelCost(true); setChargeMessage("");
    try {
      const tokens = [...new Set(clips.filter(c => c.token && !Number.isFinite(c.actualCostUsd)).map(c => c.token))];
      const results = await Promise.allSettled(tokens.map(async clipToken => ({clipToken, next:await api("status",{token:clipToken},AbortSignal.timeout(20000))})));
      const updated = results.filter(r => r.status === "fulfilled").map(r => r.value);
      setClips(list => list.map(c => { const result=updated.find(r=>r.clipToken===c.token); return result ? {...c,seconds:result.next.seconds ?? c.seconds,actualCostUsd:result.next.actualCostUsd ?? c.actualCostUsd} : c; }));
      const current=updated.find(r=>r.clipToken===token); if(current)saveJob({...job,...current.next});
      if(results.some(r=>r.status === "rejected"))setChargeMessage("Some clip usage records could not be refreshed. Confirmed credits used are retained; retry when the server is reachable.");
    } finally {setRefreshingReelCost(false);}
  }
  const pendingCostTokens = clips.filter(c=>c.token && !Number.isFinite(c.actualCostUsd)).map(c=>c.token).join("|");
  useEffect(() => { if(!accessReady || !pendingCostTokens) return; const key=accessCode+pendingCostTokens;if(attemptedCharges.current.has(key))return;attemptedCharges.current.add(key);void refreshReelCost(); },[accessCode,pendingCostTokens,accessReady]); // eslint-disable-line react-hooks/exhaustive-deps
  async function refreshCharge() {
    if (chargeLock.current || !token) return;
    setError(""); setChargeMessage("");
    if (Number.isFinite(job?.actualCostUsd)) { setChargeMessage("The actual credits used reported by xAI are already shown below."); return; }
    if (!accessReady) { setChargeMessage("Enter your generation access code above, then refresh the credits used."); return; }
    chargeLock.current = true; setRefreshingCharge(true);
    try {
      const next = await api("status", { token }, AbortSignal.timeout(20000));
      saveJob({ ...job, ...next });
      setChargeMessage(Number.isFinite(next.actualCostUsd) ? "Credits used updated from xAI. No new generation was started." : "xAI has not returned the actual credits used yet. Your video is ready; check xAI Console Usage or refresh later.");
    } catch (e) {
      const reason = e instanceof TypeError || e.name === "TimeoutError" ? "Could not reach the server to refresh billing. Check that the local server is running and your connection is available." : e.message;
      setChargeMessage(`${reason} Your completed video is unchanged. Refresh credits used again later; this does not start another paid generation.`);
    } finally { chargeLock.current = false; setRefreshingCharge(false); }
  }
  useEffect(() => {
    if (!polling || !token || !accessReady) return;
    let cancelled = false, timer, misses = 0; const controller = new AbortController();
    // A failed check (the server or xAI briefly unreachable) doesn't stop the job: keep checking with growing pauses
    // and only give up after several misses in a row. The video keeps generating at xAI either way.
    const MAX_MISSES = 8;
    async function check() {
      try { const next = await api("status", { token }, controller.signal); if (cancelled) return; misses = 0; setError(""); saveJob(next);
        if (next.state === "pending") timer = setTimeout(check, 5000);
        else { setPolling(false); if (next.error) setError(next.error); }
      } catch (e) {
        if (cancelled) return;
        misses += 1;
        const reason = e instanceof TypeError ? "Could not reach the server." : e.message;
        if (misses < MAX_MISSES) { setError(`${reason} Retrying automatically (${misses}/${MAX_MISSES - 1})…`); timer = setTimeout(check, Math.min(5000 * 2 ** (misses - 1), 30000)); }
        else { setPolling(false); setError(`${reason} Use Check progress to resume this job.`); }
      }
    }
    check(); return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [polling, token, accessCode, accessReady]); // eslint-disable-line react-hooks/exhaustive-deps
  async function review(file = photo) {
    if (!file || active) return;
    if(!storyMode&&!validWeddingScenes(weddingScenes)){setError("Complete the description, setting and both couple outfits for each ceremony before reviewing credits.");return;}
    if(hasRepeatedGenerationPrompt(promptText)){setQuote(null);setError(REPEATED_PROMPT_ERROR);return;}
    if(storyMode && storyEvents.some(scene=>!scene.title.trim() || !scene.description.trim())){setError("Add a title and description for each scene before reviewing credits.");return;}
    const current = ++version.current; setError(""); setBusy(true);
    try {
      const base = { ...estimate, style, ceremony:storyMode?"story":ceremony };
      if (!accessReady) { setQuote(base); return; }
      const next = await api("quote", { model, resolution, seconds, style, ceremony:storyMode?"story":ceremony,weddingScenes:storyMode?undefined:weddingScenes,weddingLayout:storyMode?undefined:weddingLayout, storyScene:storyMode?{id:storyProject.current,projectId:storyProject.current,title:"Our story",part:storyPart,previousSummary:previousStory,animation:storyAnimation,index:0,count:storyEvents.length,scenes:storyEvents}:undefined, customPrompt: promptText, promptMode: "replace", photoHash: await digest(file) });
      if (current === version.current) setQuote(next);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function removePhoto(){if(active)return;setContinuationPhoto(false);version.current++;setSharedPhoto(null);setReusePhoto(false);setPhoto(null);setQuote(null);setError("");setPromptDraft(null);if(photoInput.current)photoInput.current.value="";}
  function changePhoto(event) {
    const file = event.target.files?.[0]; if (!file) return;
    version.current++; setQuote(null); setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 3000000) { setError("Choose a JPG, PNG or WebP photo under 3 MB."); event.target.value = ""; setPhoto(null); return; }
    setContinuationPhoto(false);setWorkspaceStarted(true);setPhoto(file);setSharedPhoto(file);setReusePhoto(true);
  }
  async function generate(confirmedQuote) {
    if (lock.current || !confirmedQuote.token || !photo) return;
    replacement.current=editingClip?{token:confirmedQuote.token,videoUrl:clips.find(c=>c.videoUrl === editingClip.videoUrl)?.videoUrl || clips.filter(c=>c.ceremony === (storyMode?"story":ceremony)).at(-1)?.videoUrl || editingClip.videoUrl}:null;
    lock.current = true; setBusy(true); setError(""); setToken(confirmedQuote.token);
    saveJob({ state: "starting", estimatedCents: confirmedQuote.totalCents }, confirmedQuote.token);
    try { const next = await api("generate", { token: confirmedQuote.token, confirmed: true, image: await fileData(photo) }); saveJob(next, confirmedQuote.token); setQuote(null); if (next.state === "pending") setPolling(true); if (next.error) setError(next.error); }
    catch (e) { setQuote(null); setError(e.message + " Check this job’s progress before attempting another generation."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function prepareContinuation(previous){
    if(!previous)throw new Error("Select a completed clip first.");
    const image=await continuationFrame(await loadClip(previous,AbortSignal.timeout(60000)));
    setPhoto(image);setReusePhoto(false);setContinuationPhoto(true);setWorkspaceStarted(true);
    if(photoInput.current)photoInput.current.value="";
  }
  async function continueVideo(){
    if(active)return;setBusy(true);setError("");
    try{
      const previous=clips.filter(c=>c.ceremony !== "story").at(-1);
      await prepareContinuation(previous);
      setPreviousVideo(previous.ceremony || "wedding");
      setContinuingVideo(true);setEditingClip(null);replacement.current=null;resetJob();setQuote(null);setPromptDraft(null);setSeconds(15);
      setCeremony({"film-opening":"film-part-1","film-part-1":"film-part-2","film-part-2":"film-part-3","journey-opening":"journey-finale"}[previous?.ceremony] || "reception");
      setTimeout(()=>editForm.current?.scrollIntoView({behavior:"smooth",block:"start"}),0);
    }catch(e){setError(e.message+" No generation was started.");}finally{setBusy(false);}
  }
  async function continueStory(){
    if(active)return;setBusy(true);setError("");
    try{
      const previous=clips.filter(c=>c.ceremony === "story").at(-1);
      await prepareContinuation(previous);
      const summary=storyContinuationContext(previous,storyEvents);
      setPreviousStory(summary.slice(0,CONTINUATION_SUMMARY_LIMIT));
      setStoryPart((previous?.storyScene?.part || storyPart)+1);
      setStoryEvents([{...newStoryEvent(),guide:{kind:6}}]);setSeconds(15);setPromptDraft(null);setQuote(null);setEditingClip(null);replacement.current=null;resetJob();
      setTimeout(()=>editForm.current?.scrollIntoView({behavior:"smooth",block:"start"}),0);
    }catch(e){setError(e.message+" No generation was started.");}finally{setBusy(false);}
  }
  function resetJob() { setJob(null); setToken(""); setPolling(false); setError(""); try { sessionStorage.removeItem("everymoment-ai-job"); } catch {} }
  const visibleClips=clips.filter(c=>storyMode ? c.ceremony === "story" : c.ceremony !== "story");
  useEffect(()=>{if(mode && editingClip && ((mode === "story") !== (editingClip.ceremony === "story"))){setEditingClip(null);setPhoto(reusePhoto?sharedPhoto:null);setPromptDraft(null);}},[mode,editingClip]);
  return <section className="ai-video-setup">
    <div className="ai-photo-top" data-tour="ai-photo">
      {!continuationPhoto && sharedPhoto && <div className="ai-shared-photo"><label className="ai-auto-suggest"><input type="checkbox" checked={reusePhoto} disabled={active} onChange={e=>{setReusePhoto(e.target.checked);setPhoto(e.target.checked?sharedPhoto:null);setQuote(null);version.current++;if(photoInput.current)photoInput.current.value="";}}/>Use the same uploaded photo</label><p className="hint small">{sharedPhoto.name} · Available in Upload my own and Create your own story during this visit.</p>{reusePhoto&&<button type="button" disabled={active} onClick={()=>{setReusePhoto(false);setPhoto(null);setQuote(null);version.current++;if(photoInput.current)photoInput.current.value="";}}>Upload new photo</button>}</div>}
      {!continuationPhoto && (!sharedPhoto || !reusePhoto) && <label className="ai-photo-drop"><span className="ai-photo-drop-title">{editingClip ? "New couple photo for regeneration" : "Upload couple photo"}</span><input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={changePhoto} disabled={active} /></label>}
      <p className="hint small">JPG, PNG or WebP · Under 3 MB · Uploading does not start paid generation.</p>
      {continuationPhoto && <p className="hint">Using the last animated frame of your previous clip for continuity. This is a new paid clip, not the video-extension API. Review credits before generating. Remove this frame to upload a different photo.</p>}
      {preview && <div className="ai-upload-wrap"><img className="ai-upload-preview" src={preview} alt="Uploaded couple photo preview" /><button type="button" className="ai-remove-photo" aria-label="Remove uploaded photo" disabled={active} onClick={removePhoto}>×</button></div>}
    </div>
    {topFields}
    {!hideSaved && !editingClip && !continuingVideo && (!storyMode || [...localReels,...history].some(c=>c.ceremony === "story")) && <AiSavedVideos onUnavailable={hideUnavailable} loadClip={loadClip} story={storyMode} clips={[...localReels,...history].filter(c=>storyMode ? c.ceremony === "story" : c.ceremony !== "story")} loading={historyBusy} error={historyError} onCombine={openCombinedSources} onRefresh={refreshGallery} onUse={useSavedClip} onEdit={editHistory} disabled={active}/>}
    {!hideSaved&&!editingClip&&<p><button type="button" disabled={active||recoverable.filter(c=>storyMode?c.ceremony==="story":c.ceremony!=="story").length<2} onClick={()=>void recoverLastReel()}>Recover last combined reel</button><span className="hint small">{recoverable.filter(c=>storyMode?c.ceremony==="story":c.ceremony!=="story").length>1?" Reopen the last clip sequence, then save the complete reel. No generation credits used.":" No earlier combined sequence was saved in this tab. Use Combine saved clips above to choose your parts and their order."}</span></p>}
    {!hideSaved&&historyError&&!editingClip&&<p role="status" className="hint">{historyError}</p>}
    {selectingClip && <p role="status" className="hint">Opening saved video…</p>}
    <p className="ai-connection-note">{config?.message || "Checking generation setup…"}</p>
    <p className="hint">{filmsLimited ? "Your AI film is one clip of up to 15 seconds, and every scene you add goes into it. Review the scenes before you generate: you can make one film." : storyMode ? "Your complete story is generated as one video, up to 15 seconds total. Review one credit estimate for the complete story." : "Up to 15 seconds per request. For a 30-second film generate Opening and Finale separately, then preview and download the full reel."} Your photo is sent to xAI only after you confirm. Faces and motion may vary. The default prompt requests animation immediately; trim any remaining photo intro in the reel preview.</p>
    {!mode && <div className="ai-story-switch"><button type="button" disabled={active} onClick={storyMode?()=>setStoryMode(false):startStory}>{storyMode?"Back to wedding ceremonies":"Create your own story"}</button></div>}
    <form ref={editForm} onSubmit={(e) => { e.preventDefault(); void review(); }}>
      {config?.accessRequired !== false && <><label>Generation access code<input type="password" autoComplete="off" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} disabled={busy} /></label>
      <p className="hint small">Provided by the site owner to authorise use of their API credits. This is not your xAI API key.</p></>}
      {!storyMode && continuingVideo && <p className="ai-connection-note">Continue this reel · next 15 seconds. The earlier clip stays in your reel. Choose the next ceremony or edit the prompt, upload a photo if needed, then review credits. Play full reel and Download reel include both parts.</p>}
      {editingClip && <section className="ai-editing-notice"><h3>{editingReel?"Edit complete reel":"Edit selected video"}</h3>{editingReel&&<><p className="hint">Complete reel · {editingReel.clips.length} clips. Play full reel previews all parts. Text and music changes apply when you save or download again.</p><label>Clip to edit or regenerate<select value={editingClip.videoUrl} onChange={e=>{const source=clips.find(c=>c.videoUrl===e.target.value);if(source)void useSavedClip(source,{keepReel:true});}}>{clips.map((c,i)=><option key={c.videoUrl} value={c.videoUrl}>Clip {i+1} · {c.weddingScenes?.map(s=>s.title || s.kind).join(", ") || c.storyScene?.title || c.ceremony}</option>)}</select></label></>}<p className="hint">Your video is in the phone preview. Edit its heading below, and names, dates and venue in the reel details. Text edits use no API credits.</p><label>Video heading<input maxLength={80} value={clips.find(c=>c.videoUrl===editingClip.videoUrl)?.editableDetails?.title ?? editingClip.storyScene?.title ?? editingClip.ceremony} onChange={e=>{const title=e.target.value;setClips(list=>list.map(c=>c.videoUrl===editingClip.videoUrl?{...c,editableDetails:{...c.editableDetails,title}}:c));if(editingClip.id)editHistory(editingClip.id,{...editingClip.editableDetails,title});}}/></label><p className="hint">To change the couple photo or animation, choose a new photo and edit the prompt below. A new video is generated only after you confirm its credits. The finished result replaces the selected clip in this reel; it is not appended. The older version stays in your saved history.</p>{!editingClip.customPrompt && <p className="hint small">This older video has no saved prompt. A matching default is loaded for you to edit.</p>}<button type="button" disabled={active} onClick={()=>{setEditingClip(null);setEditingReel(null);setCurrentReelId(null);setPhoto(reusePhoto?sharedPhoto:null);setPromptDraft(null);setClips([]);if(photoInput.current)photoInput.current.value="";}}>Back to generated videos</button></section>}
      {!storyMode&&<fieldset disabled={active} className="ai-settings" data-tour="ai-style"><legend className="sr-only">Wedding style and ceremony</legend><div className="ai-video-fields">
        <label>Wedding style<select value={style} onChange={(e) => changeWeddingStyle(e.target.value)}>{AI_WEDDING_STYLES.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Ceremony<select value={ceremony} onChange={(e) => setCeremony(e.target.value)}>{AI_CEREMONIES.filter(s=>s!=="story").map((s) => <option key={s} value={s}>{CEREMONY_LABELS[s] || s[0].toUpperCase() + s.slice(1)}</option>)}</select></label>
      </div><p className="hint small">Outfits, rituals and locations below change to match the selected wedding style.</p></fieldset>}
      {storyMode && storyPart>1 && <p className="ai-connection-note">Continuation · Part {storyPart}. Write the next part of your story. Earlier clips stay in the reel; this new 15-second part will be added after them. Each part needs its own credit confirmation.</p>}
      {!storyMode&&<AiWeddingScenes onSuggest={body=>api("suggest-story",body)} suggestionsAvailable={!!accessReady} seconds={seconds} scenes={weddingScenes} onChange={scenes=>{setWeddingDraft(list=>({...list,[weddingKey]:scenes}));if(editingClip&&!storyMode)setClips(list=>list.map(c=>c.videoUrl===editingClip.videoUrl&&c.weddingScenes?{...c,weddingScenes:c.weddingScenes.map(s=>{const live=scenes.find(x=>x.id===s.id&&x.kind===s.kind);return live?{...s,title:live.title,date:live.date,time:live.time,venue:live.venue,theme:live.theme}:s;})}:c));}} style={style} layout={weddingLayout} onLayout={setWeddingLayout} look={weddingLook} onLook={setWeddingLook} disabled={active}/>}
      {storyMode&&<AiStoryBuilder part={storyPart} previousSummary={previousStory} events={storyEvents} onChange={setStoryEvents} onSuggest={body=>api("suggest-story",body)} suggestionsAvailable={!!accessReady} animation={storyAnimation} onAnimation={setStoryAnimation} seconds={seconds} disabled={active}/>}
      <fieldset disabled={active} className="ai-settings" data-tour="ai-settings"><legend className="sr-only">Video settings</legend><div className="ai-video-fields">
        <label>Video model<select value={model} onChange={(e) => setModel(e.target.value)}>{AI_VIDEO_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
        <label>Resolution<select value={resolution} onChange={(e) => setResolution(e.target.value)}>{["480p", "720p"].map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>{storyMode?"Total story duration":"Duration"}<select value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>{[5,10,15].map((s) => <option key={s} value={s}>{s} seconds</option>)}</select></label>
      </div>{(!storyMode && (photo || editingClip || continuingVideo)) && <div className="ai-editable-prompt"><label>Animation prompt · editable<textarea rows={9} maxLength={FULL_PROMPT_LIMIT} value={promptText} onChange={e => setPromptDraft({key:promptKey,text:e.target.value})} /></label><p className="hint small">{promptText.length.toLocaleString()} / {FULL_PROMPT_LIMIT.toLocaleString()} characters</p><button type="button" onClick={() => setPromptDraft(null)}>Reset to default prompt</button><p className="hint small">Edit the default prompt to change outfits, setting, animation or camera movement. Changing culture, ceremony or duration loads its matching default. Keep names, dates and venue in the reel form so they remain editable. Changes apply to the next generation.</p></div>}</fieldset>
      {(photo || editingClip || continuingVideo) && <><p className="ai-estimate">Estimated credits used for this video: <strong>{creditCents(estimate.totalCents)}</strong></p>
      <p className="hint small">xAI prepaid credits are measured in USD: 0.46 USD credits means 0.46 deducted from your prepaid balance. There is no separate points conversion. This is an estimate; credits actually used appear after generation. Each new generation uses credits.</p></>}
      <button type="submit" className="primary" data-tour="ai-generate" disabled={!photo || !promptText.trim() || active || filmsLeft === 0}>{busy ? "Please wait…" : filmsLeft === 0 ? "Free AI film used" : job ? "Review credits for another video" : "Review generation credits"}</button>
      {filmsLimited && <p className="hint small ai-film-allowance" role="status">{filmsLeft === 0 ? "You've already created your free AI film. Your clip stays in the preview, where you can keep editing the names, dates and venues." : "You can create 1 AI film. Scene 1, Scene 2 and every other scene are all included in that one film."}</p>}
    </form>
    {error && <p role="alert" className="error">{error}</p>}
    {job && ((job.ceremony === "story") === storyMode) && <section className="ai-job-result" aria-label="Video generation result">
      <p role="status">{job.state === "done" ? "Video ready" : job.state === "pending" ? "Generating your video. This may take several minutes." : job.state === "starting" ? "Submission in progress. Check progress if it was interrupted; do not submit again." : "Generation stopped. Review the message before starting again."}</p>
      {Number.isFinite(job.actualCostUsd) ? <p><strong>API credits used for this {job.seconds || 15}-second clip: {creditUnits(job.actualCostUsd)}</strong><br /><small>Actual usage reported by xAI for this generation.</small></p> : Number.isFinite(job.estimatedCents) && <p>Estimated API credits for this request: {creditCents(job.estimatedCents)}. Actual credits used have not been returned by xAI yet.</p>}
      {job.videoUrl && <>{!renderEditor && <video controls muted playsInline src={job.videoUrl} className="ai-generated-video" />}<p><a href={job.videoUrl} target="_blank" rel="noopener noreferrer">Open / save generated MP4 →</a></p><p className="hint small">Save your clip while the provider link is available. Edit names, dates and venues in the reel form. Your video appears in the phone preview.</p></>}
      {chargeMessage && <p role="status" className="hint">{chargeMessage}</p>}
      {token && job.state === "done" && !Number.isFinite(job.actualCostUsd) && <button type="button" disabled={refreshingCharge} onClick={refreshCharge}>{refreshingCharge ? "Checking credits used…" : "Refresh credits used"}</button>}
      {token && !polling && ["pending", "starting"].includes(job.state) && <button type="button" onClick={() => { setError(""); setPolling(true); }}>Check progress</button>}
      {!["pending", "starting"].includes(job.state) && <button type="button" onClick={resetJob}>Start another clip</button>}
    </section>}
    {!storyMode && visibleClips.length>0 && <button type="button" className="primary" disabled={active} onClick={continueVideo}>＋ Continue video · next 15 seconds</button>}
    {storyMode && visibleClips.length>0 && <button type="button" className="primary" disabled={active} onClick={continueStory}>＋ Continue story · next 15 seconds</button>}
    <AiReelCost clips={visibleClips} />
    {clips.some(c=>c.token && !Number.isFinite(c.actualCostUsd)) && <button type="button" disabled={!accessReady || refreshingReelCost} onClick={refreshReelCost}>{refreshingReelCost ? "Checking reel credits…" : "Refresh full reel credits used"}</button>}


    {(clips.length > 0 || renderEditor) && (renderEditor ? renderEditor(<AiReelEditor {...editorProps} onSelectClip={clip=>{if(editingReel&&clip.videoUrl!==editingClip?.videoUrl)void useSavedClip(clip,{keepReel:true});}} liveScenes={storyMode?undefined:weddingScenes} reelId={currentReelId} reelTitle={localReels.find(r=>r.id===currentReelId)?.editableDetails?.title} initialEdit={editingReel?.editor} onSavedReel={reelSaved} compact loadClip={loadClip} accessCode={config?.accessRequired === false ? "local" : accessCode} clips={visibleClips} onRemove={i => setClips(list => list.filter(c => c.videoUrl !== visibleClips[i]?.videoUrl))} />) : <AiReelEditor onSelectClip={clip=>{if(editingReel&&clip.videoUrl!==editingClip?.videoUrl)void useSavedClip(clip,{keepReel:true});}} liveScenes={storyMode?undefined:weddingScenes} reelId={currentReelId} initialEdit={editingReel?.editor} onSavedReel={reelSaved} loadClip={loadClip} accessCode={accessCode} clips={visibleClips} onRemove={i => setClips(list => list.filter((_,j) => i !== j))} />)}
    <GenerationCostDialog quote={quote} generationAvailable={!!quote?.token && !!config?.ready} busy={busy} onCancel={() => setQuote(null)} onConfirm={generate} />
  </section>;
}
