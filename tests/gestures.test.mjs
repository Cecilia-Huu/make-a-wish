import test from 'node:test'
import assert from 'node:assert/strict'
import {GestureEngine} from '../src/gesture.ts'
import {BlowDetector} from '../src/audio.ts'
import {LoveGate} from '../src/love.ts'
import {MouthGate} from '../src/mouth.ts'
import {playWord} from '../src/voice.ts'
test('all eight words use the same selected voice and settings; I says /aɪ/',()=>{
  const previousWindow=globalThis.window,previousUtterance=globalThis.SpeechSynthesisUtterance,spoken=[]
  globalThis.window={speechSynthesis:{cancel(){},speak(utterance){spoken.push(utterance)}}}
  globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text}}
  try{
    const voice={name:'Selected English Voice',lang:'en-US'}
    const words=['I','love','you','so much','Happy','Birthday','to','you']
    words.forEach((text,i)=>playWord(`${i<4?'Left':'Right'}-${i%4}`,text,voice,.94,1.08))
    assert.equal(spoken.length,8)
    assert.equal(spoken[0].text,'eye')
    assert.deepEqual(spoken.slice(1).map(u=>u.text),words.slice(1))
    for(const utterance of spoken){assert.equal(utterance.voice,voice);assert.equal(utterance.rate,.94);assert.equal(utterance.pitch,1.08)}
  }finally{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;if(previousUtterance===undefined)delete globalThis.SpeechSynthesisUtterance;else globalThis.SpeechSynthesisUtterance=previousUtterance}
})
function hand(pose){
  const p=Array.from({length:21},()=>({x:.5,y:.65,z:0}))
  p[0]={x:.5,y:.82,z:0};p[2]={x:.42,y:.62,z:0};p[4]={x:pose==='fist'?.49:.34,y:pose==='fist'?.57:.55,z:0}
  const m=[5,9,13,17],pip=[6,10,14,18],tip=[8,12,16,20]
  m.forEach((n,i)=>{p[n]={x:.45+i*.04,y:.55,z:0};p[pip[i]]={x:.45+i*.04,y:.43,z:0};p[tip[i]]={x:.45+i*.04,y:pose==='open'||pose==='point'&&i===0?.27:.54,z:0}})
  if(pose==='pinch'){p[4]={x:.55,y:.55,z:0};p[20]={x:.56,y:.55,z:0};p[8].y=.27;p[12].y=.27;p[16].y=.27}
  return p
}
test('word pinch fires once per closure, repeats after release',()=>{
  const g=new GestureEngine(),pinch=hand('pinch'),open=hand('open')
  assert.equal(g.update('Right',pinch,100,false,true).pinchIndex,null)
  assert.equal(g.update('Right',pinch,160,false,true).pinchIndex,3)
  assert.equal(g.update('Right',pinch,230,false,true).pinchIndex,null)
  g.update('Right',open,300,false,true)
  g.update('Right',pinch,360,false,true)
  assert.equal(g.update('Right',pinch,420,false,true).pinchIndex,3)
})
test('all four thumb-to-finger combinations trigger independently on either hand',()=>{
  for(const side of ['Left','Right'])for(let i=0;i<4;i++){
    const g=new GestureEngine(),pose=hand('open'),tip=[8,12,16,20][i]
    pose[tip].y=.55;pose[4]={x:pose[tip].x,y:.55,z:0}
    assert.equal(g.update(side,pose,100,false,true).pinchIndex,null)
    assert.equal(g.update(side,pose,180,false,true).pinchIndex,i,`${side} finger ${i}`)
    assert.equal(g.update(side,pose,250,false,true).pinchIndex,null)
  }
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
