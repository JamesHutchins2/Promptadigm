import React, { useState, useEffect } from 'react';
import { Button } from './components/ui';
import { 
  TemplateDefinition, 
  TemplateNode,
  PromptInstance, 
  PromptNodeValue,
  NavigationState, 
  TemplateSummary 
} from './models';
import { TemplateLibrary } from './components/TemplateLibrary';
import { TemplateEditor } from './components/TemplateEditor';
import { PromptEditor } from './components/PromptEditor';
import { Settings } from './components/Settings';
import { Plus, Settings as SettingsIcon, FileText, Edit3 } from 'lucide-react';

const App: React.FC = () => {
  const [navigationState, setNavigationState] = useState<NavigationState>({
    currentView: 'library',
    viewMode: 'templates',
    isEditing: false
  });
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [prompts, setPrompts] = useState<PromptInstance[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<TemplateDefinition | null>(null);

  // Load templates and prompts on startup
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadPrompts = async (templateList?: TemplateSummary[]) => {
    try {
      // Use provided template list or current templates state
      const templatesToUse = templateList || templates;
      if (templatesToUse.length === 0) {
        setPrompts([]);
        return;
      }
      
      const allPrompts: PromptInstance[] = [];
      
      for (const template of templatesToUse) {
        try {
          const templatePrompts = await window.promptee.prompt.listForTemplate(template.id);
          allPrompts.push(...templatePrompts);
        } catch (error) {
          // Template might have no prompts, which is fine
          console.debug(`No prompts found for template ${template.id}`);
        }
      }
      setPrompts(allPrompts);
    } catch (error) {
      console.error('Failed to load prompts:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const templateList = await window.promptee.template.list();
      setTemplates(templateList);
      // Load prompts after templates are loaded
      await loadPrompts(templateList);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const handleNewTemplate = () => {
    setNavigationState({
      currentView: 'templateEditor',
      isEditing: true
    });
    setCurrentTemplate(null);
  };

  const handleEditTemplate = async (templateId: string) => {
    try {
      const template = await window.promptee.template.get(templateId);
      setCurrentTemplate(template);
      setNavigationState(prev => ({
        ...prev,
        currentView: 'templateEditor',
        previousView: prev.currentView,
        selectedTemplateId: templateId,
        isEditing: true
      }));
    } catch (error) {
      console.error('Failed to load template for editing:', error);
    }
  };

  const handleCreatePrompt = async (templateId: string) => {
    try {
      const template = await window.promptee.template.get(templateId);
      setCurrentTemplate(template);
      
      // Initialize values for the simplified template structure
      const initializeValues = (node: TemplateNode): PromptNodeValue[] => {
        const values: PromptNodeValue[] = [];
        
        if (typeof node.defaultValue === 'string' || node.isArray || Array.isArray(node.defaultValue)) {
          values.push({
            nodeId: node.id,
            value: node.defaultValue || (node.isArray ? [] : '')
          });
        }
        
        // Initialize child values recursively
        if (Array.isArray(node.defaultValue)) {
          node.defaultValue.forEach(child => {
            values.push(...initializeValues(child));
          });
        }
        
        return values;
      };

      // Create a new prompt instance with initialized values
      const newPromptInstance: PromptInstance = {
        id: `prompt_${Date.now()}`,
        templateId: template.id,
        templateName: template.name,
        templateFolderPath: template.folderPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        values: initializeValues(template.rootNode),
        resources: []
      };

      setNavigationState(prev => ({
        ...prev,
        currentView: 'promptEditor',
        previousView: prev.currentView,
        selectedTemplateId: templateId,
        currentPromptInstance: newPromptInstance,
        isEditing: false
      }));
    } catch (error) {
      console.error('Failed to create prompt:', error);
    }
  };

  const handleEditPrompt = async (promptId: string) => {
    try {
      // Find the prompt and load its template
      const prompt = prompts.find(p => p.id === promptId);
      if (!prompt) return;
      
      const template = await window.promptee.template.get(prompt.templateId);
      setCurrentTemplate(template);
      
      setNavigationState(prev => ({
        ...prev,
        currentView: 'promptEditor',
        previousView: prev.currentView,
        selectedTemplateId: prompt.templateId,
        currentPromptInstance: prompt,
        isEditing: false
      }));
    } catch (error) {
      console.error('Failed to load prompt for editing:', error);
    }
  };

  const handleBackToLibrary = () => {
    setNavigationState(prev => ({
      ...prev,
      currentView: 'library',
      isEditing: false
    }));
    setCurrentTemplate(null);
    loadTemplates(); // Refresh templates list
    loadPrompts(); // Refresh prompts list
  };

  const handleBack = () => {
    const previousView = navigationState.previousView || 'library';
    setNavigationState(prev => ({
      ...prev,
      currentView: previousView,
      previousView: undefined,
      isEditing: false
    }));
    if (previousView === 'library') {
      setCurrentTemplate(null);
      loadTemplates();
      loadPrompts();
    }
  };

  const renderCurrentView = () => {
    switch (navigationState.currentView) {
      case 'library':
        return (
          <TemplateLibrary
            templates={templates}
            prompts={prompts}
            viewMode={navigationState.viewMode || 'templates'}
            onEditTemplate={handleEditTemplate}
            onCreatePrompt={handleCreatePrompt}
            onEditPrompt={handleEditPrompt}
            onNewTemplate={handleNewTemplate}
            onViewModeChange={(mode) => setNavigationState(prev => ({ ...prev, viewMode: mode }))}
            onRefresh={async () => {
              await loadTemplates();
            }}
          />
        );
      
      case 'templateEditor':
        return (
          <TemplateEditor
            template={currentTemplate}
            onSave={loadTemplates}
            onBack={handleBack}
          />
        );
      
      case 'promptEditor':
        if (!currentTemplate || !navigationState.currentPromptInstance) {
          return <div>Loading...</div>;
        }
        return (
          <PromptEditor
            template={currentTemplate}
            promptInstance={navigationState.currentPromptInstance}
            onBack={handleBack}
            onEditTemplate={() => handleEditTemplate(currentTemplate.id)}
          />
        );
      
      case 'settings':
        return (
          <Settings onBack={handleBack} />
        );
      
      default:
        return <div>Unknown view</div>;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-primary">Promptadigm</h1>
            <div className="flex items-center space-x-1">
              
              {navigationState.currentView === 'templateEditor' && (
                <Button variant="secondary" size="sm">
                  <Edit3 className="w-4 h-4 mr-2" />
                  {currentTemplate ? 'Edit Template' : 'New Template'}
                </Button>
              )}
              
              {navigationState.currentView === 'promptEditor' && (
                <Button variant="secondary" size="sm">
                  <Edit3 className="w-4 h-4 mr-2" />
                  Prompt Editor
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {navigationState.currentView === 'library' && (
              <Button
                variant="default"
                size="sm"
                onClick={handleNewTemplate}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Template
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNavigationState(prev => ({
                ...prev,
                currentView: 'settings',
                previousView: prev.currentView
              }))}
            >
              <SettingsIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {renderCurrentView()}
      </main>
    </div>
  );
};

export default App;