import { app, BrowserWindow, ipcMain, shell, clipboard, dialog } from 'electron';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import started from 'electron-squirrel-startup';
import { StorageManager } from './storage';
import { TemplateDefinition, PromptInstance, AppSettings } from './models';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let storage: StorageManager;

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    icon: path.join(app.getAppPath(), 'assets/P.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'default',
    show: false,
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

// Initialize storage and set up IPC handlers
const initializeApp = async () => {
  try {
    storage = StorageManager.getInstance();
    await storage.initialize();
    setupIPC();
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  await initializeApp();
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers
function setupIPC(): void {
  // Template operations
  ipcMain.handle('template:list', async () => {
    try {
      return await storage.listTemplates();
    } catch (error) {
      throw new Error(`Failed to list templates: ${error.message}`);
    }
  });

  ipcMain.handle('template:get', async (event, id: string) => {
    try {
      return await storage.getTemplate(id);
    } catch (error) {
      throw new Error(`Failed to get template: ${error.message}`);
    }
  });

  ipcMain.handle('template:save', async (event, template: TemplateDefinition) => {
    try {
      await storage.saveTemplate(template);
      return true;
    } catch (error) {
      throw new Error(`Failed to save template: ${error.message}`);
    }
  });

  ipcMain.handle('template:delete', async (event, id: string) => {
    try {
      await storage.deleteTemplate(id);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  });

  ipcMain.handle('template:move', async (event, id: string, newFolderPath: string[]) => {
    try {
      await storage.moveTemplate(id, newFolderPath);
      return true;
    } catch (error) {
      throw new Error(`Failed to move template: ${error.message}`);
    }
  });

  // Prompt operations
  ipcMain.handle('prompt:save', async (event, prompt: PromptInstance) => {
    try {
      await storage.savePrompt(prompt);
      return true;
    } catch (error) {
      throw new Error(`Failed to save prompt: ${error.message}`);
    }
  });

  ipcMain.handle('prompt:load', async (event, templateId: string, promptId: string) => {
    try {
      return await storage.loadPrompt(templateId, promptId);
    } catch (error) {
      throw new Error(`Failed to load prompt: ${error.message}`);
    }
  });

  ipcMain.handle('prompt:listForTemplate', async (event, templateId: string) => {
    try {
      return await storage.listPromptsForTemplate(templateId);
    } catch (error) {
      throw new Error(`Failed to list prompts: ${error.message}`);
    }
  });

  ipcMain.handle('prompt:delete', async (event, promptId: string) => {
    try {
      await storage.deletePrompt(promptId);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete prompt: ${error.message}`);
    }
  });

  // Settings operations
  ipcMain.handle('settings:get', async () => {
    try {
      return await storage.getSettings();
    } catch (error) {
      throw new Error(`Failed to get settings: ${error.message}`);
    }
  });

  ipcMain.handle('settings:save', async (event, settings: AppSettings) => {
    try {
      await storage.saveSettings(settings);
      return true;
    } catch (error) {
      throw new Error(`Failed to save settings: ${error.message}`);
    }
  });

  // File operations
  ipcMain.handle('file:openDialog', async (event, options: Electron.OpenDialogOptions) => {
    try {
      const result = await dialog.showOpenDialog(options);
      return result;
    } catch (error) {
      throw new Error(`Failed to open file dialog: ${error.message}`);
    }
  });

  ipcMain.handle('file:readFile', async (event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  });

  ipcMain.handle('file:exists', async (event, filePath: string) => {
    try {
      return await storage.fileExists(filePath);
    } catch (error) {
      return false;
    }
  });

  ipcMain.handle('file:openExternal', async (event, filePath: string) => {
    try {
      await shell.openPath(filePath);
      return true;
    } catch (error) {
      throw new Error(`Failed to open file externally: ${error.message}`);
    }
  });

  ipcMain.handle('file:showInFolder', async (event, filePath: string) => {
    try {
      shell.showItemInFolder(filePath);
      return true;
    } catch (error) {
      throw new Error(`Failed to show file in folder: ${error.message}`);
    }
  });

  // Clipboard operations
  ipcMain.handle('clipboard:writeText', async (event, text: string) => {
    try {
      clipboard.writeText(text);
      return true;
    } catch (error) {
      throw new Error(`Failed to write to clipboard: ${error.message}`);
    }
  });

  // Folder operations
  ipcMain.handle('folder:create', async (event, folderPath: string[]) => {
    try {
      await storage.createFolder(folderPath);
      return true;
    } catch (error) {
      throw new Error(`Failed to create folder: ${error.message}`);
    }
  });

  ipcMain.handle('folder:delete', async (event, folderPath: string[]) => {
    try {
      await storage.deleteFolder(folderPath);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete folder: ${error.message}`);
    }
  });

  ipcMain.handle('folder:getStructure', async () => {
    try {
      return await storage.getFolderStructure();
    } catch (error) {
      throw new Error(`Failed to get folder structure: ${error.message}`);
    }
  });
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
