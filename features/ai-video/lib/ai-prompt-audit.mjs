// Detect the specific old bug: a whole generation prompt nested as previous events.
// Do not guess at or rewrite the user's creative direction.
export function hasRepeatedGenerationPrompt(prompt=''){
  return /Previous events \(context only, do not replay\):\s*(?:Use the uploaded image as reference\.|Create (?:a |ONE complete )\d+-second)/i.test(prompt);
}
export const REPEATED_PROMPT_ERROR='This saved prompt repeats the earlier generation instructions inside the continuation. Reset to default prompt before reviewing credits. No new video request has been sent.';

export function savedStoryContext(summary=''){
  // Older saved metadata can contain a raw prompt without the outer marker.
  return /(?:Use the uploaded image as reference\.|Create (?:a |ONE complete )\d+-second)/i.test(summary)?'The earlier story part is complete. Continue with only the scenes in the new timeline.':summary;
}

export function storyContinuationContext(previous,fallbackScenes=[]){
  const scenes=previous?.storyScene?.scenes || fallbackScenes;
  const completed=scenes.map(scene=>({title:String(scene.title || 'Untitled moment').slice(0,80),...(scene.location?{location:String(scene.location).slice(0,120)}:{})}));
  // Intentionally exclude descriptions, customPrompt and previousSummary. Those may
  // contain entire old prompts or action instructions that would be replayed.
  return 'Completed part '+(previous?.storyScene?.part || 1)+'. Completed scene labels (context data only): '+JSON.stringify(completed)+'. These moments are over; show only the new scenes in the next timeline.';
}
