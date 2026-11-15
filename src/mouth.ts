export type MouthSample={funnel:number;pucker:number;jawOpen:number;lipRatio:number;face:boolean}
export type MouthResult={stage:'no-face'|'neutral'|'ready'|'holding'|'cooldown';score:number;progress:number;triggered:boolean}
/** Neutral-to-O transition and sustained hold. It simulates blowing, not airflow. */
export class MouthGate {
  private neutralSince=0
  private armed=false
  private oSince=0
  private lastSeen=0
  private cooldownUntil=0
  reset(){this.neutralSince=0;this.armed=false;this.oSince=0;this.lastSeen=0;this.cooldownUntil=0}
  update(s:MouthSample,now:number,threshold:number,holdMs:number):MouthResult{
    if(!s.face){if(now-this.lastSeen>300){this.neutralSince=0;this.armed=false;this.oSince=0}return {stage:'no-face',score:0,progress:0,triggered:false}}
    this.lastSeen=now
    const score=Math.max(s.funnel,s.pucker*.88)
    const neutral=score<threshold*.55&&s.jawOpen<.25
    const oShape=score>=threshold&&s.lipRatio>.16&&s.jawOpen<.72
    if(now<this.cooldownUntil)return {stage:'cooldown',score,progress:0,triggered:false}
    if(neutral){if(!this.neutralSince)this.neutralSince=now;if(now-this.neutralSince>=260)this.armed=true;this.oSince=0;return {stage:this.armed?'ready':'neutral',score,progress:0,triggered:false}}
    this.neutralSince=0
    if(!this.armed||!oShape){this.oSince=0;return {stage:this.armed?'ready':'neutral',score,progress:0,triggered:false}}
    if(!this.oSince)this.oSince=now
    const progress=Math.min(1,(now-this.oSince)/holdMs),triggered=progress>=1
    if(triggered){this.armed=false;this.oSince=0;this.cooldownUntil=now+1800}
    return {stage:triggered?'cooldown':'holding',score,progress,triggered}
  }
}
