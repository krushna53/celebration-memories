export function fullSceneRect(sourceWidth,sourceHeight,width=720,height=1280){
 if(![sourceWidth,sourceHeight,width,height].every(n=>Number.isFinite(n)&&n>0))throw new Error('Invalid video dimensions');
 const scale=Math.min(width/sourceWidth,height/sourceHeight),w=sourceWidth*scale,h=sourceHeight*scale;
 return {x:(width-w)/2,y:(height-h)/2,width:w,height:h};
}
// Fill the whole portrait frame by cropping the sides (or top/bottom); focusX 0-100 picks which part of a wide video stays visible.
export function fillSceneRect(sourceWidth,sourceHeight,width=720,height=1280,focusX=50){
 if(![sourceWidth,sourceHeight,width,height].every(n=>Number.isFinite(n)&&n>0))throw new Error('Invalid video dimensions');
 const scale=Math.max(width/sourceWidth,height/sourceHeight),w=sourceWidth*scale,h=sourceHeight*scale,f=Math.min(100,Math.max(0,Number.isFinite(Number(focusX))?Number(focusX):50))/100;
 return {x:(width-w)*f+0,y:(height-h)/2+0,width:w,height:h};
}
export function drawFullScene(ctx,video,width,height,framing={}){
 const sourceWidth=video.videoWidth || video.width,sourceHeight=video.videoHeight || video.height;
 if(framing.mode==='invite'){return drawInviteFrame(ctx,video,sourceWidth,sourceHeight,width,height,framing);}
 if(framing.mode==='fill'){const fill=zoomedSceneRect(sourceWidth,sourceHeight,width,height,framing.focusX,framing.zoom);if(fill.width<width-.5 || fill.height<height-.5){const backgroundScale=Math.max((width+64)/sourceWidth,(height+64)/sourceHeight),w=sourceWidth*backgroundScale,h=sourceHeight*backgroundScale;ctx.save();ctx.filter='blur(24px)';ctx.drawImage(video,(width-w)/2,(height-h)/2,w,h);ctx.restore();ctx.fillStyle='rgba(23,17,39,.28)';ctx.fillRect(0,0,width,height);ctx.drawImage(video,fill.x,fill.y,fill.width,fill.height);return fill;}ctx.save();ctx.fillStyle='#171127';ctx.fillRect(0,0,width,height);ctx.drawImage(video,fill.x,fill.y,fill.width,fill.height);ctx.restore();return fill;}
 const rect=fullSceneRect(sourceWidth,sourceHeight,width,height);
 ctx.save();ctx.fillStyle='#171127';ctx.fillRect(0,0,width,height);
 if(rect.width<width-.5 || rect.height<height-.5){
  const backgroundScale=Math.max((width+64)/sourceWidth,(height+64)/sourceHeight),w=sourceWidth*backgroundScale,h=sourceHeight*backgroundScale;
  ctx.save();ctx.filter='blur(24px)';ctx.drawImage(video,(width-w)/2,(height-h)/2,w,h);ctx.restore();ctx.fillStyle='rgba(23,17,39,.28)';ctx.fillRect(0,0,width,height);
 }
 ctx.drawImage(video,rect.x,rect.y,rect.width,rect.height);ctx.restore();return rect;
}

// zoom 100 = fill the frame (crop sides), 0 = show the whole wide video; values in between show more people with thin blurred bars.
export function zoomedSceneRect(sourceWidth,sourceHeight,width=720,height=1280,focusX=50,zoom=100){
 const fit=fullSceneRect(sourceWidth,sourceHeight,width,height),fill=fillSceneRect(sourceWidth,sourceHeight,width,height,focusX);
 const z=Math.min(100,Math.max(0,Number.isFinite(Number(zoom))?Number(zoom):100))/100;
 if(z===1)return fill;
 const w=fit.width+(fill.width-fit.width)*z,h=fit.height+(fill.height-fit.height)*z,f=Math.min(100,Math.max(0,Number.isFinite(Number(focusX))?Number(focusX):50))/100;
 const x=w>width?(width-w)*f:(width-w)/2;
 return {x:x+0,y:(height-h)/2+0,width:w,height:h};
}

// Invitation layout for wide clips: the whole width of the video sits in the lower part of the 9:16 frame and the
// space above becomes a designed invitation background (cream or night) for the ceremony banner, instead of blurred bars.
export function inviteSceneRect(sourceWidth,sourceHeight,width=720,height=1280,zoom=75,focusX=50){
 const fitScale=width/sourceWidth,maxScale=Math.max(width/sourceWidth,(height*0.86)/sourceHeight);
 const z=Math.min(100,Math.max(0,Number.isFinite(Number(zoom))?Number(zoom):75))/100,scale=fitScale+(maxScale-fitScale)*z;
 const w=sourceWidth*scale,h=Math.min(sourceHeight*scale,height),f=Math.min(100,Math.max(0,Number.isFinite(Number(focusX))?Number(focusX):50))/100;
 return {x:(w>width?(width-w)*f:(width-w)/2)+0,y:height-h,width:w,height:h};
}
function drawInviteFrame(ctx,video,sourceWidth,sourceHeight,width,height,framing){
 const rect=inviteSceneRect(sourceWidth,sourceHeight,width,height,framing.zoom ?? 75,framing.focusX);
 const night=framing.background==='night';
 ctx.save();
 const g=ctx.createLinearGradient(0,0,0,rect.y+40);
 if(night){g.addColorStop(0,'#1b1029');g.addColorStop(1,'#3a2140');}else{g.addColorStop(0,'#fbf3e3');g.addColorStop(1,'#efdcb4');}
 ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
 // soft gold dots pattern so the space reads as a printed invitation
 ctx.fillStyle=night?'rgba(233,196,106,.18)':'rgba(185,144,83,.16)';
 for(let yy=24;yy<rect.y;yy+=48)for(let xx=(yy/48)%2?24:48;xx<width;xx+=48){ctx.beginPath();ctx.arc(xx,yy,2.4,0,Math.PI*2);ctx.fill();}
 ctx.drawImage(video,rect.x,rect.y,rect.width,rect.height);
 // gold edge between the background and the video
 ctx.fillStyle='#b99053';ctx.fillRect(0,rect.y-6,width,6);ctx.fillStyle=night?'#e9c46a':'#fff6e2';ctx.fillRect(0,rect.y-2,width,2);
 ctx.restore();return rect;
}
