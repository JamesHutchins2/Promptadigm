import React, { useState, useEffect } from 'react';
import { Button, Card, CardHeader, CardTitle, CardContent, Input, ScrollArea } from './ui';
import { TemplateSummary, PromptInstance } from '../models';
import { Folder, Plus, Search, Edit, Play, Trash2, MoreHorizontal, FileText, Filter } from 'lucide-react';

interface TemplateLibraryProps {
  templates: TemplateSummary[];
  prompts: PromptInstance[];
  viewMode: 'templates' | 'prompts';
  onEditTemplate: (templateId: string) => void;
  onCreatePrompt: (templateId: string) => void;
  onEditPrompt: (promptId: string) => void;
  onNewTemplate: () => void;
  onViewModeChange: (mode: 'templates' | 'prompts') => void;
  onRefresh?: () => void;
}

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  templates,
  prompts,
  viewMode,
  onEditTemplate,
  onCreatePrompt,
  onEditPrompt,
  onNewTemplate,
  onViewModeChange,
  onRefresh
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [folders, setFolders] = useState<string[][]>([]);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    loadFolders();
  }, [templates]);

  const loadFolders = async () => {
    try {
      const folderStructure = await window.promptee.folder.getStructure();
      setFolders(folderStructure);
    } catch (error) {
      console.error('Failed to load folder structure:', error);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      const newFolderPath = selectedFolder.length > 0 
        ? [...selectedFolder, newFolderName]
        : [newFolderName];
      
      await window.promptee.folder.create(newFolderPath);
      await loadFolders();
      setShowFolderDialog(false);
      setNewFolderName('');
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('Failed to create folder. Please try again.');
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = selectedFolder.length === 0 || 
      JSON.stringify(template.folderPath) === JSON.stringify(selectedFolder);
    const matchesCategory = selectedCategory === '' || template.category === selectedCategory;
    return matchesSearch && matchesFolder && matchesCategory;
  });

  const filteredPrompts = prompts.filter(prompt => {
    const matchesSearch = prompt.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      prompt.templateName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = selectedFolder.length === 0 || 
      JSON.stringify(prompt.templateFolderPath || []) === JSON.stringify(selectedFolder);
    return matchesSearch && matchesFolder;
  });

  // Get unique categories for filtering
  const categories = Array.from(new Set(templates.map(t => t.category).filter(Boolean)));

  const handleDeletePrompt = async (promptId: string) => {
    if (window.confirm('Are you sure you want to delete this prompt? This action cannot be undone.')) {
      try {
        await window.promptee.prompt.delete(promptId);
        if (onRefresh) {
          onRefresh();
        }
      } catch (error) {
        console.error('Failed to delete prompt:', error);
        alert('Failed to delete prompt. Please try again.');
      }
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (window.confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
      try {
        await window.promptee.template.delete(templateId);
        if (onRefresh) {
          onRefresh();
        }
      } catch (error) {
        console.error('Failed to delete template:', error);
        alert('Failed to delete template. Please try again.');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderFolderTree = () => {
    let uniqueFolders: string[][] = [];
    let allLabel = 'All Templates';

    if (viewMode === 'prompts') {
      // For prompts view, get folders from prompts' templates
      const promptFolders = prompts
        .map(p => p.templateFolderPath || [])
        .filter(f => f.length > 0);
      uniqueFolders = Array.from(new Set(promptFolders.map(f => JSON.stringify(f)))).map(f => JSON.parse(f));
      allLabel = 'All Prompts';
    } else {
      // For templates view, use the existing folders
      uniqueFolders = Array.from(new Set(folders.map(f => JSON.stringify(f)))).map(f => JSON.parse(f));
      allLabel = 'All Templates';
    }
    
    return (
      <div className="space-y-1">
        <div
          className={`flex items-center px-2 py-1 rounded cursor-pointer hover:bg-accent ${
            selectedFolder.length === 0 ? 'bg-accent' : ''
          }`}
          onClick={() => setSelectedFolder([])}
        >
          <Folder className="w-4 h-4 mr-2" />
          <span className="text-sm">{allLabel}</span>
        </div>
        
        {uniqueFolders.map((folder, index) => (
          <div
            key={index}
            className={`flex items-center px-2 py-1 rounded cursor-pointer hover:bg-accent ${
              JSON.stringify(selectedFolder) === JSON.stringify(folder) ? 'bg-accent' : ''
            }`}
            style={{ paddingLeft: `${folder.length * 12 + 8}px` }}
            onClick={() => setSelectedFolder(folder)}
          >
            <Folder className="w-4 h-4 mr-2" />
            <span className="text-sm">{folder[folder.length - 1] || 'Unnamed'}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="h-full flex">
      {/* Left Sidebar - Folders */}
      <div className="w-64 border-r border-border bg-muted/50">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Folders</h2>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => setShowFolderDialog(true)}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          <ScrollArea className="h-[calc(100vh-200px)]">
            {renderFolderTree()}
          </ScrollArea>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header with Logo */}
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search ${viewMode}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              
              {viewMode === 'templates' && (
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Category {selectedCategory && `(${selectedCategory})`}
                  </Button>
                  {showCategoryFilter && (
                    <div className="absolute top-full left-0 mt-1 bg-background border rounded-md shadow-lg z-10 min-w-[200px]">
                      <div className="p-1">
                        <div
                          className={`px-2 py-1 rounded cursor-pointer hover:bg-accent ${selectedCategory === '' ? 'bg-accent' : ''}`}
                          onClick={() => {
                            setSelectedCategory('');
                            setShowCategoryFilter(false);
                          }}
                        >
                          All Categories
                        </div>
                        {categories.map(category => (
                          <div
                            key={category}
                            className={`px-2 py-1 rounded cursor-pointer hover:bg-accent ${selectedCategory === category ? 'bg-accent' : ''}`}
                            onClick={() => {
                              setSelectedCategory(category || '');
                              setShowCategoryFilter(false);
                            }}
                          >
                            {category}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Button onClick={onNewTemplate} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                New {viewMode === 'templates' ? 'Template' : 'Prompt'}
              </Button>
            </div>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex border rounded-lg p-1 w-fit bg-muted">
            <Button
              variant={viewMode === 'templates' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('templates')}
              className="rounded-md"
            >
              <FileText className="w-4 h-4 mr-2" />
              Templates ({templates.length})
            </Button>
            <Button
              variant={viewMode === 'prompts' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('prompts')}
              className="rounded-md"
            >
              <Edit className="w-4 h-4 mr-2" />
              Saved Prompts ({prompts.length})
            </Button>
          </div>
        </div>

        {/* Content Grid */}
        <div className="flex-1 p-4 overflow-auto">
          {viewMode === 'templates' ? (
            filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="text-muted-foreground mb-4">
                  {searchQuery ? 'No templates match your search' : 'No templates found'}
                </div>
                {!searchQuery && (
                  <Button onClick={onNewTemplate} variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Template
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg truncate pb-2">{template.name}</CardTitle>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEditTemplate(template.id)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDeleteTemplate(template.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {(template.folderPath.length > 0 || template.category) && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        {template.folderPath.length > 0 && (
                          <div className="flex items-center">
                            <Folder className="w-3 h-3 mr-1" />
                            {template.folderPath.join(' / ')}
                          </div>
                        )}
                        {template.category && (
                          <div className="bg-muted px-2 py-1 rounded text-xs">
                            {template.category}
                          </div>
                        )}
                      </div>
                    )}
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="text-sm text-muted-foreground mb-4">
                      Updated {formatDate(template.updatedAt)}
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={() => onCreatePrompt(template.id)}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Create Prompt
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                ))}
              </div>
            )
          ) : (
            // Prompts View
            filteredPrompts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="text-muted-foreground mb-4">
                  {searchQuery ? 'No prompts match your search' : 'No saved prompts found'}
                </div>
                <p className="text-sm text-muted-foreground">
                  Create prompts from templates to see them here
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPrompts.map((prompt) => (
                  <Card key={prompt.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg truncate pb-2">
                          {prompt.name || 'Untitled Prompt'}
                        </CardTitle>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onEditPrompt(prompt.id)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDeletePrompt(prompt.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        From template: {prompt.templateName}
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <div className="text-sm text-muted-foreground mb-4">
                        Updated {formatDate(prompt.updatedAt)}
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1"
                          onClick={() => onEditPrompt(prompt.id)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Continue Editing
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Folder Creation Dialog */}
      {showFolderDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Create New Folder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">Folder Name</label>
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Enter folder name..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateFolder();
                    } else if (e.key === 'Escape') {
                      setShowFolderDialog(false);
                      setNewFolderName('');
                    }
                  }}
                  autoFocus
                />
              </div>
              {selectedFolder.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  Location: {selectedFolder.join(' / ')}
                </div>
              )}
              {viewMode === 'prompts' && (
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  <p className="font-medium mb-1">Note:</p>
                  <p>Folders in Prompts view are created as template folders. Prompts will appear here once you create templates in these folders.</p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowFolderDialog(false);
                    setNewFolderName('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                >
                  Create Folder
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};