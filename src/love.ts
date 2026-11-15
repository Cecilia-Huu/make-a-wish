/** Both hands must classify ILoveYou continuously; release rearms the effect. */
export class LoveGate {
  private since=0
  private releasedAt=0
  private armed=true
  private lastTrigger=-Infinity
  reset(){this.since=0;this.releasedAt=0;this.armed=true;this.lastTrigger=-Infinity}
  update(left:boolean,right:boolean,now:number):{progress:number;triggered:boolean}{
    if(left&&right){
      this.releasedAt=0
      if(!this.since)this.since=now
      const progress=Math.min(1,(now-this.since)/800)
      const triggered=this.armed&&progress>=1&&now-this.lastTrigger>1400
      if(triggered){this.armed=false;this.lastTrigger=now}
      return {progress,triggered}
    }
    this.since=0
    if(!this.releasedAt)this.releasedAt=now
    if(now-this.releasedAt>=250)this.armed=true
    return {progress:0,triggered:false}
  }
}
