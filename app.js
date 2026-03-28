const URL = "https://teachablemachine.withgoogle.com/models/1vv7Cwhsa/";

let model, webcam, maxPredictions;

let isRunning = false;
let closedEyesStartTime = null;
let alertTriggered = false;
const ALERT_THRESHOLD_MS = 2000; 

const startBtn = document.getElementById("start-btn");
const resetBtn = document.getElementById("reset-btn");
const loader = document.getElementById("loader");
const webcamContainer = document.getElementById("webcam-container");

const statusIndicator = document.getElementById("status-indicator");
const statusText = document.getElementById("status-text");
const statusIcon = document.getElementById("status-icon");

const timerVal = document.getElementById("timer-val");
const configVal = document.getElementById("confidence-val");
const progressBar = document.getElementById("progress-bar");
const toast = document.getElementById("toast");
const toastMsg = document.getElementById("toast-msg");

let audioCtx;
let alarmInterval = null;

const icons = {
    open: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>`,
    closed: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`,
    alert: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>` 
};

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playBeep() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
}

function stopAlarmSound() {
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
}

async function init() {
    initAudio();
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    startBtn.classList.add("hidden");
    loader.style.display = "flex";

    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    try {
        model = await tmImage.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();

        const flip = true; 
        webcam = new tmImage.Webcam(480, 480, flip);
        
        await webcam.setup();
        await webcam.play();
        window.requestAnimationFrame(loop);

        loader.style.display = "none";
        webcamContainer.appendChild(webcam.canvas);
        resetBtn.classList.remove("hidden");
        
        setNormalUI();
        isRunning = true;
    } catch (error) {
        console.error("Error al cargar:", error);
        statusText.innerText = "Error cargando IA";
        startBtn.classList.remove("hidden");
        loader.style.display = "none";
    }
}

async function loop() {
    if (!isRunning) return;
    webcam.update(); 
    await predict();
    window.requestAnimationFrame(loop);
}

async function predict() {
    const prediction = await model.predict(webcam.canvas);
    
    let highestProb = 0;
    let bestClass = "";
    
    for (let i = 0; i < maxPredictions; i++) {
        if (prediction[i].probability > highestProb) {
            highestProb = prediction[i].probability;
            bestClass = prediction[i].className;
        }
    }
    
    configVal.innerText = (highestProb * 100).toFixed(0) + "%";

    if (bestClass.toLowerCase().includes("cerrado") && highestProb > 0.6) {
        if (closedEyesStartTime === null) {
            closedEyesStartTime = Date.now();
        }
        
        const elapsedTime = Date.now() - closedEyesStartTime;
        const seconds = (elapsedTime / 1000).toFixed(1);
        timerVal.innerText = seconds + "s";
        
        // Calcular progreso
        let progressPercent = (elapsedTime / ALERT_THRESHOLD_MS) * 100;
        if (progressPercent > 100) progressPercent = 100;
        progressBar.style.width = progressPercent + "%";
        
        if (elapsedTime < ALERT_THRESHOLD_MS) {
            timerVal.style.color = "var(--warning)";
            progressBar.style.backgroundColor = "var(--warning)";
            setPreventiveUI();
        } else if (!alertTriggered) {
            timerVal.style.color = "var(--danger)";
            progressBar.style.backgroundColor = "var(--danger)";
            triggerAlert();
        }
    } else {
        if (highestProb > 0.6) {
            resetState();
        }
    }
}

function resetState() {
    closedEyesStartTime = null;
    timerVal.innerText = "0.0s";
    timerVal.style.color = "var(--text-primary)";
    progressBar.style.width = "0%";
    progressBar.style.backgroundColor = "var(--success)";
    
    if (alertTriggered) {
        stopAlarmSound();
        document.body.classList.remove("alert-active");
        alertTriggered = false;
        showToast("Sistema Restablecido Automáticamente");
    }
    
    setNormalUI();
}

function manualReset() {
    resetState();
    showToast("Reinicio Manual Completado");
}

function setNormalUI() {
    if (!alertTriggered) {
        statusIndicator.className = "status-badge normal";
        statusText.innerText = "Monitoreo Activo";
        statusIcon.innerHTML = icons.open;
    }
}

function setPreventiveUI() {
    if (!alertTriggered) {
        statusIndicator.className = "status-badge warning";
        statusText.innerText = "Posible Somnolencia";
        statusIcon.innerHTML = icons.closed;
    }
}

function triggerAlert() {
    alertTriggered = true;
    
    statusIndicator.className = "status-badge alert";
    statusText.innerText = "ALERTA DE SOMNOLENCIA";
    statusIcon.innerHTML = icons.alert;
    document.body.classList.add("alert-active");
    
    playBeep(); 
    alarmInterval = setInterval(playBeep, 400); 
    
    sendEmailAlert();
}

function sendEmailAlert() {
    fetch("https://formspree.io/f/mwvwvblz", {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            subject: "Alerta Crítica: Somnolencia Detectada",
            message: "El sistema inteligente ha detectado que el usuario tiene los ojos cerrados por más de 2 segundos de manera continua. Riesgo inminente detectado. Por favor, verifique el estado inmediatamente."
        })
    }).then(response => {
        if (response.ok) {
            showToast("Correo de emergencia enviado al supervisor");
        } else {
            console.error("Error enviando email");
        }
    }).catch(error => {
        console.error("Fetch error", error);
    });
}

function showToast(msg) {
    toastMsg.innerText = msg;
    toast.classList.remove("hidden");
    setTimeout(() => {
        toast.classList.add("hidden");
    }, 4000);
}
