import { contextBridge, ipcRenderer } from 'electron';
import { TemplateDefinition, PromptInstance, AppSettings, TemplateSummary } from './models';

// Define the API interface that will be exposed to the renderer
interface PrompteeAPI {
  // Template operations
  template: {
    list(): Promise<TemplateSummary[]>;
    get(id: string): Promise<TemplateDefinition>;
    save(template: TemplateDefinition): Promise<boolean>;
    delete(id: string): Promise<boolean>;
    move(id: string, newFolderPath: string[]): Promise<boolean>;
  };
  
  // Prompt operations
  prompt: {
    save(prompt: PromptInstance): Promise<boolean>;
    load(templateId: string, promptId: string): Promise<PromptInstance>;
    listForTemplate(templateId: string): Promise<PromptInstance[]>;
    delete(promptId: string): Promise<boolean>;
  };
  
  // Settings operations
  settings: {
    get(): Promise<AppSettings>;
    save(settings: AppSettings): Promise<boolean>;
  };
  
  // File operations
  file: {
    openDialog(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue>;
    readFile(filePath: string): Promise<string>;
    exists(filePath: string): Promise<boolean>;
    openExternal(filePath: string): Promise<boolean>;
    showInFolder(filePath: string): Promise<boolean>;
  };
  
  // Clipboard operations
  clipboard: {
    writeText(text: string): Promise<boolean>;
  };
  
  // Folder operations
  folder: {
    create(folderPath: string[]): Promise<boolean>;
    delete(folderPath: string[]): Promise<boolean>;
    getStructure(): Promise<string[][]>;
  };
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('promptee', {
  // Template operations
  template: {
    list: () => ipcRenderer.invoke('template:list'),
    get: (id: string) => ipcRenderer.invoke('template:get', id),
    save: (template: TemplateDefinition) => ipcRenderer.invoke('template:save', template),
    delete: (id: string) => ipcRenderer.invoke('template:delete', id),
    move: (id: string, newFolderPath: string[]) => ipcRenderer.invoke('template:move', id, newFolderPath),
  },
  
  // Prompt operations
  prompt: {
    save: (prompt: PromptInstance) => ipcRenderer.invoke('prompt:save', prompt),
    load: (templateId: string, promptId: string) => ipcRenderer.invoke('prompt:load', templateId, promptId),
    listForTemplate: (templateId: string) => ipcRenderer.invoke('prompt:listForTemplate', templateId),
    delete: (promptId: string) => ipcRenderer.invoke('prompt:delete', promptId),
  },
  
  // Settings operations
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings),
  },
  
  // File operations
  file: {
    openDialog: (options: Electron.OpenDialogOptions) => ipcRenderer.invoke('file:openDialog', options),
    readFile: (filePath: string) => ipcRenderer.invoke('file:readFile', filePath),
    exists: (filePath: string) => ipcRenderer.invoke('file:exists', filePath),
    openExternal: (filePath: string) => ipcRenderer.invoke('file:openExternal', filePath),
    showInFolder: (filePath: string) => ipcRenderer.invoke('file:showInFolder', filePath),
  },
  
  // Clipboard operations
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),
  },
  
  // Folder operations
  folder: {
    create: (folderPath: string[]) => ipcRenderer.invoke('folder:create', folderPath),
    delete: (folderPath: string[]) => ipcRenderer.invoke('folder:delete', folderPath),
    getStructure: () => ipcRenderer.invoke('folder:getStructure'),
  },
} as PrompteeAPI);

// Type declaration for global window object
declare global {
  interface Window {
    promptee: PrompteeAPI;
  }
}
