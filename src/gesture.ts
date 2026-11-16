import type {NormalizedLandmark} from '@mediapipe/tasks-vision'

export type Side='Left'|'Right'
export type GestureName='love'|'point'|'pinch'|'idle'
export type PinchPhase='RELEASED'|'PINCH_CANDIDATE'|'PINCH_CONFIRMED'|'WAIT_FOR_RELEASE'
export type GestureResult={name:GestureName;pinchIndex:number|null;pinchPhase:PinchPhase;distances:number[];thresholds:number[];lightProgress:number;light:boolean;reason:string}
type HandState={phase:PinchPhase;armed:boolean;pinchCandidate:number|null;pinchSince:number;pointSince:number;lastSeen:number;lightDone:boolean}
const tips=[8,12,16,20],pips=[6,10,14,18],mcps=[5,9,13,17]
const d=(a:NormalizedLandmark,b:NormalizedLandmark)=>Math.hypot(a.x-b.x,a.y-b.y)
const ENTER=[.23,.23,.23,.29]
const RELEASE=.40
const HOLD_MS=[105,105,105,90]
const MIN_CONFIDENCE=.62
const MAX_SAMPLE_GAP=120
const fresh=():HandState=>({phase:'RELEASED',armed:false,pinchCandidate:null,pinchSince:0,pointSince:0,lastSeen:0,lightDone:false})

/** Pinch words require an observed release, a unique bent target finger and a sustained closure. */
export class GestureEngine {
  private state:Record<Side,HandState>={Left:fresh(),Right:fresh()}
  reset(){this.state={Left:fresh(),Right:fresh()}}
  lost(label:Side,now:number){
    const s=this.state[label]
    if(s.lastSeen&&now>s.lastSeen){const next=fresh();next.phase='WAIT_FOR_RELEASE';this.state[label]=next}
  }
  update(label:Side,lm:NormalizedLandmark[],now:number,nearWick:boolean,unlit:boolean,isLove=false,confidence=1,classification=''):GestureResult {
    const s=this.state[label],palm=Math.max(d(lm[0],lm[9]),.04)
    if(s.lastSeen&&now-s.lastSeen>MAX_SAMPLE_GAP){s.phase='WAIT_FOR_RELEASE';s.armed=false;s.pinchCandidate=null;s.pinchSince=0}
    const distances=tips.map(t=>d(lm[4],lm[t])/palm)
    const folded=tips.map((t,i)=>d(lm[t],lm[mcps[i]])<d(lm[pips[i]],lm[mcps[i]])*1.5)
    const extended=tips.map((t,i)=>d(lm[t],lm[mcps[i]])>d(lm[pips[i]],lm[mcps[i]])*1.5)
    const point=extended[0]&&folded.slice(1).every(Boolean)&&distances[0]>.43
    let light=false,lightProgress=0,pinchIndex:number|null=null
    if(!unlit){s.pointSince=0;s.lightDone=false}
    else if(point&&nearWick&&!s.lightDone&&!isLove){
      if(!s.pointSince)s.pointSince=now
      lightProgress=Math.min(1,(now-s.pointSince)/800)
      if(lightProgress>=1){light=true;s.lightDone=true;s.pointSince=0;lightProgress=1}
    }else s.pointSince=0

    const classifiedOtherPose=['Closed_Fist','Victory','Thumb_Up','Pointing_Up'].includes(classification)
    const sorted=distances.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value)
    const nearest=sorted[0],runnerUp=sorted[1]
    const target=nearest.index,uniqueTarget=nearest.value<ENTER[target]&&runnerUp.value-nearest.value>=(target===3?.13:.18)&&runnerUp.value>=(target===3?.34:RELEASE)
    const clearRelease=distances.every(value=>value>=RELEASE)
    const validConfidence=Number.isFinite(confidence)&&confidence>=MIN_CONFIDENCE
    const validPose=(index:number)=>folded[index]&&extended.filter((value,i)=>i!==index&&value).length>=(index===3?1:2)
    let reason='等待明确松开'

    // A fresh track is disarmed. Even if it first appears pinched, it must open before arming.
    if(!validConfidence||isLove||point||classifiedOtherPose){
      if(s.phase==='PINCH_CANDIDATE'||!validConfidence||isLove||classifiedOtherPose){s.phase='WAIT_FOR_RELEASE';s.armed=false;s.pinchCandidate=null;s.pinchSince=0}
    }else if(s.phase==='PINCH_CONFIRMED'){
      s.phase='WAIT_FOR_RELEASE';s.armed=false
    }else if(s.phase==='WAIT_FOR_RELEASE'){
      if(clearRelease){s.phase='RELEASED';s.armed=true}
    }else if(s.phase==='RELEASED'){
      if(!s.armed){if(clearRelease)s.armed=true}
      else if(uniqueTarget&&validPose(nearest.index)){
        s.phase='PINCH_CANDIDATE';s.pinchCandidate=nearest.index;s.pinchSince=now
      }else reason=!uniqueTarget?'指尖距离未达阈值或目标不唯一':'其它手指姿态不明确'
    }else if(s.phase==='PINCH_CANDIDATE'){
      const candidate=s.pinchCandidate
      if(candidate!==null&&uniqueTarget&&nearest.index===candidate&&validPose(candidate)){
        if(now-s.pinchSince>=HOLD_MS[candidate]){s.phase='PINCH_CONFIRMED';pinchIndex=candidate}
      }else{
        // Any ambiguous pose, target switch, or jitter aborts this closure until a clear release.
        s.phase='WAIT_FOR_RELEASE';s.armed=false;s.pinchCandidate=null;s.pinchSince=0
      }
    }
    s.lastSeen=now
    if(s.phase==='PINCH_CANDIDATE')reason='候选稳定计时中'
    if(s.phase==='PINCH_CONFIRMED')reason='已确认并触发'
    if(s.phase==='WAIT_FOR_RELEASE')reason='等待明确松开'
    if(!validConfidence)reason='手部置信度不足'
    if(isLove)reason='检测到 I Love You，单词捏合互斥'
    if(point)reason='检测到指向手势'
    return {name:isLove?'love':point?'point':s.phase==='PINCH_CONFIRMED'?'pinch':'idle',pinchIndex,pinchPhase:s.phase,distances,thresholds:ENTER,lightProgress,light,reason}
  }
}
