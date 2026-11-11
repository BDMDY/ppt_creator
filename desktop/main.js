// Pulso CX — envoltorio de escritorio (portable para Windows)
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// Modo portable: los datos se guardan junto al .exe (carpeta "PulsoCX_datos"),
// así la información viaja con el programa (USB, carpeta de red, etc.).
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  app.setPath('userData', path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'PulsoCX_datos'));
}

function crearVentana() {
  const win = new BrowserWindow({
    width: 1366, height: 880, minWidth: 980, minHeight: 640,
    title: 'Pulso CX',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#10301f',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setMenu(null);
  win.once('ready-to-show', () => win.show());
  // Enlaces externos: al navegador; nunca navegar fuera de la app
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(__dirname, 'app.html'));
}

app.whenReady().then(crearVentana);
app.on('window-all-closed', () => app.quit());
