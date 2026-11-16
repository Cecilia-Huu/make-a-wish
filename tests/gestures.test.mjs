import test from 'node:test'
import assert from 'node:assert/strict'
import {GestureEngine} from '../src/gesture.ts'
import {BlowDetector} from '../src/audio.ts'
import {LoveGate} from '../src/love.ts'
import {MouthGate} from '../src/mouth.ts'
import {playWord} from '../src/voice.ts'
test('all eight words use the same selected voice and settings; I says /aɪ/',()=>{
  const previousWindow=globalThis.window,previousUtterance=globalThis.SpeechSynthesisUtterance,spoken=[];let canceled=0
  globalThis.window={speechSynthesis:{cancel(){canceled++},speak(utterance){spoken.push(utterance)}}}
  globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text}}
  try{
    const voice={name:'Selected English Voice',lang:'en-US'}
    const words=['I','love','you','so much','Happy','Birthday','to','you']
    words.forEach((text,i)=>playWord(`${i<4?'Left':'Right'}-${i%4}`,text,voice,.94,1.08))
    assert.equal(spoken.length,8)
    assert.equal(spoken[0].text,'eye')
    assert.deepEqual(spoken.slice(1).map(u=>u.text),words.slice(1))
    assert.ok(canceled>=8,'each word cancels pending speech before speaking')
    for(const utterance of spoken){assert.equal(utterance.voice,voice);assert.equal(utterance.rate,.94);assert.equal(utterance.pitch,1.08)}
  }finally{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;if(previousUtterance===undefined)delete globalThis.SpeechSynthesisUtterance;else globalThis.SpeechSynthesisUtterance=previousUtterance}
})
function hand(pose,target=0){
  const p=Array.from({length:21},()=>({x:.5,y:.65,z:0}))
  const m=[5,9,13,17],pip=[6,10,14,18],tip=[8,12,16,20],xs=[.40,.46,.52,.58]
  p[0]={x:.50,y:.82,z:0};p[2]={x:.36,y:.62,z:0};p[4]={x:.30,y:.55,z:0}
  m.forEach((n,i)=>{p[n]={x:xs[i],y:.55,z:0};p[pip[i]]={x:xs[i],y:.43,z:0};p[tip[i]]={x:xs[i],y:.27,z:0}})
  if(pose==='pinch'){
    p[4]={x:.48,y:.54,z:0};p[tip[target]]={x:.48,y:.55,z:0}
  }else if(pose==='fist'){
    p[4]={x:.49,y:.59,z:0};tip.forEach((n,i)=>{p[n]={x:.48+(i%2)*.02,y:.61,z:0};p[pip[i]]={x:xs[i],y:.61,z:0}})
  }else if(pose==='ily'){
    p[4]={x:.49,y:.59,z:0}
    for(const i of [1,2])p[tip[i]]={x:.48+(i-1)*.02,y:.61,z:0}
  }else if(pose==='point'){
    for(const i of [1,2,3]){p[tip[i]]={x:xs[i],y:.60,z:0};p[pip[i]]={x:xs[i],y:.60,z:0}}
  }else if(pose==='relaxed'){
    p[4]={x:.42,y:.55,z:0};p[tip[0]]={x:.46,y:.47,z:0}
  }
  return p
}
function updateAt(g,side,pose,time,opts={}){return g.update(side,hand(pose,opts.target??0),time,false,true,opts.love??false,opts.confidence??1,opts.category??'')}
function firePinch(g,side,target,time){
  updateAt(g,side,'pinch',time,{target})
  const events=[]
  for(let t=time+33;t<=time+198;t+=33){const result=updateAt(g,side,'pinch',t,{target});if(result.pinchIndex!==null)events.push(result.pinchIndex)}
  return {events,nextTime:time+231}
}
test('A: 30 seconds of hands held naturally in view never speaks',()=>{
  const g=new GestureEngine();let fired=0
  for(const side of ['Left','Right'])updateAt(g,side,'open',0)
  for(let t=33;t<30000;t+=33)for(const side of ['Left','Right']){const e=updateAt(g,side,'relaxed',t);if(e.pinchIndex!==null)fired++}
  assert.equal(fired,0)
})
test('B: all eight mapped pinch words trigger 10/10 after an observed release',()=>{
  for(const side of ['Left','Right'])for(let finger=0;finger<4;finger++){
    const g=new GestureEngine();let t=0,fired=0
    updateAt(g,side,'open',t);t+=33
    for(let trial=0;trial<10;trial++){
      const result=firePinch(g,side,finger,t);fired+=result.events.filter(i=>i===finger).length;t=result.nextTime
      updateAt(g,side,'open',t);t+=33
    }
    assert.equal(fired,10,`${side} finger ${finger}`)
  }
})
test('C: a three-second held pinch fires once only',()=>{
  const g=new GestureEngine();updateAt(g,'Right','open',0);let fired=0
  for(let t=33;t<3033;t+=33){const e=updateAt(g,'Right','pinch',t,{target:2});if(e.pinchIndex!==null)fired++}
  assert.equal(fired,1)
})
test('D: a clear release rearms the same word',()=>{
  const g=new GestureEngine();updateAt(g,'Left','open',0)
  const first=firePinch(g,'Left',0,33);updateAt(g,'Left','open',first.nextTime)
  const second=firePinch(g,'Left',0,first.nextTime+33)
  assert.equal(first.events.length,1);assert.equal(second.events.length,1)
})
test('E: open palm, fist, I Love You, point and ambiguous nearby fingers do not speak',()=>{
  const poses=['open','fist','ily','point'];
  for(const pose of poses){const g=new GestureEngine();updateAt(g,'Right','open',0);let fired=0
    for(let t=33;t<1200;t+=33){const e=updateAt(g,'Right',pose,t,{love:pose==='ily',category:pose==='fist'?'Closed_Fist':''});if(e.pinchIndex!==null)fired++}
    assert.equal(fired,0,pose)
  }
  const g=new GestureEngine();updateAt(g,'Left','open',0);const ambiguous=hand('pinch',0);ambiguous[8]={...ambiguous[20]}
  let fired=0;for(let t=33;t<700;t+=33){const e=g.update('Left',ambiguous,t,false,true,false,1);if(e.pinchIndex!==null)fired++}
  assert.equal(fired,0)
})
test('F: first-seen pinch, low confidence, rapid side changes and tracking loss require a fresh release',()=>{
  const g=new GestureEngine();let fired=0
  for(let t=0;t<500;t+=33)if(updateAt(g,'Left','pinch',t).pinchIndex!==null)fired++
  assert.equal(fired,0)
  updateAt(g,'Left','open',510)
  for(let t=543;t<800;t+=33)if(updateAt(g,'Left','pinch',t,{confidence:.4}).pinchIndex!==null)fired++
  assert.equal(fired,0)
  updateAt(g,'Left','open',810);updateAt(g,'Left','pinch',843)
  g.lost('Left',880)
  updateAt(g,'Right','pinch',900)
  for(let t=933;t<1300;t+=33)if(updateAt(g,'Right','pinch',t).pinchIndex!==null)fired++
  assert.equal(fired,0)
  updateAt(g,'Right','open',1310)
  assert.equal(firePinch(g,'Right',1,1343).events.length,1)
})
test('a long inference gap cannot complete an old pinch candidate',()=>{
  const g=new GestureEngine();updateAt(g,'Left','open',0);updateAt(g,'Left','pinch',33)
  assert.equal(updateAt(g,'Left','pinch',250).pinchIndex,null)
  assert.equal(firePinch(g,'Left',0,283).events.length,0)
})
test('point dwell lights only near wick, without a pinch word',()=>{
  const g=new GestureEngine(),point=hand('point')
  assert.equal(g.update('Left',point,100,false,true).light,false)
  assert.equal(g.update('Left',point,200,true,true).light,false)
  assert.equal(g.update('Left',point,850,true,true).light,false)
  const event=g.update('Left',point,1001,true,true)
  assert.equal(event.light,true);assert.equal(event.pinchIndex,null)
  assert.equal(g.update('Left',point,1100,true,true).light,false)
})
test('both love classifications hold then release and rearm',()=>{
  const gate=new LoveGate()
  assert.equal(gate.update(false,true,100).triggered,false)
  assert.equal(gate.update(true,true,150).triggered,false)
  assert.equal(gate.update(true,true,960).triggered,true)
  assert.equal(gate.update(true,true,1050).triggered,false)
  gate.update(false,true,1200);gate.update(false,true,1500)
  gate.update(true,true,1700)
  assert.equal(gate.update(true,true,2550).triggered,true)
  const g=new GestureEngine(),pinch=hand('pinch')
  assert.equal(g.update('Left',pinch,100,false,true,true).pinchIndex,null)
  assert.equal(g.update('Left',pinch,200,false,true,true).name,'love')
})
test('O mouth requires neutral calibration, steady pose and cooldown',()=>{
  const g=new MouthGate(),neutral={face:true,funnel:.04,pucker:.05,jawOpen:.03,lipRatio:.05},o={face:true,funnel:.48,pucker:.52,jawOpen:.25,lipRatio:.32}
  assert.equal(g.update(o,100,.3,950).triggered,false)
  g.update(neutral,200,.3,950);g.update(neutral,500,.3,950)
  assert.equal(g.update(o,600,.3,950).progress,0)
  assert.equal(g.update(o,1200,.3,950).triggered,false)
  assert.equal(g.update(o,1600,.3,950).triggered,true)
  assert.equal(g.update(o,1750,.3,950).triggered,false)
})
test('blow requires lit phase and sustained broadband input',()=>{
  const d=new BlowDetector(),air={rms:.04,highRatio:.45,flatness:.22},speech={rms:.06,highRatio:.12,flatness:.05}
  for(let t=100;t<800;t+=100)assert.equal(d.update(air,t,false,55).triggered,false)
  for(let t=1000;t<1800;t+=100)assert.equal(d.update(speech,t,true,55).triggered,false)
  let triggered=0
  for(let t=2000;t<2700;t+=100)if(d.update(air,t,true,55).triggered)triggered++
  assert.equal(triggered,1)
})
