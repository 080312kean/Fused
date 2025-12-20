const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const input = document.getElementById("FileSelectorInput");
const fileList = document.getElementById("FileList");
let inputArray = [];
document.getElementById("FileSelectorButton").addEventListener("click", async () => input.click())
input.addEventListener("change", async () => {
    for await (const file of await input.files){
        const li = document.createElement("li");
        li.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        fileList.appendChild(li);
        inputArray.push(file);
    }
    console.log(inputArray.length);
    input.value = "";  
})


document.getElementById("Button").addEventListener("click", async () => {
    let lines = [];
    for(const file of inputArray) {
        const audioBuffer = await audioContext.decodeAudioData(await file.arrayBuffer())
        const num_channels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        let resampledChannels = new Array(num_channels);
        let processed = new Int16Array(length);
        console.log(length);
        console.log(num_channels);
        for(let i=0; i<num_channels;i++) {
            const buffer = audioBuffer.getChannelData(i);
            const ratio = audioBuffer.sampleRate / 16000;
            const newLength = Math.floor(length / ratio);
            let resampled = new Float32Array(newLength);
            for(let j=0; j<newLength; j++) {
                const pos = j * ratio;
                const idx = Math.floor(pos);
                const frac = pos - idx;
                const samples = [buffer[idx], buffer[idx+1]];
                resampled[j] = samples[0] * (1-frac) + samples[1] * frac;
            }
            resampledChannels[i] = resampled;
        }
        for(let i=0; i<length;i++) {
            let v = 0;
            for(let j=0; j<num_channels;j++) {
                v += resampledChannels[j][i];
            }
            v /= num_channels;
            v = Math.max(-1, Math.min(1, v));
            processed[i] = v < 0 ? v * 0x8000 : v * 0x7FFF;
        }
        hex = ""
        for(let i=0; i<length;i++) {
            hex += (((processed[i] & 0xFF) << 8) | ((processed[i] >> 8) & 0xFF)).toString(16).toUpperCase().padStart(4, "0");
        }
        lines.push(hex);
    }
    let link = document.getElementById("Link");
    const blob = new Blob([lines.join("\n")], {type: "text/plain"});
    link.href = URL.createObjectURL(blob);
    link.download = "hex-strings.txt";
    link.click();
    inputArray = [];
    fileList.innerHTML = "";
})