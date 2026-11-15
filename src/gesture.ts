import type {NormalizedLandmark} from '@mediapipe/tasks-vision'

export type Side='Left'|'Right'
export type GestureName='love'|'point'|'pinch'|'idle'
export type GestureResult={name:GestureName;pinchIndex:number|null;lightProgress:number;light:boolean}
type HandState={activePinch:number|null;pinchCandidate:number|null;pinchSince:number;pointSince:number;lastSeen:number;lightDone:boolean}
const tips=[8,12,16,20],pips=[6,10,14,18],mcps=[5,9,13,17]
const d=(a:NormalizedLandmark,b:NormalizedLandmark)=>Math.hypot(a.x-b.x,a.y-b.y)
const fresh=():HandState=>({activePinch:null,pinchCandidate:null,pinchSince:0,pointSince:0,lastSeen:0,lightDone:false})

/** Raw pose detection and debounced gesture events remain separate from app actions. */
export class GestureEngine {
  private state:Record<Side,HandState>={Left:fresh(),Right:fresh()}
  reset(){this.state={Left:fresh(),Right:fresh()}}
  lost(label:Side,now:number){if(now-this.state[label].lastSeen>280)this.state[label]=fresh()}
  update(label:Side,lm:NormalizedLandmark[],now:number,nearWick:boolean,unlit:boolean,isLove=false):GestureResult {
    const s=this.state[label],palm=Math.max(d(lm[0],lm[9]),.06)
    const ratios=tips.map(t=>d(lm[4],lm[t])/palm)
    const folded=tips.map((t,i)=>d(lm[t],lm[mcps[i]])<d(lm[pips[i]],lm[mcps[i]])*1.28)
    const extended=tips.map((t,i)=>d(lm[t],lm[mcps[i]])>d(lm[pips[i]],lm[mcps[i]])*1.65)
        const point=extended[0]&&folded.slice(1).every(Boolean)&&ratios[0]>.43
    let light=false,lightProgress=0,pinchIndex:number|null=null
    if(!unlit){s.pointSince=0;s.lightDone=false}
    else if(point&&nearWick&&!s.lightDone&&!isLove){
      if(!s.pointSince)s.pointSince=now
      lightProgress=Math.min(1,(now-s.pointSince)/800)
      if(lightProgress>=1){light=true;s.lightDone=true;s.pointSince=0;lightProgress=1}
    }else s.pointSince=0
    // A classified love sign suppresses all pinch and point events.
    if(isLove||point){s.pinchCandidate=null;if(Math.min(...ratios)>.46)s.activePinch=null}
    else{
      if(s.activePinch!==null&&ratios[s.activePinch]>.47){s.activePinch=null;s.pinchCandidate=null}
      if(s.activePinch===null){
        const nearest=ratios.indexOf(Math.min(...ratios)),r=ratios[nearest]
        if(r<.34){
          if(s.pinchCandidate!==nearest){s.pinchCandidate=nearest;s.pinchSince=now}
          if(now-s.pinchSince>=55){s.activePinch=nearest;s.pinchCandidate=null;pinchIndex=nearest}
        }else s.pinchCandidate=null
      }
    }
    s.lastSeen=now
    return {name:isLove?'love':point?'point':s.activePinch!==null?'pinch':'idle',pinchIndex,lightProgress,light}
  }
}
