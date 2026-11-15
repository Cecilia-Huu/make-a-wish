export type AudioSample={rms:number;highRatio:number;flatness:number}
export type BlowResult={strength:number;progress:number;triggered:boolean;threshold:number}

/** Smoothed background floor + short broadband air-noise hold with gap tolerance. */
export class BlowDetector {
  private floor=.004
  private started=0
  private lastMatch=0
  private fired=false
  reset(){this.started=0;this.lastMatch=0;this.fired=false}
  calibrate(rms:number){this.floor=Math.max(.002,Math.min(.035,rms));this.reset()}
  get noiseFloor(){return this.floor}
  update(sample:AudioSample,now:number,active:boolean,sensitivity:number):BlowResult{
    const threshold=Math.max(.008,(.024-(sensitivity-50)*.00022),this.floor*(2.5-(sensitivity-50)*.014))
    const strength=Math.min(1.5,sample.rms/Math.max(threshold,.001))
    if(!active){this.floor=this.floor*.992+Math.min(sample.rms,.04)*.008;this.reset();return {strength,progress:0,triggered:false,threshold}}
    const broadband=sample.highRatio>.24&&sample.flatness>.07
    const match=sample.rms>threshold&&broadband
    if(match){if(!this.started)this.started=now;this.lastMatch=now}
    else if(now-this.lastMatch>110)this.started=0
    const progress=this.started?Math.min(1,(now-this.started)/480):0
    const triggered=progress>=1&&!this.fired
    if(triggered)this.fired=true
    return {strength,progress,triggered,threshold}
  }
}

export function analyzeAudio(time:Float32Array,freq:Uint8Array,sampleRate:number):AudioSample{
  let sum=0;for(const n of time)sum+=n*n
  const rms=Math.sqrt(sum/time.length),hz=sampleRate/(freq.length*2)
  let total=0,high=0,band=0,log=0,count=0
  for(let i=2;i<freq.length;i++){
    const power=freq[i]*freq[i];total+=power
    if(i*hz>=800&&i*hz<=6500)high+=power
    if(i*hz>=200&&i*hz<=6500){band+=power;log+=Math.log(power+1);count++}
  }
  return {rms,highRatio:high/(total+1),flatness:Math.exp(log/Math.max(1,count))/((band/Math.max(1,count))+1)}
}
