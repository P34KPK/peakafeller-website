
/* --- Global State --- */
// Dual Oscillator State
const state = {
    osc1: {
        wave: 'sawtooth', // sawtooth, square, triangle, sine
        octave: 1, // -2 to +2
        shape: 0.5, // Pulse width or wave morph (simulated)
    },
    osc2: {
        wave: 'sine',
        octave: 0,
        detune: 0, // In cents or Hz
    },
    // Shared Filter/Env (simplified for this view)
    filter: { cutoff: 2000, res: 1 },
    env: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.5 },

    // AI Sample Buffer (if used)
    sampleBuffer: null
};

/* --- Audio Context --- */
const AudioContext = window.AudioContext || window.webkitAudioContext;
const ctx = new AudioContext();
const masterGain = ctx.createGain();
masterGain.gain.value = 0.3;
masterGain.connect(ctx.destination);

// Analyzer for Mini Viz
const analyser = ctx.createAnalyser();
analyser.fftSize = 512;
masterGain.connect(analyser);

// Resume Context
document.addEventListener('click', () => {
    if (ctx.state === 'suspended') ctx.resume();
}, { once: true });


/* --- Voice Engine (Dual Osc) --- */
class Voice {
    constructor(noteFreq) {
        this.now = ctx.currentTime;

        // --- OSC 1 ---
        this.osc1 = ctx.createOscillator();
        this.osc1.type = state.osc1.wave;
        // Calc frequency based on octave shift
        // Octave 1 = x2, 0 = x1, -1 = /2
        const f1 = noteFreq * Math.pow(2, state.osc1.octave);
        this.osc1.frequency.value = f1;

        // --- OSC 2 ---
        this.osc2 = ctx.createOscillator();
        this.osc2.type = state.osc2.wave;
        const f2 = noteFreq * Math.pow(2, state.osc2.octave);
        // Apply Detune
        // Detune in cents? knob is 0-1. Let's say range is -50 to +50 cents
        const detuneCents = (state.osc2.detune - 0.5) * 100;
        this.osc2.detune.value = detuneCents;
        this.osc2.frequency.value = f2;

        // --- Mixer / VCA ---
        this.vca = ctx.createGain();
        this.vca.gain.value = 0;

        // Connect
        this.osc1.connect(this.vca);
        this.osc2.connect(this.vca);
        this.vca.connect(masterGain);

        // --- Envelope ---
        const { attack, decay, sustain } = state.env;
        this.vca.gain.cancelScheduledValues(this.now);
        this.vca.gain.setValueAtTime(0, this.now);
        this.vca.gain.linearRampToValueAtTime(0.5, this.now + attack); // Max gain 0.5
        this.vca.gain.exponentialRampToValueAtTime(sustain * 0.5, this.now + attack + decay);

        this.osc1.start(this.now);
        this.osc2.start(this.now);
    }

    stop() {
        const now = ctx.currentTime;
        const release = state.env.release;
        this.vca.gain.cancelScheduledValues(now);
        this.vca.gain.setValueAtTime(this.vca.gain.value, now);
        this.vca.gain.exponentialRampToValueAtTime(0.001, now + release);

        this.osc1.stop(now + release + 0.1);
        this.osc2.stop(now + release + 0.1);

        setTimeout(() => {
            this.osc1.disconnect();
            this.osc2.disconnect();
            this.vca.disconnect();
        }, (release + 0.2) * 1000);
    }
}

// Voice Manager
const activeVoices = {};
const freqs = {
    // Octave 2
    'B2': 123.47,
    // Octave 3
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    // Octave 4
    'C4': 261.63, 'D4': 293.66, 'E4': 293.66, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    // Octave 5
    'C5': 523.25, 'D5': 587.33
};

function playNote(noteName) {
    if (activeVoices[noteName]) activeVoices[noteName].stop();
    const f = freqs[noteName] || 440;
    activeVoices[noteName] = new Voice(f);
}

function stopNote(noteName) {
    if (activeVoices[noteName]) {
        activeVoices[noteName].stop();
        delete activeVoices[noteName];
    }
}


/* --- GUI Interactions --- */

// Helper: SVG Arc Path
function describeArc(x, y, radius, startAngle, endAngle) {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
        "M", start.x, start.y,
        "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
        x: centerX + (radius * Math.cos(angleInRadians)),
        y: centerY + (radius * Math.sin(angleInRadians))
    };
}

// Knob Logic
document.querySelectorAll('.arc-knob').forEach(knob => {
    let isDragging = false;
    let startY = 0;
    let value = 0.5; // Normalized 0-1

    // Init state visual
    updateKnobVisual(knob, value);

    knob.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        document.body.style.cursor = 'ns-resize';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const delta = startY - e.clientY;
        value += delta * 0.01;
        value = Math.max(0, Math.min(1, value));

        // Update State
        const param = knob.dataset.param;
        const type = knob.dataset.type;
        updateSystemParam(param, value, type);

        // Update UI
        updateKnobVisual(knob, value);

        // Update Label if needed (for Octave/Wave selectors)
        updateKnobLabel(knob, param, value);

        startY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.cursor = 'default';
    });
});

