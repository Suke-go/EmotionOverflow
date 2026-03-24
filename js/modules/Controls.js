import * as dat from "dat.gui";

export default class Controls{
    constructor(params, emotionEngine){
        this.params = params;
        this.emotionEngine = emotionEngine;
        this.init();
    }

    init(){
        this.gui = new dat.GUI({width: 300});

        // Fluid parameters
        const fluidFolder = this.gui.addFolder("Fluid");
        fluidFolder.add(this.params, "mouse_force", 20, 200);
        fluidFolder.add(this.params, "cursor_size", 10, 200);
        fluidFolder.add(this.params, "isViscous");
        fluidFolder.add(this.params, "viscous", 0, 500);
        fluidFolder.add(this.params, "iterations_viscous", 1, 32);
        fluidFolder.add(this.params, "iterations_poisson", 1, 32);
        fluidFolder.add(this.params, "dt", 1/200, 1/30);
        fluidFolder.add(this.params, 'BFECC');

        // Emotion / display settings
        const emotionFolder = this.gui.addFolder("Emotion");
        emotionFolder.add(this.params, "preset", ["universal", "eastAsian", "warm"]).name("Color Preset");
        emotionFolder.add(this.params, 'isDarkMode').name('Day / Night');
        emotionFolder.open();

        this.gui.close();
    }
}