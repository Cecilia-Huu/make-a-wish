import React,{useCallback,useEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {FilesetResolver,HandLandmarker,GestureRecognizer,FaceLandmarker,type NormalizedLandmark,type GestureRecognizerResult} from '@mediapipe/tasks-vision'
import {Cake} from './Cake'
import {GestureEngine,type Side,type GestureName} from './gesture'
import {BlowDetector,analyzeAudio} from './audio'
import {LoveGate} from './love'
import {MouthGate,type MouthSample} from './mouth'
import {playWord,preferredVoice,say,stopVoice,type WordKey} from './voice'
import './style.css'

type Phase='unlit'|'lit'|'wished'
type Burst={id:number;x:number;y:number;kind:'word'|'light'|'wish'}
type DebugHand={side:Side;raw:string;gesture:GestureName;phase:string;distances:number[];reason:string;category:string;confidence:number;word:string;points:{x:number;y:number}[]}
type CameraDiagnostics={videoWidth:number;videoHeight:number;settings:MediaTrackSettings;constraints:MediaTrackConstraints;cssWidth:number;cssHeight:number;coverScale:number;cropX:number;cropY:number;devicePixelRatio:number}
type VoiceEvent={id:number;side:Side;finger:string;word:string;time:string;status:string}
type Spark={x:number;y:number;vx:number;vy:number;life:number;size:number;color:string;kind:'heart'|'star';born:number;duration:number;targetX?:number;targetY?:number;variant?:number;rotation?:number}
const words:Record<Side,string[]>={Left:['I','love','you','so much'],Right:['Happy','Birthday','to','you']}
const fingers=['食指','中指','无名指','小拇指']
const englishFingers=['index finger','middle finger','ring finger','little finger']
const colors=['#fff4d3','#f5d18d','#ffc9d5','#fffdf3','#eeb5bd']
function makeHeartSprite(light:string,mid:string,shadow:string){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256
  const ctx=canvas.getContext('2d')!
  const shape=()=>{ctx.beginPath();ctx.moveTo(128,224);ctx.bezierCurveTo(99,203,19,158,18,96);ctx.bezierCurveTo(15,31,88,12,128,72);ctx.bezierCurveTo(169,12,241,30,238,96);ctx.bezierCurveTo(237,157,157,208,128,224);ctx.closePath()}
  ctx.shadowColor='#b93d6866';ctx.shadowBlur=13;ctx.shadowOffsetY=7;shape()
  const fill=ctx.createRadialGradient(76,54,9,155,163,178);fill.addColorStop(0,light);fill.addColorStop(.47,mid);fill.addColorStop(1,shadow);ctx.fillStyle=fill;ctx.fill()
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle='#fff9f3b8';ctx.lineWidth=3;ctx.stroke()
  ctx.save();shape();ctx.clip()
  const shine=ctx.createRadialGradient(65,57,4,72,76,70);shine.addColorStop(0,'#ffffffdd');shine.addColorStop(.34,'#ffffff55');shine.addColorStop(1,'#ffffff00');ctx.fillStyle=shine;ctx.fillRect(19,26,200,170)
  ctx.fillStyle='#ffffffdc';ctx.beginPath();ctx.ellipse(62,56,13,6,-.72,0,Math.PI*2);ctx.fill()
  ctx.fillStyle='#ffffff36';ctx.beginPath();ctx.ellipse(183,154,31,19,-.3,0,Math.PI*2);ctx.fill();ctx.restore()
  return canvas
}
function screenPoint(lm:NormalizedLandmark,v:HTMLVideoElement){
  const scale=Math.max(innerWidth/v.videoWidth,innerHeight/v.videoHeight)
  const cropX=(v.videoWidth*scale-innerWidth)/2,cropY=(v.videoHeight*scale-innerHeight)/2
  return {x:v.videoWidth*scale-lm.x*v.videoWidth*scale-cropX,y:lm.y*v.videoHeight*scale-cropY}
}
function message(e:unknown,device:'camera'|'microphone'){
  const err=e as DOMException
  if(err?.name==='NotAllowedError')return `${device==='camera'?'摄像头':'麦克风'}权限被拒绝，请在浏览器地址栏允许后重试。`
  if(err?.name==='NotFoundError')return `没有找到可用的${device==='camera'?'摄像头':'麦克风'}。`
  return err?.message||`${device==='camera'?'摄像头':'麦克风'}启动失败。`
}
function App(){
  const video=useRef<HTMLVideoElement>(null),cameraStream=useRef<MediaStream|null>(null),micStream=useRef<MediaStream|null>(null)
  const landmarker=useRef<HandLandmarker|null>(null),recognizer=useRef<GestureRecognizer|null>(null),faceModel=useRef<FaceLandmarker|null>(null),raf=useRef(0),lastVideoTime=useRef(-1),lastFaceAt=useRef(0),gesture=useRef(new GestureEngine()),loveGate=useRef(new LoveGate()),mouthGate=useRef(new MouthGate())
  const audio=useRef<AudioContext|null>(null),sfx=useRef<AudioContext|null>(null),audioRaf=useRef(0),blow=useRef(new BlowDetector()),latestRms=useRef(0)
  const phaseRef=useRef<Phase>('unlit'),litAt=useRef(0),rightRaw=useRef<Side>('Right'),calibration=useRef<{label:Side;since:number}|null>(null),calibrating=useRef(false)
  const sensitivityRef=useRef(55),debugRef=useRef(false),skeletonRef=useRef(true),debugCanvas=useRef<HTMLCanvasElement>(null),fxCanvas=useRef<HTMLCanvasElement>(null),fxRaf=useRef(0),fxAt=useRef(0),heartSprites=useRef<HTMLCanvasElement[]|null>(null),sparks=useRef<Spark[]>([])
  const lastWordRef=useRef<Record<Side,string>>({Left:'',Right:''}),loveSeenAt=useRef<Record<Side,number>>({Left:-Infinity,Right:-Infinity}),uiAt=useRef(0),audioUiAt=useRef(0),lastInferenceAt=useRef(0),voiceRef=useRef<SpeechSynthesisVoice|undefined>(undefined),rateRef=useRef(.94),pitchRef=useRef(1.08),mouthThresholdRef=useRef(.3),mouthHoldRef=useRef(950),wickRadiusRef=useRef(105),cameraGeneration=useRef(0)
  const [phase,setPhase]=useState<Phase>('unlit'),[cameraOn,setCameraOn]=useState(false),[micOn,setMicOn]=useState(false),[loading,setLoading]=useState(false)
  const [status,setStatus]=useState('开启摄像头，让双手进入画面。'),[error,setError]=useState(''),[lastWord,setLastWord]=useState<{text:string;id:number}|null>(null)
  const [bursts,setBursts]=useState<Burst[]>([]),[handsSeen,setHandsSeen]=useState<Side[]>([]),[pointer,setPointer]=useState<{x:number;y:number}|null>(null),[activeSide,setActiveSide]=useState<Side|null>(null)
  const [debug,setDebug]=useState(false),[debugHands,setDebugHands]=useState<DebugHand[]>([]),[showSkeleton,setShowSkeleton]=useState(true),[showGuides,setShowGuides]=useState(true),[scale,setScale]=useState(1),[offsetX,setOffsetX]=useState(0),[offsetY,setOffsetY]=useState(0),[wickRadius,setWickRadius]=useState(105)
  const [sensitivity,setSensitivity]=useState(55),[meter,setMeter]=useState(0),[blowProgress,setBlowProgress]=useState(0),[blowStrength,setBlowStrength]=useState(0),[noiseFloor,setNoiseFloor]=useState(.004),[rightLabel,setRightLabel]=useState<Side>('Right'),[isCalibrating,setIsCalibrating]=useState(false)
  const [mouthProgress,setMouthProgress]=useState(0),[mouthStage,setMouthStage]=useState('no-face'),[mouthScore,setMouthScore]=useState(0),[mouthThreshold,setMouthThreshold]=useState(.3),[mouthHold,setMouthHold]=useState(950),[faceStatus,setFaceStatus]=useState('未开启'),[handMode,setHandMode]=useState('加载中')
  const [cameraDiagnostics,setCameraDiagnostics]=useState<CameraDiagnostics|null>(null)
  const [lastTrigger,setLastTrigger]=useState<VoiceEvent|null>(null),[voiceEvents,setVoiceEvents]=useState<VoiceEvent[]>([])
  const [loveProgress,setLoveProgress]=useState(0),[loveText,setLoveText]=useState(false),[showVoice,setShowVoice]=useState(false),[voices,setVoices]=useState<SpeechSynthesisVoice[]>([]),[voiceURI,setVoiceURI]=useState(''),[rate,setRate]=useState(.94),[pitch,setPitch]=useState(1.08)
  const burst=useCallback((x:number,y:number,kind:Burst['kind'])=>{
    const id=performance.now()+Math.random();setBursts(b=>[...b.slice(-8),{id,x,y,kind}]);window.setTimeout(()=>setBursts(b=>b.filter(p=>p.id!==id)),1600)
  },[])
  const animateSparks=useCallback(()=>{
    const canvas=fxCanvas.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return
    const now=performance.now();if(now-fxAt.current<32){fxRaf.current=requestAnimationFrame(animateSparks);return}fxAt.current=now
    const ratio=Math.min(devicePixelRatio||1,1.5),w=innerWidth,h=innerHeight
    if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio)}
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h)
    sparks.current=sparks.current.filter(p=>now-p.born<p.duration)
    for(const p of sparks.current){const elapsed=now-p.born;if(elapsed<0)continue;const pct=elapsed/p.duration
      ctx.globalAlpha=Math.max(0,Math.min(1,elapsed/170,(p.duration-elapsed)/510))
      if(p.kind==='heart'){
        const travel=Math.min(1,elapsed/570),ease=1-(1-travel)**3
        const x=p.x+(p.targetX!-p.x)*ease+Math.sin(elapsed*.0016+p.rotation!)*5,y=p.y+(p.targetY!-p.y)*ease-Math.max(0,elapsed-570)*.034
        const size=p.size*(.36+.64*ease)*(1-.16*pct)
        const sprite=heartSprites.current?.[p.variant||0]
        if(sprite){ctx.save();ctx.translate(x,y);ctx.rotate(p.rotation||0);ctx.drawImage(sprite,-size/2,-size/2,size,size);ctx.restore()}
      }else{p.x+=p.vx;p.y+=p.vy;ctx.shadowBlur=15;ctx.shadowColor=p.color;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size*(1-pct*.4),0,Math.PI*2);ctx.fill()}
    }ctx.globalAlpha=1;ctx.shadowBlur=0
    fxRaf.current=sparks.current.length?requestAnimationFrame(animateSparks):0
  },[])
  const emitHearts=useCallback((positions:{x:number;y:number}[])=>{
    heartSprites.current??=[makeHeartSprite('#fff5f7','#ff9eb9','#d84d80'),makeHeartSprite('#fffafa','#f7c6d5','#e592aa'),makeHeartSprite('#fff2e3','#f4b8b4','#d77c95')]
    const now=performance.now(),w=innerWidth,h=innerHeight,cols=w<600?5:8,rows=w<600?6:5
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const center=positions[(row+col)%positions.length],size=Math.min(w<600?112:185,Math.max(56,w/cols*(.65+Math.random()*.65)))
      sparks.current.push({x:center.x+(Math.random()-.5)*28,y:center.y+(Math.random()-.5)*24,vx:0,vy:0,life:1,size,color:'#f6aec8',kind:'heart',born:now+Math.random()*280,duration:2700+Math.random()*450,targetX:(col+.5+(Math.random()-.5)*.66)*w/cols,targetY:(row+.4+(Math.random()-.5)*.7)*h/rows,variant:(row+col)%3,rotation:(Math.random()-.5)*.42})
    }
    for(const center of positions)for(let i=0;i<16;i++)sparks.current.push({x:center.x+(Math.random()-.5)*70,y:center.y+(Math.random()-.5)*50,vx:(Math.random()-.5)*3,vy:-.5-Math.random()*2,life:1,size:1+Math.random()*3,color:colors[(i+Math.floor(Math.random()*3))%colors.length],kind:'star',born:now,duration:1450})
    if(!fxRaf.current)fxRaf.current=requestAnimationFrame(animateSparks)
  },[animateSparks])
  const magicSound=useCallback(()=>{
    const ctx=sfx.current;if(!ctx||ctx.state!=='running')return
    const at=ctx.currentTime;[523.25,659.25,783.99].forEach((frequency,i)=>{const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.0001,at+i*.12);gain.gain.exponentialRampToValueAtTime(.035,at+i*.12+.025);gain.gain.exponentialRampToValueAtTime(.0001,at+i*.12+.55);oscillator.connect(gain).connect(ctx.destination);oscillator.start(at+i*.12);oscillator.stop(at+i*.12+.57)})
  },[])
  const speak=useCallback((side:Side,index:number,x:number,y:number)=>{
    const word=words[side][index],id=Date.now()+Math.random(),event:VoiceEvent={id,side,finger:englishFingers[index],word,time:new Date().toLocaleTimeString(),status:'queued'}
    lastWordRef.current[side]=word;setLastTrigger(event);setVoiceEvents(previous=>[...previous.slice(-5),event]);setActiveSide(side);setLastWord({text:word,id:performance.now()});burst(x,y,'word');setStatus(`${side==='Left'?'左手':'右手'} · ${word}`)
    playWord(`${side}-${index}` as WordKey,word,voiceRef.current,rateRef.current,pitchRef.current,status=>setVoiceEvents(previous=>previous.map(item=>item.id===id?{...item,status}:item)))
  },[burst])
  const light=useCallback(()=>{
    if(phaseRef.current!=='unlit')return;phaseRef.current='lit';setPhase('lit');litAt.current=performance.now();blow.current.reset();mouthGate.current.reset();setBlowProgress(0);setMouthProgress(0)
    const wick=document.querySelector('.wick-anchor')?.getBoundingClientRect();burst(wick?wick.left+wick.width/2:innerWidth/2,wick?wick.top:innerHeight*.7,'light')
    setStatus('Close your eyes and make a wish. 然后先自然闭嘴，再保持 O 型嘴模拟吹气。')
  },[burst])
  const finish=useCallback(()=>{
    if(phaseRef.current!=='lit')return;phaseRef.current='wished';setPhase('wished');setBlowProgress(0);setMouthProgress(0)
    const wick=document.querySelector('.wick-anchor')?.getBoundingClientRect(),x=wick?wick.left+wick.width/2:innerWidth/2,y=wick?wick.top:innerHeight*.7
    burst(x,y,'wish');window.setTimeout(()=>{if(phaseRef.current==='wished')burst(x,y-58,'wish')},1250);setStatus('May all your wishes come true. ✨')
  },[burst])
  const reset=()=>{phaseRef.current='unlit';setPhase('unlit');blow.current.reset();mouthGate.current.reset();loveGate.current.reset();gesture.current.reset();loveSeenAt.current={Left:-Infinity,Right:-Infinity};setBlowProgress(0);setMouthProgress(0);setLoveProgress(0);setLoveText(false);setLastWord(null);setActiveSide(null);setStatus('新的生日魔法准备好了。指向烛芯停留，或点击蜡烛。')}
  const drawDebug=(hands:DebugHand[],zone:{x:number;y:number}|null)=>{
    const c=debugCanvas.current,ctx=c?.getContext('2d');if(!c||!ctx)return
    const ratio=Math.min(devicePixelRatio||1,1.5);c.width=innerWidth*ratio;c.height=innerHeight*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,innerWidth,innerHeight)
    const links:[number,number][]=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]]
    if(skeletonRef.current)for(const h of hands){ctx.strokeStyle=h.phase==='PINCH_CANDIDATE'?'#ffbad2cc':'#fff9edaa';ctx.lineWidth=1.2;ctx.shadowColor='#ffdce8';ctx.shadowBlur=5
      for(const [a,b] of links){ctx.beginPath();ctx.moveTo(h.points[a].x,h.points[a].y);ctx.lineTo(h.points[b].x,h.points[b].y);ctx.stroke()}
      h.points.forEach((p,i)=>{ctx.beginPath();ctx.fillStyle=(i===4||[8,12,16,20].includes(i))&&h.distances[[8,12,16,20].indexOf(i)]<.4?'#ff9fbd':'#fffaf0';ctx.arc(p.x,p.y,i===0?2.4:2,0,Math.PI*2);ctx.fill()})
      ctx.shadowBlur=0
    }
    if(!debugRef.current)return
    if(zone){ctx.strokeStyle='#e6b659';ctx.lineWidth=1.5;ctx.setLineDash([6,6]);ctx.beginPath();ctx.arc(zone.x,zone.y,wickRadius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([])}
    for(const h of hands){ctx.fillStyle=h.side==='Left'?'#ffb6c8':'#ffdfa0';for(const p of h.points){ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill()}
      const center=h.points[9];ctx.font='600 13px sans-serif';ctx.fillText(`${h.side} (${h.raw}) · ${h.gesture} ${h.word}`,center.x+12,center.y-12)}
  }
  const readCameraDiagnostics=useCallback(()=>{
    const v=video.current,track=cameraStream.current?.getVideoTracks()[0]
    if(!v||!track)return
    const rect=v.getBoundingClientRect(),scale=v.videoWidth&&v.videoHeight?Math.max(rect.width/v.videoWidth,rect.height/v.videoHeight):0
    const visibleSourceWidth=scale?rect.width/scale:v.videoWidth,visibleSourceHeight=scale?rect.height/scale:v.videoHeight
    setCameraDiagnostics({videoWidth:v.videoWidth,videoHeight:v.videoHeight,settings:track.getSettings(),constraints:track.getConstraints(),cssWidth:rect.width,cssHeight:rect.height,coverScale:scale,cropX:Math.max(0,(v.videoWidth-visibleSourceWidth)/v.videoWidth*100),cropY:Math.max(0,(v.videoHeight-visibleSourceHeight)/v.videoHeight*100),devicePixelRatio:window.devicePixelRatio||1})
  },[])
  useEffect(()=>{
    if(!debug||!cameraOn)return
    readCameraDiagnostics();const id=window.setInterval(readCameraDiagnostics,750)
    window.addEventListener('resize',readCameraDiagnostics)
    return()=>{window.clearInterval(id);window.removeEventListener('resize',readCameraDiagnostics)}
  },[debug,cameraOn,readCameraDiagnostics])
  const analyze=useCallback(()=>{
    const v=video.current,l=recognizer.current||landmarker.current;if(!v||!l||!cameraStream.current)return
    const frameAt=performance.now()
    if(v.readyState>=2&&v.currentTime!==lastVideoTime.current&&frameAt-lastInferenceAt.current>=33){
      lastVideoTime.current=v.currentTime;lastInferenceAt.current=frameAt
      try{
        const result=recognizer.current?recognizer.current.recognizeForVideo(v,frameAt):landmarker.current!.detectForVideo(v,frameAt)
        const now=performance.now(),seen:Side[]=[],debugList:DebugHand[]=[],loveHands:Partial<Record<Side,{x:number;y:number}>>={};let progress=0
        const rawLabels=result.handednesses.map(h=>h[0]?.categoryName).filter((x):x is Side=>x==='Left'||x==='Right')
        if(calibrating.current){
          if(rawLabels.length===1){const label=rawLabels[0];if(calibration.current?.label!==label)calibration.current={label,since:now}
            else if(now-calibration.current.since>700){rightRaw.current=label;setRightLabel(label);calibrating.current=false;setIsCalibrating(false);calibration.current=null;gesture.current.reset();loveGate.current.reset();setStatus('右手校准完成。真实右手对应 Birthday Wish。')}}
          else calibration.current=null
        }
        const wick=document.querySelector('.wick-anchor')?.getBoundingClientRect(),zone=wick?{x:wick.left+wick.width/2,y:wick.top+wick.height/2}:null
        result.landmarks.forEach((lm,i)=>{
          const raw=result.handednesses[i]?.[0]?.categoryName as Side|undefined;if(raw!=='Left'&&raw!=='Right')return
          const side:Side=raw===rightRaw.current?'Right':'Left',index=screenPoint(lm[8],v),palm=screenPoint(lm[9],v);seen.push(side)
          const category=recognizer.current?(result as GestureRecognizerResult).gestures[i]?.[0]:undefined
          const handConfidence=result.handednesses[i]?.[0]?.score??0
          if(category?.categoryName==='ILoveYou'&&category.score>=.55)loveSeenAt.current[side]=now
          // A short grace period bridges classifier jitter and keeps pinch events muted.
          const isLove=now-loveSeenAt.current[side]<180
          if(isLove)loveHands[side]=palm
          const near=!!zone&&Math.hypot(index.x-zone.x,index.y-zone.y)<wickRadiusRef.current
          const event=gesture.current.update(raw,lm,now,near,phaseRef.current==='unlit',isLove,handConfidence,category?.categoryName||'')
          if(event.light)light()
          if(event.pinchIndex!==null)speak(side,event.pinchIndex,index.x,index.y)
          if(side==='Right')setPointer(index)
          if(debugRef.current||skeletonRef.current)debugList.push({side,raw,gesture:event.name,phase:event.pinchPhase,distances:event.distances,reason:event.reason,category:category?.categoryName||'—',confidence:handConfidence,word:lastWordRef.current[side],points:lm.map(p=>screenPoint(p,v))})
          progress=Math.max(progress,event.lightProgress)
        })
        const loveResult=loveGate.current.update(!!loveHands.Left,!!loveHands.Right,now)
        if(loveResult.triggered){emitHearts([loveHands.Left!,loveHands.Right!]);setLoveText(true);magicSound();setStatus('Sending you all my love ♡');window.setTimeout(()=>setLoveText(false),2500)}
        ;(['Left','Right'] as Side[]).forEach(s=>gesture.current.lost(s,now))
        if(now-uiAt.current>100){setHandsSeen(seen);setDebugHands(debugList);setLightProgress(progress);setLoveProgress(loveResult.progress);if(!seen.includes('Right'))setPointer(null);uiAt.current=now}
        if(debugRef.current||skeletonRef.current)drawDebug(debugList,zone)
        // Face inference is independent and runs around 10 fps, only after lighting.
        if(phaseRef.current==='lit'&&faceModel.current&&now-lastFaceAt.current>=95){
          lastFaceAt.current=now
          const face=faceModel.current.detectForVideo(v,performance.now()),lm=face.faceLandmarks[0],shapes=face.faceBlendshapes[0]?.categories
          const scores=new Map(shapes?.map(c=>[c.categoryName,c.score])||[])
          const lipRatio=lm?Math.abs(lm[13].y-lm[14].y)*v.videoHeight/(Math.max(.001,Math.abs(lm[61].x-lm[291].x)*v.videoWidth)):0
          const sample:MouthSample={face:!!lm,funnel:scores.get('mouthFunnel')||0,pucker:scores.get('mouthPucker')||0,jawOpen:scores.get('jawOpen')||0,lipRatio}
          const m=mouthGate.current.update(sample,performance.now(),mouthThresholdRef.current,mouthHoldRef.current)
          setMouthStage(m.stage);setMouthScore(m.score);setMouthProgress(m.progress)
          if(m.triggered)finish()
        }
      }catch(e){setError(`追踪中断：${message(e,'camera')}`);setStatus('仍可点击完成体验。');return}
    }raf.current=requestAnimationFrame(analyze)
  },[light,speak,emitHearts,magicSound,finish])
  const [lightProgress,setLightProgress]=useState(0)
  const stopCamera=()=>{cameraGeneration.current++;cancelAnimationFrame(raf.current);cameraStream.current?.getTracks().forEach(t=>t.stop());cameraStream.current=null;setCameraDiagnostics(null);if(video.current)video.current.srcObject=null;recognizer.current?.close();recognizer.current=null;landmarker.current?.close();landmarker.current=null;faceModel.current?.close();faceModel.current=null;loveGate.current.reset();loveSeenAt.current={Left:-Infinity,Right:-Infinity};mouthGate.current.reset();setCameraOn(false);setPointer(null);setHandsSeen([]);setDebugHands([]);setFaceStatus('未开启');drawDebug([],null)}
  const startCamera=async()=>{
    if(cameraStream.current){stopCamera();setStatus('摄像头已关闭，可点击词语与蜡烛。');return}
    if(!navigator.mediaDevices?.getUserMedia){setError('摄像头需要 localhost 或 HTTPS。');return}
    const generation=++cameraGeneration.current
    try{sfx.current??=new AudioContext();void sfx.current.resume()}catch{/* effect stays silent if audio is blocked */}
    setLoading(true);setError('');setStatus('正在请求摄像头权限与加载手势模型…')
    try{
      const videoRequests:MediaTrackConstraints[]=[
        {facingMode:'user',width:{min:1280,ideal:1920},height:{min:720,ideal:1080},frameRate:{ideal:30,max:30}},
        {facingMode:'user',width:{min:1280,ideal:1280},height:{min:720,ideal:720},frameRate:{ideal:30,max:30}},
        {facingMode:'user',width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},
        {facingMode:'user'}
      ]
      let stream:MediaStream|null=null,lastCameraError:unknown
      for(const constraints of videoRequests){
        try{stream=await navigator.mediaDevices.getUserMedia({video:constraints,audio:false});break}
        catch(e){lastCameraError=e;const name=(e as DOMException)?.name;if(name==='NotAllowedError'||name==='SecurityError'||name==='NotFoundError'||name==='NotReadableError')break}
      }
      if(!stream)throw lastCameraError||new Error('无法开启摄像头')
      cameraStream.current=stream
      if(!video.current)throw new Error('视频容器尚未就绪');video.current.srcObject=stream;await video.current.play()
      readCameraDiagnostics()
      const vision=await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`)
      const opts=(path:string,delegate:'GPU'|'CPU')=>({baseOptions:{modelAssetPath:path,delegate},runningMode:'VIDEO' as const,numHands:2,minHandDetectionConfidence:.56,minTrackingConfidence:.55})
      try{recognizer.current=await GestureRecognizer.createFromOptions(vision,opts(`${import.meta.env.BASE_URL}models/gesture_recognizer.task`,'GPU'))}
      catch{try{recognizer.current=await GestureRecognizer.createFromOptions(vision,opts(`${import.meta.env.BASE_URL}models/gesture_recognizer.task`,'CPU'))}catch{
        try{landmarker.current=await HandLandmarker.createFromOptions(vision,opts(`${import.meta.env.BASE_URL}models/hand_landmarker.task`,'GPU'))}
        catch{landmarker.current=await HandLandmarker.createFromOptions(vision,opts(`${import.meta.env.BASE_URL}models/hand_landmarker.task`,'CPU'))}
      }}
      if(generation!==cameraGeneration.current){recognizer.current?.close();landmarker.current?.close();return}
      setHandMode(recognizer.current?'ILoveYou 分类已就绪':'仅关键点模式 · 双手爱心不可用')
      setCameraOn(true);setStatus('手势已就绪。双手 🤟 稳定保持约 0.8 秒可发送爱心。');raf.current=requestAnimationFrame(analyze)
      stream.getVideoTracks()[0].onended=()=>{stopCamera();setStatus('摄像头连接已结束。')}
      setFaceStatus('加载中')
      void (async()=>{try{
        let model:FaceLandmarker
        const faceOptions=(delegate:'GPU'|'CPU')=>({baseOptions:{modelAssetPath:`${import.meta.env.BASE_URL}models/face_landmarker.task`,delegate},runningMode:'VIDEO' as const,numFaces:1,outputFaceBlendshapes:true,minFaceDetectionConfidence:.56,minTrackingConfidence:.55})
        try{model=await FaceLandmarker.createFromOptions(vision,faceOptions('GPU'))}catch{model=await FaceLandmarker.createFromOptions(vision,faceOptions('CPU'))}
        if(generation!==cameraGeneration.current){model.close();return}faceModel.current=model;setFaceStatus('已就绪')
      }catch(e){if(generation===cameraGeneration.current){setFaceStatus('模型错误');setError('嘴型模型未能加载，仍可使用麦克风或点击熄灭。'+message(e,'camera'))}}})()
    }catch(e){stopCamera();setError(message(e,'camera')+' 可先用鼠标体验。');setStatus('摄像头未就绪。')}
    finally{setLoading(false)}
  }
  const stopMic=()=>{cancelAnimationFrame(audioRaf.current);micStream.current?.getTracks().forEach(t=>t.stop());micStream.current=null;void audio.current?.close();audio.current=null;setMicOn(false);setMeter(0);setBlowProgress(0)}
  const startMic=async()=>{
    if(micStream.current){stopMic();setStatus('麦克风已关闭，可点击熄灭蜡烛。');return}
    if(!navigator.mediaDevices?.getUserMedia){setError('麦克风需要 localhost 或 HTTPS。');return}
    setError('')
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});micStream.current=stream
      const context=new AudioContext();audio.current=context;await context.resume()
      const source=context.createMediaStreamSource(stream),analyser=context.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.3;source.connect(analyser)
      const time=new Float32Array(analyser.fftSize),freq=new Uint8Array(analyser.frequencyBinCount)
      const tick=()=>{
        if(!micStream.current||context.state==='closed')return
        analyser.getFloatTimeDomainData(time);analyser.getByteFrequencyData(freq)
        const sample=analyzeAudio(time,freq,context.sampleRate),now=performance.now();latestRms.current=sample.rms
        const active=phaseRef.current==='lit'&&now-litAt.current>850
        const result=blow.current.update(sample,now,active,sensitivityRef.current)
        if(now-audioUiAt.current>70){setMeter(Math.round(sample.rms*1000));setBlowStrength(result.strength);setBlowProgress(result.progress);setNoiseFloor(blow.current.noiseFloor);audioUiAt.current=now}
        if(result.triggered)finish()
        audioRaf.current=requestAnimationFrame(tick)
      };tick();setMicOn(true);setStatus('麦克风已开启，可作为吹灭蜡烛的辅助方式。')
      stream.getAudioTracks()[0].onended=()=>{stopMic();setStatus('麦克风连接已结束，可点击熄灭蜡烛。')}
    }catch(e){stopMic();setError(message(e,'microphone')+' 可点击蜡烛继续。')}
  }
  const calibrate=()=>{if(!cameraOn){setStatus('请先开启摄像头，再举起真实右手校准。');return}calibrating.current=true;setIsCalibrating(true);calibration.current=null;setStatus('只举起你的真实右手，保持约 1 秒。')}
  useEffect(()=>{
    if(!('speechSynthesis' in window))return
    const update=()=>{const english=window.speechSynthesis.getVoices().filter(v=>v.lang.toLowerCase().startsWith('en'));setVoices(english);const selected=english.find(v=>v.voiceURI===voiceRef.current?.voiceURI)||preferredVoice(english);voiceRef.current=selected;setVoiceURI(selected?.voiceURI||'')}
    update();window.speechSynthesis.addEventListener('voiceschanged',update)
    return()=>window.speechSynthesis.removeEventListener('voiceschanged',update)
  },[])
  useEffect(()=>{debugRef.current=debug;skeletonRef.current=showSkeleton;if(!debug&&!showSkeleton)drawDebug([],null)},[debug,showSkeleton])
  useEffect(()=>()=>{cancelAnimationFrame(raf.current);cancelAnimationFrame(audioRaf.current);cancelAnimationFrame(fxRaf.current);cameraStream.current?.getTracks().forEach(t=>t.stop());micStream.current?.getTracks().forEach(t=>t.stop());recognizer.current?.close();landmarker.current?.close();faceModel.current?.close();void audio.current?.close();void sfx.current?.close();stopVoice()},[])
  return <main className={`experience ${phase} ${Math.max(mouthProgress,blowProgress)>0?'is-blowing':''}`}>
    <video ref={video} className={`camera-feed ${cameraOn?'show':''}`} autoPlay muted playsInline aria-label="镜像摄像头画面"/>
    <div className="soft-light"/><canvas ref={fxCanvas} className="fx-canvas" aria-hidden="true"/><canvas ref={debugCanvas} className="debug-canvas" aria-hidden="true"/>
    <header className="topbar"><div className="top-title"><h1>Make a Wish</h1><p>A Gesture & Voice Birthday Experience</p></div><div className="device-status"><span className={cameraOn?'on':''}>● Camera {cameraOn?'On':'Off'}</span><span className={micOn?'on':''}>● Mic {micOn?'On':'Off'}</span></div></header>
    {showGuides&&<><div className="gesture-guide left"><div className="guide-title">♡ &nbsp; Love Message <small>LEFT HAND</small></div>{words.Left.map((w,i)=><button className={activeSide==='Left'&&lastWord?.text===w?'active':''} key={i} onClick={()=>speak('Left',i,innerWidth*.23,innerHeight*.62)}><span>拇指 + {fingers[i]}</span><strong>{w}</strong></button>)}</div><div className="gesture-guide right"><div className="guide-title">✦ &nbsp; Birthday Wish <small>RIGHT HAND</small></div>{words.Right.map((w,i)=><button className={activeSide==='Right'&&lastWord?.text===w?'active':''} key={i} onClick={()=>speak('Right',i,innerWidth*.77,innerHeight*.62)}><span>拇指 + {fingers[i]}</span><strong>{w}</strong></button>)}</div></>}
    <button className="guide-toggle" onClick={()=>setShowGuides(!showGuides)}>{showGuides?'隐藏手势提示':'显示手势提示'}</button>
    {pointer&&cameraOn&&<span className="hand-cursor" style={{left:pointer.x,top:pointer.y}}/>}
    {bursts.map(b=><div key={b.id} className={`burst ${b.kind}`} style={{left:b.x,top:b.y}}>{Array.from({length:b.kind==='wish'?20:12},(_,i)=><i key={i} style={{'--i':i,'--n':b.kind==='wish'?20:12} as React.CSSProperties}>{i%4===0?'♡':'✦'}</i>)}</div>)}
    {lastWord&&<div className="spoken-word" key={lastWord.id}>{lastWord.text}{activeSide==='Left'?' ♡':' ✦'}</div>}
    {loveText&&<div className="love-message" aria-live="polite">Sending you all my love ♡</div>}
    {loveProgress>0&&loveProgress<1&&<div className="love-hold">♡ {Math.round(loveProgress*100)}%</div>}
    <div className="cake-position" style={{'--cake-scale':scale,'--cake-x':`${offsetX}px`,'--cake-y':`${offsetY}px`} as React.CSSProperties}><Cake lit={phase==='lit'} wished={phase==='wished'} blowProgress={Math.max(mouthProgress,blowProgress)} onCandle={()=>phaseRef.current==='unlit'?light():phaseRef.current==='lit'?finish():reset()}/>{phase==='unlit'&&lightProgress>0&&<div className="light-progress" style={{'--progress':`${lightProgress*100}%`} as React.CSSProperties}>✦</div>}</div>
    {phase==='wished'&&<div className="ending"><span>May all your wishes come true. ✨</span><small>双手比 🤟，让爱心从掌心飘起</small><button onClick={reset}>Replay ↺</button></div>}
    <div className="bottom-zone"><div className="flow">Gesture & Speak <span>→</span> Light the Candle <span>→</span> Make a Wish</div><div className="status-line" aria-live="polite">{status}</div>{phase==='lit'&&<div className="mouth-hint">先自然闭嘴，再保持 O 型嘴约 1 秒，模拟吹灭蜡烛 · {Math.round(mouthProgress*100)}%</div>}<div className="controls"><button onClick={startCamera} disabled={loading}>{loading?'正在加载…':cameraOn?'关闭 Camera':'开启 Camera'}</button><button onClick={startMic}>{micOn?'关闭 Mic':'开启 Mic（可选）'}</button>{phase==='lit'&&<button className="primary" onClick={finish}>点击吹灭 ♡</button>}{phase==='wished'&&<button onClick={reset}>Replay</button>}<button onClick={()=>setShowVoice(!showVoice)} aria-expanded={showVoice}>♫ Voice Settings</button><button className="settings-button" onClick={()=>setDebug(!debug)} aria-pressed={debug}>⚙ 调试</button></div><p className="privacy-note">视频与麦克风输入仅在浏览器处理，不上传或存储。也可直接点击词语与蜡烛体验。</p></div>
    {showVoice&&<aside className="voice-panel"><div className="debug-head"><strong>Voice Settings</strong><button onClick={()=>setShowVoice(false)} aria-label="关闭声音设置">×</button></div><label>English voice<select value={voiceURI} onChange={e=>{const v=voices.find(item=>item.voiceURI===e.target.value);voiceRef.current=v;setVoiceURI(e.target.value)}}>{voices.length?voices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>):<option value="">浏览器暂无英语语音</option>}</select></label><button onClick={()=>say('Happy Birthday to you',voiceRef.current,rateRef.current,pitchRef.current)}>试听当前声音 ▶</button><label>语速 {rate.toFixed(2)}<input type="range" min=".7" max="1.2" step=".02" value={rate} onChange={e=>{const n=+e.target.value;setRate(n);rateRef.current=n}}/></label><label>音调 {pitch.toFixed(2)}<input type="range" min=".8" max="1.4" step=".02" value={pitch} onChange={e=>{const n=+e.target.value;setPitch(n);pitchRef.current=n}}/></label><small>音质取决于浏览器和系统安装的声音。</small></aside>}
    {debug&&<aside className="debug-panel"><div className="debug-head"><strong>Gesture · Face · Mic <small>V2.3.1</small></strong><button onClick={()=>setDebug(false)}>×</button></div>
      <hr/><strong>Camera · 画质诊断</strong>
      <div>视频源：{video.current?.readyState===4?'实时播放':video.current?.readyState===2?'已可用':'等待中'} · {video.current?.videoWidth||0} × {video.current?.videoHeight||0}</div>
      {cameraDiagnostics&&<>
        <div>Track 实际设置：{cameraDiagnostics.settings.width||'—'} × {cameraDiagnostics.settings.height||'—'} · {cameraDiagnostics.settings.frameRate?.toFixed(1)||'—'} fps</div>
        <div>采集设备：{cameraDiagnostics.settings.deviceId?'已选设备':'浏览器默认设备'} · {cameraDiagnostics.settings.facingMode||'user'}</div>
        <div>CSS 显示框：{Math.round(cameraDiagnostics.cssWidth)} × {Math.round(cameraDiagnostics.cssHeight)} px</div>
        <div>object-fit: cover 缩放：{cameraDiagnostics.coverScale.toFixed(2)}× · 裁切 X {cameraDiagnostics.cropX.toFixed(1)}% / Y {cameraDiagnostics.cropY.toFixed(1)}%</div>
        <div>DPR {cameraDiagnostics.devicePixelRatio.toFixed(2)}× · 源像素到屏幕像素：{(cameraDiagnostics.coverScale*cameraDiagnostics.devicePixelRatio).toFixed(2)}×</div>
        <div>屏幕物理像素需求：{Math.round(cameraDiagnostics.cssWidth*cameraDiagnostics.devicePixelRatio)} × {Math.round(cameraDiagnostics.cssHeight*cameraDiagnostics.devicePixelRatio)}</div>
        <details><summary>Track constraints / settings</summary><pre className="camera-json">{JSON.stringify({constraints:cameraDiagnostics.constraints,settings:cameraDiagnostics.settings},null,2)}</pre></details>
      </>}
      <small>展示和识别都直接读取 video；没有展示用 Canvas 降采样。cover 会裁切以填满视口。</small>
      <div>手部模型：{handMode}</div><div>识别：{handsSeen.length?handsSeen.join(' / '):'等待手部'} · 真实右手：{rightLabel}</div>
      <button onClick={calibrate}>{isCalibrating?'请只举真实右手…':'校准真实右手'}</button><button onClick={()=>{rightRaw.current=rightRaw.current==='Right'?'Left':'Right';setRightLabel(rightRaw.current);gesture.current.reset();loveGate.current.reset()}}>切换左右映射</button>
      <label><input type="checkbox" checked={showSkeleton} onChange={e=>setShowSkeleton(e.target.checked)}/> 显示手部骨架</label>
      {debugHands.map((h,i)=><div key={i} className="gesture-debug-row"><strong>{h.side}</strong> / 原始 {h.raw} · {h.phase} · {h.category} · {h.reason} · 置信 {Math.round(h.confidence*100)}%<br/><small>拇指到食指/中指/无名指/小拇指：{h.distances.map(value=>value.toFixed(2)).join(' / ')} · 阈值 {0.23} / 松开 {0.40} · 最近播报 {h.word||'—'}</small></div>)}
      <div><strong>最近手势触发：</strong>{lastTrigger?`${lastTrigger.side} + ${lastTrigger.finger} → “${lastTrigger.word}” · ${lastTrigger.time}`:'暂无'}</div>
      <div><strong>语音事件：</strong></div>{voiceEvents.slice().reverse().map(event=><div className="gesture-debug-row" key={event.id}>{event.time} · {event.side} + {event.finger} → “{event.word}” · {event.status}</div>)}
      <div>双手 🤟 保持 {Math.round(loveProgress*100)}%</div><div className="meter"><i style={{width:`${loveProgress*100}%`}}/></div><button onClick={()=>{emitHearts([{x:innerWidth*.42,y:innerHeight*.5},{x:innerWidth*.58,y:innerHeight*.5}]);setLoveText(true);magicSound();window.setTimeout(()=>setLoveText(false),2500)}}>预览爱心 ♡</button>
      <hr/><label>蛋糕缩放 <input type="range" min=".65" max="1.5" step=".05" value={scale} onChange={e=>setScale(+e.target.value)}/></label><label>蛋糕 X <input type="range" min="-180" max="180" value={offsetX} onChange={e=>setOffsetX(+e.target.value)}/></label><label>蛋糕 Y <input type="range" min="-150" max="150" value={offsetY} onChange={e=>setOffsetY(+e.target.value)}/></label><label>烛芯感应半径 {wickRadius}px <input type="range" min="65" max="180" value={wickRadius} onChange={e=>{setWickRadius(+e.target.value);wickRadiusRef.current=+e.target.value}}/></label>
      <hr/><div>Face {faceStatus} · 状态 {mouthStage} · O 指标 {mouthScore.toFixed(2)}</div><div>O 型嘴进度 {Math.round(mouthProgress*100)}%</div><div className="meter"><i style={{width:`${mouthProgress*100}%`}}/></div><label>O 型阈值 {mouthThreshold.toFixed(2)}<input type="range" min=".15" max=".65" step=".01" value={mouthThreshold} onChange={e=>{const n=+e.target.value;setMouthThreshold(n);mouthThresholdRef.current=n}}/></label><label>保持时间 {mouthHold}ms<input type="range" min="800" max="1200" step="50" value={mouthHold} onChange={e=>{const n=+e.target.value;setMouthHold(n);mouthHoldRef.current=n}}/></label><small>O 型嘴只模拟吹气；讲话或表情仍可能误触发。</small>
      <hr/><div>Mic {micOn?'运行中':'关闭'} · 输入 {meter}/1000 · 底噪 {noiseFloor.toFixed(3)}</div><div className="meter"><i style={{width:`${Math.min(100,blowStrength*65)}%`}}/></div><div>麦克风进度 {Math.round(blowProgress*100)}%</div><div className="meter"><i style={{width:`${blowProgress*100}%`}}/></div><label>灵敏度 {sensitivity}<input type="range" min="0" max="100" value={sensitivity} onChange={e=>{const n=+e.target.value;setSensitivity(n);sensitivityRef.current=n}}/></label><button onClick={()=>{blow.current.calibrate(latestRms.current);setNoiseFloor(blow.current.noiseFloor)}} disabled={!micOn}>用当前环境校准底噪</button></aside>}
    {error&&<div role="alert" className="error-banner">{error}<button onClick={()=>setError('')} aria-label="关闭提示">×</button></div>}
  </main>
}
createRoot(document.getElementById('root')!).render(<App/>)
