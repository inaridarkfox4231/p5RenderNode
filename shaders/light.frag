// 2022/10/14
// 鉄道の日
// Specularとか移したいな～って思って。来ました。
// どうもそれぞれのライトの付属要素になってるっぽいんよ。uniformの数が凄い...
// ディファード前提って感じする。重過ぎて。

precision highp float;
precision highp int;

uniform mat4 uViewMatrix;

uniform bool uUseLighting;

uniform int uAmbientLightCount;
uniform vec3 uAmbientColor[5];

uniform int uDirectionalLightCount;
uniform vec3 uLightingDirection[5];
uniform vec3 uDirectionalDiffuseColors[5];
uniform vec3 uDirectionalSpecularColors[5];

uniform int uPointLightCount;
uniform vec3 uPointLightLocation[5];
uniform vec3 uPointLightDiffuseColors[5];
uniform vec3 uPointLightSpecularColors[5];

uniform int uSpotLightCount;
uniform float uSpotLightAngle[5];
uniform float uSpotLightConc[5];
uniform vec3 uSpotLightDiffuseColors[5];
uniform vec3 uSpotLightSpecularColors[5];
uniform vec3 uSpotLightLocation[5];
uniform vec3 uSpotLightDirection[5];

uniform bool uSpecular;
uniform float uShininess;

uniform float uConstantAttenuation;
uniform float uLinearAttenuation;
uniform float uQuadraticAttenuation;

const float specularFactor = 2.0;
const float diffuseFactor = 0.73;

// specularとdiffuseからなる。
struct LightResult {
  float specular;
  float diffuse;
};

float _phongSpecular(vec3 lightDirection, vec3 viewDirection, vec3 surfaceNormal, float shininess){
  vec3 R = reflect(lightDirection, surfaceNormal);
  return pow(max(0.0, dot(R, viewDirection)), shininess); // shininess
}

float _lambertDiffuse(vec3 lightDirection, vec3 surfaceNormal){
  return max(0.0, dot(-lightDirection, surfaceNormal));
}

LightResult _light(vec3 viewDirection, vec3 normal, vec3 lightVector){
  vec3 lightDir = normalize(lightVector);

  //compute our diffuse & specular terms
  LightResult lr;
  if(uSpecular) lr.specular = _phongSpecular(lightDir, viewDirection, normal, uShininess);
  lr.diffuse = _lambertDiffuse(lightDir, normal);
  return lr;
}

void totalLight(vec3 modelPosition, vec3 normal, out vec3 totalDiffuse, out vec3 totalSpecular){
  totalSpecular = vec3(0.0); // 0.0で初期化

  if (!uUseLighting){
    totalDiffuse = vec3(1.0); // lightingしない場合はvec3(1.0)を返しておしまい
    return;
  }

  totalDiffuse = vec3(0.0); // 0.0で初期化

  vec3 viewDirection = normalize(-modelPosition);

  // DirectionalLight項の計算。
  for (int j = 0; j < 5; j++){
    if (j < uDirectionalLightCount){
      vec3 lightVector = (uViewMatrix * vec4(uLightingDirection[j], 0.0)).xyz;
      vec3 lightColor = uDirectionalDiffuseColors[j];
      vec3 specularColor = uDirectionalSpecularColors[j];
      LightResult result = _light(viewDirection, normal, lightVector);
      totalDiffuse += result.diffuse * lightColor;
      totalSpecular += result.specular * lightColor * specularColor;
    }
    // pointLightの影響を加味する
    if (j < uPointLightCount){
      vec3 lightPosition = (uViewMatrix * vec4(uPointLightLocation[j], 1.0)).xyz;
      vec3 lightVector = modelPosition - lightPosition;

       //calculate attenuation
       float lightDistance = length(lightVector);
       float lightFalloff = 1.0 / (uConstantAttenuation + lightDistance * uLinearAttenuation + (lightDistance * lightDistance) * uQuadraticAttenuation);
       vec3 lightColor = lightFalloff * uPointLightDiffuseColors[j];
       vec3 specularColor = lightFalloff * uPointLightSpecularColors[j];

       LightResult result = _light(viewDirection, normal, lightVector);
       totalDiffuse += result.diffuse * lightColor;
       totalSpecular += result.specular * lightColor * specularColor;
    }
    // spotLightの影響を加味する
    if(j < uSpotLightCount){
      vec3 lightPosition = (uViewMatrix * vec4(uSpotLightLocation[j], 1.0)).xyz;
      vec3 lightVector = modelPosition - lightPosition;

      float lightDistance = length(lightVector);
      float lightFalloff = 1.0 / (uConstantAttenuation + lightDistance * uLinearAttenuation + (lightDistance * lightDistance) * uQuadraticAttenuation);

      vec3 lightDirection = (uViewMatrix * vec4(uSpotLightDirection[j], 0.0)).xyz;
      float spotDot = dot(normalize(lightVector), normalize(lightDirection));
      float spotFalloff;
      if(spotDot < uSpotLightAngle[j]) {
        spotFalloff = 0.0;
      }else{
        spotFalloff = pow(spotDot, uSpotLightConc[j]);
      }
      lightFalloff *= spotFalloff;

      vec3 lightColor = uSpotLightDiffuseColors[j];
      vec3 specularColor = uSpotLightSpecularColors[j];

      LightResult result = _light(viewDirection, normal, lightVector);

      totalDiffuse += result.diffuse * lightColor * lightFalloff;
      totalSpecular += result.specular * lightColor * specularColor * lightFalloff;
    }
  }

  totalDiffuse *= diffuseFactor;
  totalSpecular *= specularFactor;
}
// include lighting.glsl
uniform vec4 uMaterialColor;
uniform vec4 uTint;
uniform sampler2D uSampler;
uniform bool isTexture;
uniform bool uEmissive;
varying vec3 vNormal;
varying vec2 vTexCoord;
varying vec3 vViewPosition;
varying vec3 vAmbientColor;

void main(void){
  vec3 diffuse;
  vec3 specular;
  totalLight(vViewPosition, normalize(vNormal), diffuse, specular);

  if(uEmissive && !isTexture) {
    gl_FragColor = uMaterialColor;
  }else{
    gl_FragColor = isTexture ? texture2D(uSampler, vTexCoord) * (uTint / vec4(255, 255, 255, 255)) : uMaterialColor;
    // diffuseの分にambient成分を足してrgbに掛けて色を出してspecular成分を足して完成みたいな（？？）
    gl_FragColor.rgb = gl_FragColor.rgb * (diffuse + vAmbientColor) + specular;
  }
}
