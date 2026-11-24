import {weddingVideoPrompt} from './ai-wedding-prompt.mjs';
import {continuationDirection} from './ai-continuation.mjs';

// Only a ceremony identifier is accepted here, never an earlier generation prompt.
export function weddingContinuationPrompt(style,ceremony,seconds,previousCeremony){
  const previous=previousCeremony==='journey-opening'?'The opening portion is complete.':previousCeremony==='journey-finale'?'The previous finale portion is complete.':'The previous clip is complete.';
  let next=weddingVideoPrompt(style,ceremony,seconds);
  next=next.replace('Use the uploaded image as reference.','Use the supplied final animated frame as the visual continuity reference.');
  next=next.replace('Image-to-video may begin with the supplied image; transition smoothly into animation.','Start the next action immediately from the animated ending pose; do not display a static reference image.');
  const time=n=>Number((n*seconds/15).toFixed(1));
  const schedule=ceremony==='journey-finale'?`NEW SCENES ONLY, in this order: 0–${time(4)}s Sangeet celebration; ${time(4)}–${time(11)}s Wedding ceremony; ${time(11)}–${seconds}s Reception. Give each event its own visible scene. Do not replace or skip Sangeet. Follow the selected culture's details below.`:`NEW CLIP ONLY: ${ceremony}. Show only this next event, not an earlier ceremony.`;
  return continuationDirection(previous)+'\n'+schedule+'\n'+next;
}
