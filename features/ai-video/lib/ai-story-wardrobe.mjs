export const STORY_OUTFITS = [
  ['auto','Match this scene automatically'],
  ['casual','Everyday casual'],['work','College / work'],
  ['traditional','Traditional Indian'],['festive','Festive celebration'],
  ['evening','Evening / date'],['travel','Travel / outdoors'],['custom','Describe my own'],
];
const outfits={
  casual:['a relaxed blouse with jeans','a casual shirt with chinos'],
  work:['a smart modest blouse and trousers','a neat collared shirt and trousers'],
  traditional:['a graceful saree with understated jewellery','a traditional kurta with trousers'],
  festive:['a festive embroidered ethnic outfit with jewellery','a festive embroidered kurta and jacket'],
  evening:['an elegant evening dress','a tailored evening jacket and shirt'],
  travel:['a comfortable top, light jacket and trousers','a comfortable shirt, light jacket and trousers'],
};
const palettes=[['soft blue','warm beige'],['rose pink','navy blue'],['sage green','cream'],['deep plum','charcoal'],['coral','ivory'],['lavender','forest green']];
export function sceneWardrobe(scene,index=0){
  const kind=scene.guide?.kind ?? index,moment=scene.guide?.moment;
  let preset=scene.wardrobe || 'auto';
  if(preset==='auto'||preset==='custom')preset=['school','college','work'].includes(moment)?'work':['travel','trip','distance','journey','walk'].includes(moment)?'travel':['festival','blessings','family','home'].includes(moment)?'traditional':['proposal','coffee','dinner'].includes(moment)?'evening':'casual';
  const pair=outfits[preset] || outfits.casual,colors=palettes[Math.abs(kind)%palettes.length];
  const tint=(color,item)=>item.replace(/^an? /,'a '+color+' ');
  return {bride:scene.brideOutfit?.trim() || tint(colors[0],pair[0]),groom:scene.groomOutfit?.trim() || tint(colors[1],pair[1])};
}
export function sceneWardrobePrompt(scene,index=0){
  const outfit=sceneWardrobe(scene,index);
  return 'Wardrobe for this scene: bride / first partner wears '+outfit.bride+'; groom / second partner wears '+outfit.groom+'. Apply these outfits from the start of this scene; do not copy clothing from the uploaded photo or carry the previous scene’s outfits into this new moment. Keep these clothes consistent within this scene, then use a clean scene transition for the next outfit, not an on-screen clothing transformation.';
}
