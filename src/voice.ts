import type {Side} from './gesture'
export type WordKey=`${Side}-${0|1|2|3}`
/** Optional matched recordings; all eight words use the selected system voice by default. */
export const recordedWords:Partial<Record<WordKey,string>>={}
/** A single capital letter can be spoken as "capital I" by some system voices. */
export function pronunciationForWord(key:WordKey,text:string){return key==='Left-0'?'eye':text}
let playing:HTMLAudioElement|null=null
export function preferredVoice(voices:SpeechSynthesisVoice[]){
  const english=voices.filter(v=>v.lang.toLowerCase().startsWith('en'))
  const rank=(v:SpeechSynthesisVoice)=>{
    const name=v.name.toLowerCase(),lang=v.lang.toLowerCase()
    return (lang.startsWith('en-us')?20:0)+(v.localService?5:0)+(/ava|samantha|allison|zoe|serena|jenny|aria|natural|premium|enhanced/.test(name)?30:0)+(/compact|robot|bad news/.test(name)?-25:0)
  }
  return english.sort((a,b)=>rank(b)-rank(a))[0]
}
export function playWord(key:WordKey,text:string,voice:SpeechSynthesisVoice|undefined,rate:number,pitch:number){
  playing?.pause();playing=null
  if('speechSynthesis' in window)window.speechSynthesis.cancel()
  const url=recordedWords[key]
  const spoken=pronunciationForWord(key,text)
  if(url){playing=new Audio(url);playing.play().catch(()=>{playing=null;say(spoken,voice,rate,pitch)});return}
  say(spoken,voice,rate,pitch)
}
export function say(text:string,voice:SpeechSynthesisVoice|undefined,rate:number,pitch:number){
  if(!('speechSynthesis' in window))return
  window.speechSynthesis.cancel()
  const utterance=new SpeechSynthesisUtterance(text);utterance.lang=voice?.lang||'en-US';if(voice)utterance.voice=voice;utterance.rate=rate;utterance.pitch=pitch
  window.speechSynthesis.speak(utterance)
}
export function stopVoice(){playing?.pause();playing=null;window.speechSynthesis?.cancel()}