function updateKnobVisual(knob, val) {
    // Map 0-1 to Angle -135 to +135
    // Total range 270 deg.
    // Start angle: -135
    // End angle: -135 + (val * 270)
    const startAngle = -135;
    const endAngle = -135 + (val * 270);

    const path = knob.querySelector('.val-arc');
    if (path) {
        // Center 50,50, Radius 40 (matches CSS SVG viewBox 0 0 100 100)
        // Note: My describeArc function needs angles where 0 is up (12 oclock)?
        // SVG coords: 0 deg is usually 3 o'clock. 
        // Let's rely on my helper: (angle-90) puts 0 at 12 o'clock.
        // Angles: -135 (bottom left) to 135 (bottom right)
        path.setAttribute('d', describeArc(50, 50, 30, startAngle, endAngle)); // Radius 30 fits inside 40 bg
    }
}

function updateSystemParam(param, val, type) {
    if (param === 'osc1wave') {
        const waves = ['sine', 'triangle', 'sawtooth', 'square'];
        const idx = Math.floor(val * 4) % 4;
        state.osc1.wave = waves[idx];
    }
    if (param === 'osc1oct') {
        // Map 0-1 to -2 to +2
        // 0.0-0.2: -2, 0.2-0.4: -1, 0.4-0.6: 0, 0.6-0.8: 1, 0.8-1.0: 2
        const oct = Math.floor(val * 5) - 2;
        state.osc1.octave = oct;
    }
    if (param === 'osc2wave') {
        const waves = ['sine', 'triangle', 'sawtooth', 'square'];
        const idx = Math.floor(val * 4) % 4;
        state.osc2.wave = waves[idx];
    }
    if (param === 'osc2oct') {
        const oct = Math.floor(val * 5) - 2;
        state.osc2.octave = oct;
    }
    if (param === 'detune') {
        state.osc2.detune = val;
    }
}

function updateKnobLabel(knob, param, val) {
    const valDisplay = knob.querySelector('.knob-value');
    if (valDisplay) {
        if (param.includes('oct')) {
            const oct = Math.floor(val * 5) - 2;
            valDisplay.textContent = oct;
        }
    }
    // Icons need swapping? (Too complex for this step, keeping static icons or swapping SVGs)
}


/* --- Grid Interactions --- */
document.querySelectorAll('.grid-pad').forEach(pad => {
    const note = pad.dataset.note;

    pad.addEventListener('mousedown', () => {
        pad.classList.add('active');
        playNote(note);
    });
    pad.addEventListener('mouseup', () => {
        pad.classList.remove('active');
        stopNote(note);
    });
    pad.addEventListener('mouseleave', () => {
        if (pad.classList.contains('active')) {
            pad.classList.remove('active');
            stopNote(note);
        }
    });
});


/* --- Visualizer --- */
const cvs = document.getElementById('scopeCanvas');
const cCtx = cvs.getContext('2d');
function drawViz() {
    requestAnimationFrame(drawViz);
    const w = cvs.width;
    const h = cvs.height;
    cCtx.fillStyle = '#000';
    cCtx.fillRect(0, 0, w, h);

    const buffer = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buffer);

    cCtx.lineWidth = 2;
    cCtx.strokeStyle = '#ff8800';
    cCtx.beginPath();

    const slice = w * 1.0 / buffer.length;
    let x = 0;
    for (let i = 0; i < buffer.length; i++) {
        const v = buffer[i] / 128.0;
        const y = v * h / 2;
        if (i === 0) cCtx.moveTo(x, y);
        else cCtx.lineTo(x, y);
        x += slice;
    }
    cCtx.stroke();
}
// Fix canvas size
cvs.width = cvs.offsetWidth;
cvs.height = cvs.offsetHeight;
drawViz();

/* --- Edit Button (Triggers Old AI Logic) --- */
document.querySelector('.edit-btn').addEventListener('click', () => {
    document.getElementById('ai-overlay').style.display = 'flex';
    // Import HF logic dynamically if needed or keep simpler
});
/* Copied AI Logic (Simplified) */
import { HfInference } from "@huggingface/inference";
const hf = new HfInference();
const genBtn = document.getElementById('generate-btn');
const promptIn = document.getElementById('ai-prompt');
const status = document.getElementById('gen-status');

genBtn.addEventListener('click', async () => {
    const text = promptIn.value;
    if (!text) return;
    status.textContent = "GENERATING...";
    try {
        const blob = await hf.textToAudio({
            model: 'facebook/musicgen-small',
            inputs: text,
            parameters: { duration: 2.0 }
        });
        const ab = await blob.arrayBuffer();
        const buf = await ctx.decodeAudioData(ab);

        // This effectively replaces Osc1 with a sample player if we had logic for it
        // For now, let's just Log and Play it once
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(masterGain);
        src.start();

        status.textContent = "PLAYING SAMPLE";
    } catch (e) {
        status.textContent = "ERROR";
    }
});

/* --- Cursor --- */
const cursor = document.getElementById('cursor');
const cursorBorder = document.getElementById('cursor-border');
document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
    setTimeout(() => {
        cursorBorder.style.left = e.clientX + 'px';
        cursorBorder.style.top = e.clientY + 'px';
    }, 50);
});
