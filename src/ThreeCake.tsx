import {useEffect,useRef,useState} from 'react'
import * as THREE from 'three'

/** Procedural 3D cake. Replace the scene construction with GLTFLoader when final GLB arrives. */
export function ThreeCake({lit,wished,blowProgress,onCandle,onFailure}:{lit:boolean;wished:boolean;blowProgress:number;onCandle:()=>void;onFailure:()=>void}){
  const host=useRef<HTMLDivElement>(null),flame=useRef<THREE.Group|null>(null),rendererRef=useRef<THREE.WebGLRenderer|null>(null),cameraRef=useRef<THREE.OrthographicCamera|null>(null)
  const litRef=useRef(lit),blowRef=useRef(blowProgress),[anchor,setAnchor]=useState({x:145,y:34})
  useEffect(()=>{litRef.current=lit;blowRef.current=blowProgress},[lit,blowProgress])
  useEffect(()=>{
    const el=host.current;if(!el)return
    let renderer:THREE.WebGLRenderer
    try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'})}catch{onFailure();return}
    rendererRef.current=renderer;renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;renderer.setClearColor(0x000000,0);el.prepend(renderer.domElement)
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1.85,1.85,1.5,-1.5,.1,100);cameraRef.current=camera;camera.position.set(0,2.35,6);camera.lookAt(0,.91,0)
    scene.add(new THREE.AmbientLight(0xffffff,1.7));const key=new THREE.DirectionalLight(0xfff4e4,2.5);key.position.set(-2,5,5);scene.add(key);const rim=new THREE.DirectionalLight(0xffd3d5,1.45);rim.position.set(3,3,-4);scene.add(rim)
    const group=new THREE.Group();scene.add(group)
    const cream=new THREE.MeshPhysicalMaterial({color:'#fff5e9',roughness:.83,metalness:0,clearcoat:.08}),pink=new THREE.MeshPhysicalMaterial({color:'#eec3c9',roughness:.76,clearcoat:.06}),band=new THREE.MeshPhysicalMaterial({color:'#f5d8d7',roughness:.88}),plate=new THREE.MeshStandardMaterial({color:'#f1dfd6',metalness:.16,roughness:.4}),cherryMat=new THREE.MeshPhysicalMaterial({color:'#cc2145',roughness:.2,clearcoat:.95,clearcoatRoughness:.12}),bowMat=new THREE.MeshPhysicalMaterial({color:'#f6c2d0',roughness:.55,clearcoat:.22,side:THREE.DoubleSide}),gold=new THREE.MeshStandardMaterial({color:'#ffe27c',metalness:.12,roughness:.42})
    const mesh=(geometry:THREE.BufferGeometry,material:THREE.Material|THREE.Material[],x:number,y:number,z:number,scale?:[number,number,number])=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);if(scale)m.scale.set(...scale);group.add(m);return m}
    mesh(new THREE.CylinderGeometry(1.42,1.4,.075,64),plate,0,.05,0)
    mesh(new THREE.CylinderGeometry(1.2,1.17,.85,64,1),[pink,cream,cream],0,.56,0)
    mesh(new THREE.CylinderGeometry(1.207,1.18,.17,64),band,0,.45,0)
    mesh(new THREE.CylinderGeometry(1.225,1.225,.16,64),[cream,cream,cream],0,1.02,0)
    mesh(new THREE.TorusGeometry(1.17,.055,10,64),cream,0,1.08,0).rotation.x=Math.PI/2
    const puffGeo=new THREE.SphereGeometry(1,16,12)
    for(let i=0;i<16;i++){const a=i/16*Math.PI*2,x=Math.cos(a)*1.06,z=Math.sin(a)*1.06;mesh(puffGeo,cream,x,1.15,z,[.14,.11,.19]).rotation.y=a}
    // Fine cream ridges on the top and bottom piping.
    for(let i=0;i<17;i++){const a=i/17*Math.PI*2;mesh(puffGeo,cream,Math.cos(a)*1.12,.18,Math.sin(a)*1.12,[.13,.08,.1])}
    mesh(puffGeo,cream,0,1.28,0,[.27,.18,.27]);for(let i=0;i<5;i++){const a=i/5*Math.PI*2;mesh(puffGeo,cream,Math.cos(a)*.14,1.34,Math.sin(a)*.14,[.16,.11,.13])}
    mesh(new THREE.SphereGeometry(.165,24,18),cherryMat,0,1.52,.02,[1,.93,1]);const stemCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,1.64,.02),new THREE.Vector3(.02,1.76,.01),new THREE.Vector3(.055,1.81,-.03)]);mesh(new THREE.TubeGeometry(stemCurve,12,.012,6),new THREE.MeshStandardMaterial({color:'#6e6550',roughness:.8}),0,0,0)
    // Ribbon loops sit on the visible side of the cake.
    const loopGeo=new THREE.TorusGeometry(.18,.055,9,32)
    const left=mesh(loopGeo,bowMat,-.16,.63,1.16,[1.25,.72,1]);left.rotation.z=.25
    const right=mesh(loopGeo,bowMat,.16,.63,1.16,[1.25,.72,1]);right.rotation.z=-.25
    mesh(new THREE.SphereGeometry(.075,14,10),bowMat,0,.63,1.21)
    const tailGeo=new THREE.ConeGeometry(.085,.34,3)
    mesh(tailGeo,bowMat,-.1,.42,1.18).rotation.z=-.27;mesh(tailGeo,bowMat,.1,.42,1.18).rotation.z=.27
    const starShape=new THREE.Shape();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?.055:.12,x=Math.cos(a)*r,y=Math.sin(a)*r;i?starShape.lineTo(x,y):starShape.moveTo(x,y)}starShape.closePath()
    const starGeo=new THREE.ExtrudeGeometry(starShape,{depth:.025,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.012,bevelThickness:.012})
    mesh(starGeo,gold,-.83,.74,.88).rotation.y=-.4;mesh(starGeo,gold,.85,.74,.86).rotation.y=.4
    // Candle is a real cylinder; the screen target follows its projected wick.
    const candleMat=new THREE.MeshStandardMaterial({color:'#e999ac',roughness:.55})
    mesh(new THREE.CylinderGeometry(.072,.077,.47,16),candleMat,0,1.51,-.38)
    for(let i=0;i<3;i++){mesh(new THREE.TorusGeometry(.073,.012,6,24),cream,0,1.34+i*.14,-.38).rotation.x=Math.PI/2+.3}
    mesh(new THREE.CylinderGeometry(.009,.009,.1,6),new THREE.MeshStandardMaterial({color:'#574543'}),0,1.795,-.38)
    const flameGroup=new THREE.Group();group.add(flameGroup);flameGroup.position.set(0,1.91,-.38);flame.current=flameGroup
    const flameMesh=new THREE.Mesh(new THREE.SphereGeometry(.095,16,12),new THREE.MeshBasicMaterial({color:'#ffb547'}));flameMesh.scale.set(.8,1.55,.75);flameGroup.add(flameMesh)
    const core=new THREE.Mesh(new THREE.SphereGeometry(.05,12,8),new THREE.MeshBasicMaterial({color:'#fff8c6'}));core.position.y=-.035;core.scale.y=1.5;flameGroup.add(core)
    const glow=new THREE.PointLight(0xffbf73,.8,1.3);flameGroup.add(glow)
    const project=()=>{const rect=el.getBoundingClientRect();const p=new THREE.Vector3(0,1.85,-.38).project(camera);setAnchor({x:(p.x+1)*rect.width/2,y:(1-p.y)*rect.height/2})}
    let rendered=false,wasLit=false
    const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);const ratio=w/h;camera.left=-1.5*ratio;camera.right=1.5*ratio;camera.top=1.5;camera.bottom=-1.5;camera.updateProjectionMatrix();rendered=false;project()}
    const observer=new ResizeObserver(resize);observer.observe(el);resize()
    let frame=0,last=0;const draw=(t:number)=>{frame=requestAnimationFrame(draw);if(document.hidden||t-last<32)return;last=t;flameGroup.visible=litRef.current;const p=blowRef.current;flameGroup.rotation.z=Math.sin(t*.018)*(.08+p*.35)+p*.5;flameGroup.scale.setScalar(1-p*.75);if(litRef.current||!rendered||wasLit!==litRef.current){renderer.render(scene,camera);rendered=true;wasLit=litRef.current}};frame=requestAnimationFrame(draw)
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose())}});renderer.dispose();renderer.domElement.remove();flame.current=null;rendererRef.current=null;cameraRef.current=null}
  },[onFailure])
  return <div className="three-cake" ref={host}><button className="three-candle-target" style={{left:anchor.x,top:anchor.y}} onClick={onCandle} aria-label={lit?'点击熄灭蜡烛':'点击点亮蜡烛'}><span className="wick-anchor"/>{wished&&<span className="three-smoke">〰</span>}</button></div>
}
