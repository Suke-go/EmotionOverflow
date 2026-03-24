import Common from "./Common";
import * as THREE from "three";

import Simulation from "./Simulation";
import face_vert from "./glsl/sim/face.vert";
import color_frag from "./glsl/sim/color.frag";


export default class Output{
    constructor(){
        this.init();
    }

    init(){
        this.simulation = new Simulation();

        this.scene = new THREE.Scene();
        this.camera = new THREE.Camera();

        this.output = new THREE.Mesh(
            new THREE.PlaneBufferGeometry(2, 2),
            new THREE.RawShaderMaterial({
                vertexShader: face_vert,
                fragmentShader: color_frag,
                uniforms: {
                    velocity: {
                        value: this.simulation.fbos.vel_0.texture
                    },
                    boundarySpace: {
                        value: new THREE.Vector2()
                    },
                    bgColor: {
                        value: new THREE.Vector3(1.0, 1.0, 1.0)
                    },
                    emotionColor: {
                        value: new THREE.Vector3(1.0, 1.0, 1.0)
                    },
                    emotionIntensity: {
                        value: 0.0
                    }
                },
            })
        );

        this.scene.add(this.output);
    }
    addScene(mesh){
        this.scene.add(mesh);
    }

    resize(){
        this.simulation.resize();
    }

    render(){
        Common.renderer.setRenderTarget(null);
        Common.renderer.render(this.scene, this.camera);
    }

    update(){
        const opts = this.simulation.options;
        const uniforms = this.output.material.uniforms;

        // Day/Night background
        const isDark = opts.isDarkMode;
        uniforms.bgColor.value.set(
            isDark ? 0.0 : 1.0,
            isDark ? 0.0 : 1.0,
            isDark ? 0.0 : 1.0
        );

        // Emotion color from engine
        if (this.simulation.emotionEngine) {
            const ec = this.simulation.emotionEngine.emotionColor;
            uniforms.emotionColor.value.set(ec.r, ec.g, ec.b);
            // Intensity based on whether emotion has been classified
            const emotions = this.simulation.emotionEngine.emotions;
            const maxConf = Math.max(...Object.values(emotions));
            uniforms.emotionIntensity.value += (
                (maxConf > 0.05 ? 0.85 : 0.0) - uniforms.emotionIntensity.value
            ) * 0.05;
        }

        this.simulation.update();
        this.render();
    }
}