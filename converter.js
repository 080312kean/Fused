function float32ToInt16(float32) {
    v = Math.max(-1, Math.min(1, float32));
    return v < 0 ? v * 0x8000 : v * 0x7FFF;
}
function intToHex(int, pad) {
    return int.toString(16).toUpperCase().padStart(pad, "0");
}
const chunkBytes = 65536;
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const input = document.getElementById("FileSelectorInput");
const fileList = document.getElementById("FileList");
let inputArray = [];
document.getElementById("FileSelectorButton").addEventListener("click", async () => input.click())
input.addEventListener("change", async () => {
    for await (const file of await input.files){
        const entry = {file};
        const tr = document.createElement("tr");
        let td = new Array(3);
        for(let i=0;i<3;i++) {
            tr.appendChild(td[i] = document.createElement("td"));
        }
        td[0].textContent = file.name;
        td[1].textContent = `${(file.size / 1024).toFixed(1)} KB`;
        td[2].textContent = "X";
        td[2].addEventListener("click", () => {fileList.removeChild(tr); entry.removed = true;});
        fileList.appendChild(tr);
        inputArray.push(entry);
    }
    input.value = "";  
})


document.getElementById("Button").addEventListener("click", async () => {
    function linesPushString(str) {
        let i = 0;
        let j = 0;
        while(i<str.length) {
            let chunkLength = 2*chunkBytes - lines[lineCount-1].length;
            if(chunkLength <= 0) {
                lines.push("");
                lineCount++;
                chunkLength = 2*chunkBytes;
            }
            lines[lineCount-1] += str.slice(i, i+chunkLength);    
            i += chunkLength;
            j++;
        }
        return j;
    }
    let header = [inputArray.filter((entry) => !entry.removed).length.toString(16).toUpperCase()];
    let lines = [];
    let lineCount = 0;
    for(const entry of inputArray) {
        if(entry.removed) {continue;};
        let hexString = "";
        const file = entry.file;
        const filename = file.name;
        const fileType = file.type;
        let typeID;
        let meta = ""
        lines.push("");
        lineCount++;
        header.push(filename);
        header.push(lineCount-1);
        if(fileType.startsWith("audio/")) {
            typeID = "audio";
            const sampleRate = 16000;
            const audioBuffer = await audioContext.decodeAudioData(await file.arrayBuffer())
            const num_channels = audioBuffer.numberOfChannels;
            const length = audioBuffer.length;
            const ratio = audioBuffer.sampleRate / sampleRate;
            const newLength = Math.floor(length / ratio);
            let resampledChannels = new Array(num_channels);
            for(let i=0; i<num_channels;i++) {
                const buffer = audioBuffer.getChannelData(i);
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
            let processed = new Int16Array(newLength);
            for(let i=0; i<processed.length;i++) {
                let v = 0;
                for(let j=0; j<num_channels; j++) {
                    v += resampledChannels[j][i];
                }
                v /= num_channels;
                processed[i] = float32ToInt16(v);
            }
            for(let i=0; i<processed.length;i++) {
                hexString += intToHex(processed[i] & 0xFFFF, 4);
            }
            meta += intToHex(2*processed.length, 8) + intToHex(sampleRate, 4);
        }
        else if(fileType.startsWith("image/")) {
            typeID = "image";
            const img = await createImageBitmap(file);
            const width = img.width;
            const height = img.height;
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            const pixels = ctx.getImageData(0, 0, width, height).data;
            for(const value of pixels) {
                hexString += intToHex(value, 2);
            }
            meta += intToHex(width, 4) + intToHex(height, 4);
        }
        else if(fileType.startsWith("text/")) {
            const arrayBuffer = await file.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            for(const value of bytes) {
                hexString += intToHex(value, 2);
            }
            meta += intToHex(bytes.length, 4);
        }
        const chunks = linesPushString(hexString);
        header.push(typeID);
        header.push(meta);
    }
    let link = document.getElementById("Link");
    const blob = new Blob([header.concat(lines).join("\n")], {type: "text/plain"});
    link.href = URL.createObjectURL(blob);
    link.download = "hex-strings.txt";
    link.click();
})