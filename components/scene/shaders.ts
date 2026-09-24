// GLSL for the morphing particle field and the synapse lines.

// Ashima Arts 3D simplex noise (MIT).
export const noiseGLSL = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
vec3 drift(vec3 p, float t){
  return vec3(
    snoise(p*0.7+vec3(0.0,0.0,t)),
    snoise(p*0.7+vec3(5.2,1.3,t)),
    snoise(p*0.7+vec3(9.1,4.7,t))
  );
}
`;

export const particleVertex = /* glsl */ `
uniform float uTime;
uniform float uA;
uniform float uB;
uniform float uMix;
uniform float uSize;
uniform float uPixelRatio;
uniform float uNoiseAmp;
uniform vec3  uMouse;
uniform float uMouseStrength;
uniform float uHoverCluster;
uniform float uIntro;
uniform float uSpin;

attribute vec3 aP1;
attribute vec3 aP2;
attribute vec3 aP3;
attribute vec3 aP4;
attribute float aRand;
attribute float aScale;
attribute float aCluster;

varying vec3 vColor;
varying float vAlpha;

${noiseGLSL}

vec3 shapeAt(float i){
  if(i < 0.5){
    float c = cos(uSpin), sn = sin(uSpin);
    return vec3(c*position.x + sn*position.z, position.y, -sn*position.x + c*position.z);
  }
  if(i < 1.5) return aP1;
  if(i < 2.5) return aP2;
  if(i < 3.5) return aP3;
  return aP4;
}

void main(){
  // Staggered per-particle morph so formations dissolve organically.
  float t = clamp((uMix - aRand * 0.35) / 0.65, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  vec3 p = mix(shapeAt(uA), shapeAt(uB), t);

  // Swirl while in transit.
  float transit = sin(t * 3.14159);
  p += drift(p * 0.6, uTime * 0.25) * transit * 0.9;

  // Idle breathing.
  p += drift(p, uTime * 0.12) * uNoiseAmp;

  // Intro: particles gather in from a wide cloud.
  p = mix(p * (3.5 + aRand * 4.0), p, uIntro);

  // Pointer repulsion.
  vec3 d = p - uMouse;
  float dist = length(d);
  float push = smoothstep(1.5, 0.0, dist) * uMouseStrength;
  p += normalize(d + 0.0001) * push * 0.55;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  // Skill-cluster highlight (only while the cluster formation is showing).
  float w4 = (abs(uA - 4.0) < 0.5 ? 1.0 - t : 0.0) + (abs(uB - 4.0) < 0.5 ? t : 0.0);
  float hover = step(abs(aCluster - uHoverCluster), 0.1) * w4;

  gl_PointSize = min(uSize * aScale * uPixelRatio * (1.0 + hover * 0.9 + push * 1.2) / -mv.z, 40.0 * uPixelRatio);

  vec3 teal  = vec3(0.078, 0.722, 0.651);
  vec3 cyan  = vec3(0.133, 0.827, 0.933);
  vec3 blue  = vec3(0.231, 0.510, 0.965);
  vec3 white = vec3(0.86, 1.0, 0.97);
  vec3 c = mix(teal, cyan, smoothstep(0.2, 0.8, aRand));
  if (aRand > 0.88) c = blue;
  if (aRand < 0.06) c = white;
  vColor = c + hover * 0.45 + push * 0.4;

  float depthFade = smoothstep(20.0, 2.5, -mv.z);
  float dim = (uHoverCluster > -0.5 && w4 > 0.5) ? mix(0.35, 1.0, hover) : 1.0;
  vAlpha = (0.35 + 0.65 * aScale / 2.0) * depthFade * dim * uIntro;
}
`;

export const particleFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a = pow(a, 1.8);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a * vAlpha);
}
`;

export const lineVertex = /* glsl */ `
uniform float uTime;
uniform float uNoiseAmp;
uniform float uSpin;
attribute float aT;
attribute float aSeed;
varying float vT;
varying float vSeed;
varying float vFade;
${noiseGLSL}
void main(){
  float c = cos(uSpin), sn = sin(uSpin);
  vec3 rp = vec3(c*position.x + sn*position.z, position.y, -sn*position.x + c*position.z);
  vec3 p = rp + drift(rp, uTime * 0.12) * uNoiseAmp;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vT = aT;
  vSeed = aSeed;
  vFade = smoothstep(16.0, 3.0, -mv.z);
}
`;

export const lineFragment = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
varying float vT;
varying float vSeed;
varying float vFade;
void main(){
  // A pulse travels along each segment: signals firing through the network.
  float head = fract(uTime * (0.18 + vSeed * 0.25) + vSeed);
  float pulse = smoothstep(0.09, 0.0, abs(head - vT));
  float a = (0.07 + pulse * 0.85) * uOpacity * vFade;
  gl_FragColor = vec4(uColor + pulse * 0.4, a);
}
`;
