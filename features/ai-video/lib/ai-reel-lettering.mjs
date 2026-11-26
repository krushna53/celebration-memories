export const DEFAULT_LETTERING={heading:58,address:36,font:'Georgia',backdrop:'fade',surface:'banner'};
// Script font used for headings on decorated surfaces; loaded in the browser from /fonts/sacred.
export const REEL_SCRIPT_FONT='Reel Script';
// Heading fonts for the ceremony / scene title. Loaded in the browser by AiReelEditor (see REEL_FONT_FILES).
export const REEL_HEADING_FONTS={
 serif:{label:'Elegant serif',family:'Reel Serif',scale:1.05},
 caps:{label:'Classic capitals',family:'Reel Caps',scale:0.82},
 script:{label:'Calligraphy script',family:REEL_SCRIPT_FONT,scale:1.15},
 body:{label:'Same as lettering font',family:'',scale:1},
};
export const REEL_FONT_FILES=[['Reel Serif','/fonts/reel/PlayfairDisplay-MediumItalic.woff2'],['Reel Caps','/fonts/reel/Cinzel-SemiBold.woff2'],[REEL_SCRIPT_FONT,'/fonts/sacred/ImperialScript-Regular.woff']];
// Plain text keeps the chosen lettering font; decorated surfaces default to the elegant serif.
export function headingFontKey(lettering,surface){
 return REEL_HEADING_FONTS[lettering?.headingFont]?lettering.headingFont:(surface==='none'?'body':'serif');
}
export const LETTER_SURFACES=['none','banner','board','arch'];
export const LETTER_COLOURS={gold:'#ffe3a0',white:'#ffffff',ivory:'#fff5df',champagne:'#f7e1b5',blush:'#ffd6e0',rosegold:'#f6c3a8',mint:'#d8f3e4'};
export const LETTER_FONTS=['Georgia','Times New Roman','Palatino Linotype','Arial','Trebuchet MS','Verdana'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
// "2026-12-24" -> "24th December 2026"; any other text is shown unchanged.
export function formatReelDate(value){
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
 if(!m)return String(value || '').trim();
 const day=Number(m[3]),month=Number(m[2]);
 if(month<1||month>12||day<1||day>31)return m[0];
 const suffix=day%100>=11&&day%100<=13?'th':({1:'st',2:'nd',3:'rd'}[day%10] || 'th');
 return day+suffix+' '+MONTHS[month-1]+' '+m[1];
}
// "19:30" -> "7:30 PM", "00:15" -> "12:15 AM"; any other text is shown unchanged.
export function formatReelTime(value){
 const m=/^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(value || '').trim());
 if(!m)return String(value || '').trim();
 const hour=Number(m[1]);if(hour>23||Number(m[2])>59)return m[0];
 return (hour%12 || 12)+':'+m[2]+' '+(hour<12?'AM':'PM');
}
export function reelEditKey({clips=[],...settings}){
 return JSON.stringify({...settings,clips:clips.map(c=>({videoUrl:c.videoUrl,ceremony:c.ceremony,editableDetails:c.editableDetails,storyScene:c.storyScene,weddingScenes:c.weddingScenes,weddingLayout:c.weddingLayout}))});
}
function lines(ctx,text,width){
 const words=String(text || '').trim().split(/\s+/),result=[];let line='';
 for(const word of words){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>width){result.push(line);line=word;}else line=next;}if(line)result.push(line);return result;
}
export function addressLines(ctx,text,width){
 const value=String(text || '').trim().replace(/\s+/g,' ');if(!value)return [];
 // Keep the address on one line whenever it fits.
 if(ctx.measureText(value).width<=width)return [value];
 const greedy=lines(ctx,value,width);
 // Otherwise balance the lines: the narrowest width that still needs the same number of lines.
 let lo=Math.max(...value.split(' ').map(w=>ctx.measureText(w).width)),hi=width;
 if(lo>=hi)return greedy;
 for(let k=0;k<20&&hi-lo>1;k++){const mid=(lo+hi)/2;if(lines(ctx,value,mid).length<=greedy.length)hi=mid;else lo=mid;}
 // Do not silently discard lines of a long address.
 return lines(ctx,value,hi);
}
// Let each ritual play before its invitation copy appears. The action is visible
// first, then the ceremony details fade in during the same scene.
export function occasionRevealProgress(progress){
 const value=Number(progress);
 if(!Number.isFinite(value)||value<=0.3)return 0;
 return Math.min(1,(value-0.3)/0.14);
}
export function drawReelLettering(ctx,{event,names,look='gold',lettering=DEFAULT_LETTERING,panel=false,reveal=1}){
 const opacity=Math.max(0,Math.min(1,Number(reveal)));
 if(opacity===0)return;
 const font=LETTER_FONTS.includes(lettering.font)?lettering.font:'Georgia';
 const heading=[40,48,58,68].includes(Number(lettering.heading))?Number(lettering.heading):58;
 const address=[26,30,36,42].includes(Number(lettering.address))?Number(lettering.address):36;
 // Names and date follow the heading size (58 -> 34 and 30, as before).
 const nameSize=Math.round(heading*34/58),dateSize=Math.round(heading*30/58);
 const backdrop=['fade','strong','box','none'].includes(lettering.backdrop)?lettering.backdrop:'fade';
 // Full-scene text is queued first so a background box can be sized to the text before it is drawn.
 const surface=!panel&&LETTER_SURFACES.includes(lettering.surface)?lettering.surface:'none';
 let role='text';
 const queue=[],draw=panel?(t,px,py,w)=>ctx.fillText(t,px,py,w):(t,px,py,w)=>queue.push({t,px,py,w,font:ctx.font,role});
 const startY={none:100,banner:96,board:900,arch:430}[surface];
 const x=panel?197:360,width=panel?280:({none:650,banner:600,board:480,arch:420}[surface]);let y=panel?415:startY;
 const headingChoice=REEL_HEADING_FONTS[headingFontKey(lettering,panel?'none':surface)];
 const headingFont=headingChoice.family?"'"+headingChoice.family+"', "+font:font,headingSize=Math.round(heading*headingChoice.scale);
 ctx.save();
 ctx.globalAlpha=opacity;
 if(panel){ctx.fillStyle='rgba(255,248,232,.96)';ctx.fillRect(25,290,344,830);ctx.strokeStyle='#b99053';ctx.lineWidth=3;ctx.strokeRect(37,304,320,802);ctx.fillStyle=look==='gold'?'#71322b':'#292044';}

 ctx.textAlign='center';
 function block(text,size,maxLines,family=font){ctx.font=size+'px '+family;const wrapped=lines(ctx,text,width);for(const line of wrapped.slice(0,maxLines)){draw(line,x,y,width);y+=size*1.2;}y+=14;}
 role='heading';block(event.title,headingSize,2,headingFont);role='text';block(names,nameSize,panel?3:2);
 block([formatReelDate(event.date),formatReelTime(event.time)].filter(Boolean).join(' · '),dateSize,panel?2:1);
 ctx.font=address+'px '+font;
 // A venue that is only a little too wide is shrunk slightly so it stays on one line.
 const venueText=String(event.venue || '').trim().replace(/\s+/g,' '),venueWidth=venueText?ctx.measureText(venueText).width:0;
 if(!panel&&venueWidth>width&&venueWidth<=width*1.3)ctx.font=Math.floor(address*width/venueWidth)+'px '+font;
 let venueLines=addressLines(ctx,venueText,width);
 if(panel&&venueLines.length>3){
  venueLines=addressLines(ctx,event.venue,650);
  const lineHeight=address*1.2,top=Math.max(700,1230-venueLines.length*lineHeight);
  ctx.fillStyle='rgba(20,11,25,.85)';ctx.fillRect(16,top-address-12,688,venueLines.length*lineHeight+address+24);
  ctx.fillStyle='#fff5df';ctx.shadowColor='#000';ctx.shadowBlur=5;
  venueLines.forEach((line,i)=>ctx.fillText(line,360,top+i*lineHeight,650));
 }else{venueLines.forEach(line=>{draw(line,x,y,width);y+=address*1.2;});}
 // Optional dress-code theme for the ceremony, shown under the venue like the other details.
 if(String(event.theme || '').trim()){ctx.font='italic '+Math.round(address*0.9)+'px '+font;y+=6;for(const line of lines(ctx,'Theme: '+String(event.theme).trim(),width).slice(0,2)){draw(line,x,y,width);y+=address*1.1;}}
 if(!panel&&surface!=='none'){drawSurface(ctx,surface,startY,y,!!lettering.solid);const colours=surface==='board'?{heading:'#e9c46a',text:'#fff5df'}:{heading:'#8c1c2b',text:'#4a3020'};ctx.shadowBlur=0;for(const q of queue){ctx.font=q.font;ctx.fillStyle=colours[q.role] || colours.text;ctx.fillText(q.t,q.px,q.py,q.w);}}
 else if(!panel){
  const bottom=Math.max(200,y);
  if(backdrop==='fade'||backdrop==='strong'){const end=backdrop==='strong'?Math.max(610,bottom+140):610,gradient=ctx.createLinearGradient(0,0,0,end);gradient.addColorStop(0,backdrop==='strong'?'#140b19f0':'#140b19dd');if(backdrop==='strong')gradient.addColorStop(.7,'#140b19b0');gradient.addColorStop(1,'#140b1900');ctx.fillStyle=gradient;ctx.fillRect(0,0,720,end);}
  else if(backdrop==='box'){ctx.fillStyle='rgba(20,11,25,.55)';const top=40,h=bottom-top+10,r=28;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(28,top,664,h,r);else ctx.rect(28,top,664,h);ctx.fill();}
  ctx.fillStyle=LETTER_COLOURS[look] || LETTER_COLOURS.gold;ctx.shadowColor='#000';ctx.shadowBlur=backdrop==='none'?14:8;
  for(const q of queue){ctx.font=q.font;ctx.fillText(q.t,q.px,q.py,q.w);}
 }
 ctx.restore();
}

