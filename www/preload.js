// Preload script to safely expose limited APIs to renderer
const { contextBridge, ipcRenderer } = require('electron');

// expose a method for closing the window
// and simple persistence helpers for the dictionary
contextBridge.exposeInMainWorld('electronAPI', {
    closeWindow: () => ipcRenderer.send('close-window'),
    readDictionary: () => ipcRenderer.invoke('read-dictionary'),
    writeDictionary: (arr) => ipcRenderer.invoke('write-dictionary', arr),
});
