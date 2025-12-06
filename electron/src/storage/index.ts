import { promises as fs } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { TemplateDefinition, TemplateSummary, PromptInstance, AppSettings, StorageError } from '../models';

export class StorageManager {
  private static instance: StorageManager;
  private userDataPath: string;
  private templatesPath: string;
  private promptsPath: string;
  private settingsPath: string;
  private templatesIndexPath: string;
  private foldersIndexPath: string;

  private constructor() {
    this.userDataPath = path.join(app.getPath('userData'), 'promptadigm');
    this.templatesPath = path.join(this.userDataPath, 'templates');
    this.promptsPath = path.join(this.userDataPath, 'prompts');
    this.settingsPath = path.join(this.userDataPath, 'settings.json');
    this.templatesIndexPath = path.join(this.userDataPath, 'templates-index.json');
    this.foldersIndexPath = path.join(this.userDataPath, 'folders-index.json');
  }

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.userDataPath, { recursive: true });
      await fs.mkdir(this.templatesPath, { recursive: true });
      await fs.mkdir(this.promptsPath, { recursive: true });

      // Create default templates index if it doesn't exist
      try {
        await fs.access(this.templatesIndexPath);
      } catch {
        await this.saveTemplatesIndex([]);
      }

      // Create default folders index if it doesn't exist
      try {
        await fs.access(this.foldersIndexPath);
      } catch {
        await this.saveFoldersIndex([]);
      }

      // Create default settings if they don't exist
      try {
        await fs.access(this.settingsPath);
      } catch {
        await this.saveSettings({ theme: 'system' });
      }
    } catch (error) {
      throw new StorageError('Failed to initialize storage', { error });
    }
  }

  // Template operations
  async listTemplates(): Promise<TemplateSummary[]> {
    try {
      const indexData = await fs.readFile(this.templatesIndexPath, 'utf8');
      return JSON.parse(indexData);
    } catch (error) {
      throw new StorageError('Failed to load templates index', { error });
    }
  }

  async getTemplate(id: string): Promise<TemplateDefinition> {
    try {
      const templates = await this.listTemplates();
      const templateSummary = templates.find(t => t.id === id);
      
      if (!templateSummary) {
        throw new StorageError(`Template with id ${id} not found`);
      }

      const templatePath = this.getTemplateFilePath(templateSummary);
      const templateData = await fs.readFile(templatePath, 'utf8');
      return JSON.parse(templateData);
    } catch (error) {
      throw new StorageError(`Failed to load template ${id}`, { error });
    }
  }

  async saveTemplate(template: TemplateDefinition): Promise<void> {
    try {
      // Ensure folder structure exists
      const folderPath = path.join(this.templatesPath, ...template.folderPath);
      await fs.mkdir(folderPath, { recursive: true });

      // Save template file
      const templatePath = this.getTemplateFilePath(template);
      await fs.writeFile(templatePath, JSON.stringify(template, null, 2));

      // Update templates index
      const templates = await this.listTemplates();
      const existingIndex = templates.findIndex(t => t.id === template.id);
      const summary: TemplateSummary = {
        id: template.id,
        name: template.name,
        folderPath: template.folderPath,
        updatedAt: template.updatedAt
      };

      if (existingIndex >= 0) {
        templates[existingIndex] = summary;
      } else {
        templates.push(summary);
      }

      await this.saveTemplatesIndex(templates);
    } catch (error) {
      throw new StorageError(`Failed to save template ${template.id}`, { error });
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    try {
      const templates = await this.listTemplates();
      const templateIndex = templates.findIndex(t => t.id === id);
      
      if (templateIndex < 0) {
        throw new StorageError(`Template with id ${id} not found`);
      }

      const template = templates[templateIndex];
      const templatePath = this.getTemplateFilePath(template);
      
      // Delete template file
      await fs.unlink(templatePath);
      
      // Update index
      templates.splice(templateIndex, 1);
      await this.saveTemplatesIndex(templates);
    } catch (error) {
      throw new StorageError(`Failed to delete template ${id}`, { error });
    }
  }

  async moveTemplate(id: string, newFolderPath: string[]): Promise<void> {
    try {
      const template = await this.getTemplate(id);
      const oldPath = this.getTemplateFilePath(template);
      
      // Update template with new folder path
      template.folderPath = newFolderPath;
      template.updatedAt = new Date().toISOString();
      
      // Ensure new folder exists
      const newFolderFullPath = path.join(this.templatesPath, ...newFolderPath);
      await fs.mkdir(newFolderFullPath, { recursive: true });
      
      const newPath = this.getTemplateFilePath(template);
      
      // Move file
      await fs.rename(oldPath, newPath);
      
      // Update index
      const templates = await this.listTemplates();
      const templateIndex = templates.findIndex(t => t.id === id);
      if (templateIndex >= 0) {
        templates[templateIndex].folderPath = newFolderPath;
        templates[templateIndex].updatedAt = template.updatedAt;
        await this.saveTemplatesIndex(templates);
      }
    } catch (error) {
      throw new StorageError(`Failed to move template ${id}`, { error });
    }
  }

  // Prompt operations
  async savePrompt(promptInstance: PromptInstance): Promise<void> {
    try {
      const promptDir = path.join(this.promptsPath, promptInstance.templateId);
      await fs.mkdir(promptDir, { recursive: true });
      
      const promptPath = path.join(promptDir, `${promptInstance.id}.json`);
      await fs.writeFile(promptPath, JSON.stringify(promptInstance, null, 2));
    } catch (error) {
      throw new StorageError(`Failed to save prompt ${promptInstance.id}`, { error });
    }
  }

  async loadPrompt(templateId: string, promptId: string): Promise<PromptInstance> {
    try {
      const promptPath = path.join(this.promptsPath, templateId, `${promptId}.json`);
      const promptData = await fs.readFile(promptPath, 'utf8');
      return JSON.parse(promptData);
    } catch (error) {
      throw new StorageError(`Failed to load prompt ${promptId}`, { error });
    }
  }

  async listPromptsForTemplate(templateId: string): Promise<PromptInstance[]> {
    try {
      const promptDir = path.join(this.promptsPath, templateId);
      
      try {
        const files = await fs.readdir(promptDir);
        const prompts: PromptInstance[] = [];
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const promptPath = path.join(promptDir, file);
            const promptData = await fs.readFile(promptPath, 'utf8');
            prompts.push(JSON.parse(promptData));
          }
        }
        
        return prompts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      } catch {
        return [];
      }
    } catch (error) {
      throw new StorageError(`Failed to list prompts for template ${templateId}`, { error });
    }
  }

  async deletePrompt(promptId: string): Promise<void> {
    try {
      // We need to search through template directories to find the prompt
      const templateDirs = await fs.readdir(this.promptsPath);
      
      for (const templateDir of templateDirs) {
        const promptPath = path.join(this.promptsPath, templateDir, `${promptId}.json`);
        
        try {
          await fs.access(promptPath);
          await fs.unlink(promptPath);
          return;
        } catch {
          // File doesn't exist in this template directory, continue searching
          continue;
        }
      }
      
      throw new Error(`Prompt ${promptId} not found`);
    } catch (error) {
      throw new StorageError(`Failed to delete prompt ${promptId}`, { error });
    }
  }

  // Settings operations
  async getSettings(): Promise<AppSettings> {
    try {
      const settingsData = await fs.readFile(this.settingsPath, 'utf8');
      return JSON.parse(settingsData);
    } catch (error) {
      throw new StorageError('Failed to load settings', { error });
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      await fs.writeFile(this.settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
      throw new StorageError('Failed to save settings', { error });
    }
  }

  // File operations
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      throw new StorageError(`Failed to read file ${filePath}`, { error });
    }
  }

  // Private helper methods
  private async saveTemplatesIndex(templates: TemplateSummary[]): Promise<void> {
    await fs.writeFile(this.templatesIndexPath, JSON.stringify(templates, null, 2));
  }

  private getTemplateFilePath(template: TemplateDefinition | TemplateSummary): string {
    return path.join(this.templatesPath, ...template.folderPath, `${template.id}.json`);
  }

  // Utility methods for folder operations
  async createFolder(folderPath: string[]): Promise<void> {
    try {
      const fullPath = path.join(this.templatesPath, ...folderPath);
      await fs.mkdir(fullPath, { recursive: true });
      
      // Add to folders index
      const folders = await this.loadFoldersIndex();
      if (!folders.some(f => JSON.stringify(f) === JSON.stringify(folderPath))) {
        folders.push(folderPath);
        await this.saveFoldersIndex(folders);
      }
    } catch (error) {
      throw new StorageError(`Failed to create folder ${folderPath.join('/')}`, { error });
    }
  }

  async deleteFolder(folderPath: string[]): Promise<void> {
    try {
      const fullPath = path.join(this.templatesPath, ...folderPath);
      const files = await fs.readdir(fullPath);
      
      if (files.length > 0) {
        throw new StorageError(`Cannot delete non-empty folder ${folderPath.join('/')}`);
      }
      
      await fs.rmdir(fullPath);
      
      // Remove from folders index
      const folders = await this.loadFoldersIndex();
      const filtered = folders.filter(f => JSON.stringify(f) !== JSON.stringify(folderPath));
      await this.saveFoldersIndex(filtered);
    } catch (error) {
      throw new StorageError(`Failed to delete folder ${folderPath.join('/')}`, { error });
    }
  }

  async getFolderStructure(): Promise<string[][]> {
    try {
      // Get explicitly created folders from the index
      const savedFolders = await this.loadFoldersIndex();
      const allFolders: string[][] = [];
      
      // Add saved folders
      savedFolders.forEach(folderPath => {
        if (!allFolders.some(f => JSON.stringify(f) === JSON.stringify(folderPath))) {
          allFolders.push(folderPath);
        }
      });
      
      // Also add folders from templates (in case they were created outside this system)
      const templates = await this.listTemplates();
      templates.forEach(template => {
        const folderPath = template.folderPath;
        if (folderPath.length > 0 && !allFolders.some(f => JSON.stringify(f) === JSON.stringify(folderPath))) {
          allFolders.push(folderPath);
        }
      });
      
      return allFolders.sort();
    } catch (error) {
      throw new StorageError('Failed to get folder structure', { error });
    }
  }

  // Helper method to save folders index
  private async saveFoldersIndex(folders: string[][]): Promise<void> {
    await fs.writeFile(this.foldersIndexPath, JSON.stringify(folders, null, 2));
  }

  // Helper method to load folders index
  private async loadFoldersIndex(): Promise<string[][]> {
    try {
      const data = await fs.readFile(this.foldersIndexPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
}