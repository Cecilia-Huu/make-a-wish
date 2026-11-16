/** Bilateral I Love You gate with brief classifier-jitter tolerance and release rearming. */
export class LoveGate {
  private since:number|null=null
  private absentSince:number|null=null
  private armed=true
  private lastTrigger=-Infinity
  private readonly holdMs=700
  private readonly gapMs=280
  private readonly releaseMs=250
  private readonly cooldownMs=1400
  reset(){this.since=null;this.absentSince=null;this.armed=true;this.lastTrigger=-Infinity}
  update(left:boolean,right:boolean,now:number):{progress:number;triggered:boolean;active:boolean;reason:string}{
    const both=left&&right
    if(both){
      this.absentSince=null
      if(this.since===null)this.since=now
      const progress=Math.min(1,(now-this.since)/this.holdMs)
      const triggered=this.armed&&progress>=1&&now-this.lastTrigger>=this.cooldownMs
      if(triggered){this.armed=false;this.lastTrigger=now}
      return {progress,triggered,active:progress>=1,reason:progress>=1?'双手爱心已确认':`双手保持中 ${Math.round(progress*100)}%`}
    }
    if(this.absentSince===null)this.absentSince=now
    const gap=now-this.absentSince
    if(gap>=this.gapMs){this.since=null}
    if(gap>=this.releaseMs&&this.lastTrigger>-Infinity&&now-this.lastTrigger>=this.cooldownMs)this.armed=true
    const reason=left||right?'只识别到一只手，双手爱心尚未成立':gap<this.gapMs?'短暂识别波动，保留候选':'等待双手同时做出 🤟'
    return {progress:this.since===null?0:Math.min(1,(now-this.since)/this.holdMs),triggered:false,active:false,reason}
  }
}
