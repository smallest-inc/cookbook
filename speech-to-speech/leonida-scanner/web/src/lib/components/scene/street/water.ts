/**
 * Water written for this demo: moving normals from a few octaves of value noise, Fresnel mix
 * between a clear teal body and the sky texture, a sun glint, and the scene's distance haze.
 * It works at any height, so the bay, the marina and the river all share it.
 */
import { Color, ShaderMaterial, Vector3, type Texture } from 'three';

export function waterMaterial(sky: Texture, sunDir: Vector3, fogColor: Color, fogNear: number, fogFar: number): ShaderMaterial {
	return new ShaderMaterial({
		uniforms: {
			uTime: { value: 0 },
			uSky: { value: sky },
			uSun: { value: sunDir.clone().normalize() },
			uDeep: { value: new Color('#0b4c63') },
			uShallow: { value: new Color('#1d8f95') },
			uFog: { value: fogColor },
			uFogNear: { value: fogNear },
			uFogFar: { value: fogFar }
		},
		vertexShader: /* glsl */ `
			varying vec3 vWorld;
			void main() {
				vec4 w = modelMatrix * vec4(position, 1.0);
				vWorld = w.xyz;
				gl_Position = projectionMatrix * viewMatrix * w;
			}
		`,
		fragmentShader: /* glsl */ `
			uniform float uTime;
			uniform sampler2D uSky;
			uniform vec3 uSun;
			uniform vec3 uDeep;
			uniform vec3 uShallow;
			uniform vec3 uFog;
			uniform float uFogNear;
			uniform float uFogFar;
			varying vec3 vWorld;

			float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
			float noise(vec2 p) {
				vec2 i = floor(p); vec2 f = fract(p);
				vec2 u = f * f * (3.0 - 2.0 * f);
				return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
			}
			float height(vec2 p) {
				float t = uTime;
				float h = 0.0;
				h += noise(p * 0.18 + vec2(t * 0.12, t * 0.05)) * 1.0;
				h += noise(p * 0.41 - vec2(t * 0.09, -t * 0.16)) * 0.5;
				h += noise(p * 0.93 + vec2(-t * 0.21, t * 0.17)) * 0.25;
				h += noise(p * 2.10 + vec2(t * 0.35, t * 0.28)) * 0.12;
				return h;
			}
			vec2 equirect(vec3 d) {
				return vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415926 + 0.5);
			}
			void main() {
				vec2 p = vWorld.xz;
				float dist = length(cameraPosition - vWorld);
				float e = 0.25;
				float h0 = height(p);
				float hx = height(p + vec2(e, 0.0));
				float hz = height(p + vec2(0.0, e));
				// flatten the ripples with distance so the horizon does not shimmer
				float amp = mix(0.55, 0.06, clamp(dist / 400.0, 0.0, 1.0));
				vec3 n = normalize(vec3(-(hx - h0) / e * amp, 1.0, -(hz - h0) / e * amp));
				vec3 v = normalize(cameraPosition - vWorld);
				vec3 r = reflect(-v, n);
				r.y = abs(r.y);
				vec3 sky = texture2D(uSky, equirect(r)).rgb;
				float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
				vec3 body = mix(uShallow, uDeep, clamp(0.35 + h0 * 0.35, 0.0, 1.0));
				// light scattered up through the clear water
				body += vec3(0.05, 0.12, 0.10) * max(dot(n, uSun), 0.0);
				vec3 col = mix(body, sky * 0.85, clamp(fres * 0.6 + 0.05, 0.0, 1.0));
				float spec = pow(max(dot(r, uSun), 0.0), 260.0) * 3.5 + pow(max(dot(r, uSun), 0.0), 40.0) * 0.25;
				col += vec3(1.0, 0.96, 0.88) * spec;
				float f = smoothstep(uFogNear, uFogFar, dist);
				col = mix(col, uFog, f);
				gl_FragColor = vec4(col, 1.0);
				#include <tonemapping_fragment>
				#include <colorspace_fragment>
			}
		`
	});
}
