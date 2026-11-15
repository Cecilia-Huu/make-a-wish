import {useCallback,useState} from 'react'
import {ThreeCake} from './ThreeCake'
/** Visual-only cake component: the interaction layer references only `.wick-anchor`. */
export function Cake({lit,wished,blowProgress=0,onCandle}:{lit:boolean;wished:boolean;blowProgress?:number;onCandle:()=>void}){
  const [fallback,setFallback]=useState(false)
  const onFailure=useCallback(()=>setFallback(true),[])
  if(!fallback)return <ThreeCake lit={lit} wished={wished} blowProgress={blowProgress} onCandle={onCandle} onFailure={onFailure}/>
  return <div className={`cake ${lit?'lit':''} ${wished?'wished':''}`} aria-label="奶油白樱桃生日蛋糕">
    <div className="cake-shadow"/>
    <div className="cake-plate"/>
    <div className="cake-body"><div className="cake-pink-band"/><div className="cake-frosting"><i/><i/><i/><i/><i/><i/><i/></div><div className="cake-bow"><span/><b/><em/></div><div className="cake-star star-one">✦</div><div className="cake-star star-two">✦</div></div>
    <div className="cake-top"><div className="cream-ring">{Array.from({length:13},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}</div><div className="cream-swirl"><i/><i/><i/></div><div className="cherry"><div className="cherry-stem"/></div></div>
    <button className="candle" aria-label={lit?'点击熄灭蜡烛':'点击点亮蜡烛'} onClick={onCandle}><span className="candle-stick"/><span className="wick-anchor"/><span className="flame-glow"/><span className="flame"><i/></span><span className="smoke">〰</span></button>
  </div>
}
