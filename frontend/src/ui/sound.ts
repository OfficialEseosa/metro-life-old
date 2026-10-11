let audio:AudioContext|null=null
let muted=localStorage.getItem('metro:sound:v1')==='off'
export function sound(kind:'tap'|'open'|'close'|'coin'|'error'|'low'|'level'){
  if(muted||!audio||audio.state!=='running')return
  const notes=kind==='coin'?[660,990,1320]:kind==='level'?[440,554,660]:[kind==='error'?180:kind==='close'?330:kind==='low'?260:kind==='open'?520:700]
  notes.forEach((frequency,i)=>{const oscillator=audio!.createOscillator(),gain=audio!.createGain(),at=audio!.currentTime+i*.065;oscillator.type='sine';oscillator.frequency.value=frequency*(.96+Math.random()*.08);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.035,at+.009);gain.gain.exponentialRampToValueAtTime(.001,at+.12);oscillator.connect(gain).connect(audio!.destination);oscillator.start(at);oscillator.stop(at+.13)})
}

export const isMuted=()=>muted
export function toggleSound(){muted=!muted;localStorage.setItem('metro:sound:v1',muted?'off':'on');return muted}
export function resumeSound(kind:Parameters<typeof sound>[0]){if(muted)return;audio??=new AudioContext();void audio.resume().then(()=>sound(kind))}
