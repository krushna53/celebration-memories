"use client";
import {useEffect,useRef,useState} from 'react';
import {SCENE_DESCRIPTION_LIMIT} from '@/features/ai-video/lib/ai-video-limits.mjs';
import {creditUnits} from '@/features/ai-video/lib/ai-credits.mjs';
export default function AiSceneSuggestions({scene,index,onAccept,animation,seconds,disabled,onSuggest,suggestionsAvailable}){
 const value=scene.description || '',key=JSON.stringify([scene.id,value,animation,seconds]);
 const [auto,setAuto]=useState(false),[busy,setBusy]=useState(false),[suggestion,setSuggestion]=useState(null),[error,setError]=useState('');
 const currentKey=useRef(key),suggestRef=useRef(onSuggest),lock=useRef(false),lastRequest=useRef({key:'',time:0}),mounted=useRef(true);
 currentKey.current=key;suggestRef.current=onSuggest;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{setSuggestion(null);setError('');},[key]);
 async function requestSuggestion(){
  if(lock.current || disabled || !suggestionsAvailable || value.trim().length<30)return;
  const sourceKey=key;lock.current=true;lastRequest.current={key:sourceKey,time:Date.now()};setBusy(true);setError('');setSuggestion(null);
  try{const result=await suggestRef.current({story:value,animation,seconds,confirmed:true,maxCharacters:SCENE_DESCRIPTION_LIMIT});if(mounted.current&&currentKey.current===sourceKey)setSuggestion({...result,sourceKey});}
  catch(e){if(mounted.current&&currentKey.current===sourceKey)setError(e.message || 'Could not get a suggestion. Your scene is unchanged.');}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 useEffect(()=>{if(!auto||disabled||!suggestionsAvailable||busy||value.trim().length<30||lastRequest.current.key===key)return;const timer=setTimeout(()=>void requestSuggestion(),Math.max(2500,15000-(Date.now()-lastRequest.current.time)));return()=>clearTimeout(timer);},[key,auto,disabled,suggestionsAvailable,busy]); // eslint-disable-line react-hooks/exhaustive-deps
 return <section className="ai-story-assistance" aria-label={'AI suggestions for scene '+(index+1)}><h3>Improve scene {index+1} with AI</h3><label className="ai-auto-suggest"><input type="checkbox" checked={auto} disabled={disabled||!suggestionsAvailable} onChange={e=>setAuto(e.target.checked)}/>AI suggestions while I type in scene {index+1}</label><p className="hint small">Optional text API credits apply. Your scene changes only when you choose Yes; this does not generate a video.</p><button type="button" disabled={disabled||busy||!suggestionsAvailable||value.trim().length<30} onClick={()=>void requestSuggestion()}>{busy?'Improving scene…':'Suggest improvements for scene '+(index+1)}</button>{value.trim().length<30&&<p className="hint small">Describe this moment in at least 30 characters to get an AI suggestion.</p>}{!suggestionsAvailable&&<p className="hint small">Connect the generation server and authorise access to use AI suggestions.</p>}{error&&<p className="error" role="alert">{error}</p>}{suggestion?.sourceKey===key&&<div className="ai-story-suggestion"><h4>Suggested improvement for scene {index+1}</h4><p className="ai-story-prose">{suggestion.suggestion}</p><div className="ai-story-suggestion-actions"><button type="button" className="primary" onClick={()=>{setAuto(false);onAccept(suggestion.suggestion);setSuggestion(null);}}>Yes, use this for scene {index+1}</button><button type="button" onClick={()=>{setAuto(false);setSuggestion(null);}}>No, keep scene {index+1}</button></div>{Number.isFinite(suggestion.actualCostUsd)&&<p className="hint small">Text suggestion credits used: {creditUnits(suggestion.actualCostUsd)}</p>}</div>}</section>;
}
