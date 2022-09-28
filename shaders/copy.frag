#version 300 es
precision mediump float;

in vec2 vUv;
uniform sampler2D uTex;
out vec4 fragColor;

void main(void){
  fragColor = texture(uTex, vUv); // 何とtextureでいいらしい...！
}