// Decorated surfaces behind the ceremony text, like a printed invitation: a cream banner at the top,
// a dark board in the lower half, or an arched cream card in the middle.
function roundedRect(ctx,x,y,w,h,r){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);}
// solid: fully opaque and taller, to hide text already printed on an uploaded video.
function drawSurface(ctx,surface,startY,endY,solid=false){
 ctx.save();ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowBlur=18;
 if(surface==='banner'){const top=28,h=Math.max(220,endY-top+14);const g=ctx.createLinearGradient(0,top,0,top+h);g.addColorStop(0,'#fffaf0');g.addColorStop(1,'#f1e0bd');ctx.fillStyle=g;roundedRect(ctx,18,top,684,h,20);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#b99053';ctx.lineWidth=4;roundedRect(ctx,18,top,684,h,20);ctx.stroke();ctx.lineWidth=1.5;roundedRect(ctx,30,top+12,660,h-24,14);ctx.stroke();ctx.fillStyle='#b99053';for(const [cx,cy] of [[46,top+28],[674,top+28],[46,top+h-28],[674,top+h-28]]){ctx.beginPath();ctx.moveTo(cx,cy-9);ctx.lineTo(cx+9,cy);ctx.lineTo(cx,cy+9);ctx.lineTo(cx-9,cy);ctx.closePath();ctx.fill();}}
 else if(surface==='board'){const top=solid?Math.min(startY-100,750):startY-100,h=Math.max(240,endY-top+20,solid?1262-top:0);ctx.fillStyle=solid?'#120e14':'rgba(18,14,20,.93)';roundedRect(ctx,96,top,528,h,26);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#c9a24a';ctx.lineWidth=5;roundedRect(ctx,96,top,528,h,26);ctx.stroke();ctx.lineWidth=1.5;roundedRect(ctx,110,top+14,500,h-28,18);ctx.stroke();}
 else if(surface==='arch'){const top=startY-170,bottom=Math.max(startY+260,endY+60),cy=top+250;const g=ctx.createLinearGradient(0,top,0,bottom);g.addColorStop(0,'#fffaf0');g.addColorStop(1,'#f3e6c9');const path=()=>{ctx.beginPath();ctx.moveTo(110,bottom);ctx.lineTo(110,cy);ctx.arc(360,cy,250,Math.PI,0);ctx.lineTo(610,bottom);ctx.closePath();};ctx.fillStyle=g;path();ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#b99053';ctx.lineWidth=5;path();ctx.stroke();ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(126,bottom-14);ctx.lineTo(126,cy);ctx.arc(360,cy,234,Math.PI,0);ctx.lineTo(594,bottom-14);ctx.closePath();ctx.stroke();}
 ctx.restore();
}
