"use client";
import { useEffect, useRef } from "react";

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
// Domain-warped fbm aurora in Brightloop blues, with a pointer-following light and film grain.
const FRAG = `precision highp float;
uniform vec2 r;uniform float t;uniform vec2 m;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 R=mat2(.8,.6,-.6,.8);for(int i=0;i<5;i++){v+=a*n(p);p=R*p*2.02+.13;a*=.5;}return v;}
void main(){
 vec2 uv=gl_FragCoord.xy/r;vec2 p=(gl_FragCoord.xy-.5*r)/r.y;
 float T=t*.06;
 vec2 q=vec2(fbm(p*1.4+vec2(0.,T)),fbm(p*1.4+vec2(5.2,-T)));
 vec2 w=vec2(fbm(p*1.8+2.*q+vec2(1.7,9.2)+T*1.3),fbm(p*1.8+2.*q+vec2(8.3,2.8)-T));
 float f=fbm(p*1.6+2.4*w);
 vec3 navy=vec3(.027,.047,.102),deep=vec3(.043,.071,.149),blue=vec3(.122,.29,.91),indigo=vec3(.227,.4,.96),cyan=vec3(.133,.827,.933);
 vec3 c=mix(navy,deep,uv.y);
 float band=smoothstep(.25,.95,f)*smoothstep(-.1,.75,uv.y);
 c=mix(c,blue,band*.85);
 // aurora curtains: vertical ribbons that sway, strongest in the upper half
 float rib=sin(p.x*3.2+w.y*4.+T*6.)*.5+.5;
 float curtain=pow(rib,3.)*smoothstep(.2,.85,uv.y)*(1.-smoothstep(.6,1.05,uv.y))*smoothstep(.35,.8,f+.15);
 c+=mix(indigo,cyan,rib*q.x)*curtain*.75;
 c=mix(c,indigo,smoothstep(.55,1.,f*w.x)*.6*uv.y);
 c+=cyan*pow(smoothstep(.6,1.,f*q.y*1.6),2.)*.55;
 // top beam
 c+=vec3(.35,.5,1.)*exp(-pow((uv.x-.5)*3.2,2.))*smoothstep(.35,1.,uv.y)*.35;
 // pointer light
 vec2 mm=(m-.5*r)/r.y;c+=vec3(.25,.45,1.)*.22*exp(-length(p-mm)*3.);
 // horizon glow behind the product
 c+=vec3(.15,.3,.95)*exp(-pow((uv.y-.08)*6.,2.))*exp(-pow((uv.x-.5)*2.2,2.))*.6;
 c*=1.-.55*length(uv-vec2(.5,.55));
 c+=(h(gl_FragCoord.xy+t)-.5)*.035;
 gl_FragColor=vec4(c,1.);
}`;

export function AuroraCanvas({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const gl = c.getContext("webgl", { antialias: false, premultipliedAlpha: false, powerPreference: "low-power" });
    if (!gl) { c.dataset.fallback = "1"; return; }
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { c.dataset.fallback = "1"; return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, "r"), uT = gl.getUniformLocation(prog, "t"), uM = gl.getUniformLocation(prog, "m");
    const scale = 0.6; // render below native res – it's soft anyway, and cheap
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const resize = () => {
      const w = Math.max(1, Math.round(c.clientWidth * scale)), h = Math.max(1, Math.round(c.clientHeight * scale));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; gl.viewport(0, 0, w, h); }
      if (!mouse.x) { mouse.x = mouse.tx = w / 2; mouse.y = mouse.ty = h * 0.7; }
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(c);
    const onMove = (e: PointerEvent) => { const b = c.getBoundingClientRect(); mouse.tx = (e.clientX - b.left) * scale; mouse.ty = (b.height - (e.clientY - b.top)) * scale; };
    window.addEventListener("pointermove", onMove, { passive: true });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true, raf = 0; const t0 = performance.now();
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !reduce) loop(); }); io.observe(c);
    function frame() {
      mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
      gl!.uniform2f(uR, c!.width, c!.height); gl!.uniform1f(uT, (performance.now() - t0) / 1000 + 20); gl!.uniform2f(uM, mouse.x, mouse.y);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }
    function loop() { cancelAnimationFrame(raf); const tick = () => { if (!visible) return; frame(); raf = requestAnimationFrame(tick); }; tick(); }
    frame(); c.dataset.ready = "1";
    if (!reduce) loop();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); window.removeEventListener("pointermove", onMove); };
  }, []);
  return <canvas ref={ref} className={`opacity-0 transition-opacity duration-1000 data-[ready='1']:opacity-100 ${className}`} aria-hidden />;
}
