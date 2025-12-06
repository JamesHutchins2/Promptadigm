// Core models for Promptadigm application

export interface TemplateNode {
  id: string;
  name: string; // User-defined field name (e.g., "context", "instructions", "examples")
  defaultValue: string | TemplateNode[] | null; // String content, array of nodes, or null for objects
  isArray?: boolean; // True if this represents a repeatable list
}

export interface TemplateDefinition {
  id: string;
  name: string;
  folderPath: string[];
  category?: string; // Prompt type/category for organizing templates
  description?: string;
  createdAt: string;
  updatedAt: string;
  rootNode: TemplateNode;
}

export interface TemplateSummary {
  id: string;
  name: string;
  folderPath: string[];
  category?: string;
  updatedAt: string;
}

export interface PromptNodeValue {
  nodeId: string;
  value: string | PromptNodeValue[] | Record<string, any>;
}

export interface PromptInstance {
  id: string;
  templateId: string;
  templateName: string;
  templateFolderPath?: string[]; // Folder path of the template this prompt belongs to
  name?: string;
  chatShareLink?: string; // Non-exported metadata for sharing
  createdAt: string;
  updatedAt: string;
  values: PromptNodeValue[];
  resources: ResourceLink[];
}

export interface ResourceLink {
  id: string;
  label: string;
  type: 'csv' | 'json' | 'txt' | 'xml' | 'other';
  absolutePath: string;
  addedAt: string;
  tags?: string[];
  toonRef?: string;
}

export interface AppSettings {
  templatesRootPath?: string;
  theme?: 'light' | 'dark' | 'system';
}

export interface FolderNode {
  path: string[];
  name: string;
  children: FolderNode[];
}

// Utility types for UI state
export interface NavigationState {
  currentView: 'library' | 'templateEditor' | 'promptEditor' | 'settings';
  previousView?: 'library' | 'templateEditor' | 'promptEditor' | 'settings'; // For proper back navigation
  selectedTemplateId?: string;
  currentPromptInstance?: PromptInstance;
  viewMode?: 'templates' | 'prompts'; // Toggle between templates and saved prompts
  isEditing: boolean;
}

export interface TemplateEditorState {
  template: TemplateDefinition;
  selectedNodeId?: string;
  hasUnsavedChanges: boolean;
}

export interface PromptEditorState {
  template: TemplateDefinition;
  promptInstance: PromptInstance;
  hasUnsavedChanges: boolean;
  jsonPreview: string;
}

// Error types
export class PrompteeError extends Error {
  constructor(
    message: string, 
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PrompteeError';
  }
}

export class StorageError extends PrompteeError {
  constructor(message: string, details?: any) {
    super(message, 'STORAGE_ERROR', details);
  }
}

export class ValidationError extends PrompteeError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
  }
}