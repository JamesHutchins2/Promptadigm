import React, { useState, useEffect } from 'react';
import { TemplateDefinition, PromptInstance, TemplateNode, PromptNodeValue, ResourceLink } from '../models';
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Textarea, ScrollArea } from './ui';
import { createRenderer } from '../renderers';
import { ArrowLeft, Save, Copy, Plus, Trash2, FileText, Upload, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PromptEditorProps {
  template: TemplateDefinition;
  promptInstance: PromptInstance;
  onBack: () => void;
  onEditTemplate: () => void;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  template,
  promptInstance: initialPromptInstance,
  onBack,
  onEditTemplate
}) => {
  const [promptInstance, setPromptInstance] = useState<PromptInstance>(initialPromptInstance);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [jsonPreview, setJsonPreview] = useState('{}');
  const [toonPreview, setToonPreview] = useState('');
  const [previewMode, setPreviewMode] = useState<'json' | 'toon'>('json');
  const [initialPromptState] = useState<PromptInstance>(initialPromptInstance);
  const [currentTemplate, setCurrentTemplate] = useState<TemplateDefinition>(template);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);

  // Update previews whenever prompt values or template structure changes
  useEffect(() => {
    updateJsonPreview();
    updateToonPreview();
  }, [promptInstance, currentTemplate]);

  // Mark as having unsaved changes when prompt is modified (but not on initial load)
  useEffect(() => {
    // Only mark as changed if the prompt has actually been modified from its initial state
    const isChanged = JSON.stringify(promptInstance) !== JSON.stringify(initialPromptState);
    setHasUnsavedChanges(isChanged);
  }, [promptInstance, initialPromptState]);

  const updateJsonPreview = () => {
    try {
      const buildJsonFromValues = (node: TemplateNode): any => {
        const nodeValue = promptInstance.values.find(v => v.nodeId === node.id);
        
        if (typeof node.defaultValue === 'string') {
          return nodeValue?.value || node.defaultValue || '';
        }
        
        if (node.isArray) {
          return Array.isArray(nodeValue?.value) ? nodeValue.value : [nodeValue?.value || 'Item 1'];
        }
        
        if (Array.isArray(node.defaultValue)) {
          const obj: Record<string, any> = {};
          node.defaultValue.forEach(child => {
            obj[child.name] = buildJsonFromValues(child);
          });
          return obj;
        }
        
        return nodeValue?.value || '';
      };

      const preview = buildJsonFromValues(currentTemplate.rootNode);
      setJsonPreview(JSON.stringify(preview, null, 2));
    } catch (error) {
      console.error('Failed to generate JSON preview:', error);
      setJsonPreview('Error generating preview');
    }
  };

  const updateToonPreview = () => {
    try {
      const renderer = createRenderer('toon');
      const preview = renderer.render(template, promptInstance);
      setToonPreview(preview);
    } catch (error) {
      console.error('Failed to generate TOON preview:', error);
      setToonPreview('Error generating TOON preview');
    }
  };

  const updatePromptValue = (nodeId: string, value: string | PromptNodeValue[] | Record<string, any>) => {
    setPromptInstance(prev => {
      const updatedValues = prev.values.map(nodeValue => 
        nodeValue.nodeId === nodeId ? { ...nodeValue, value } : nodeValue
      );
      
      // If no existing value, create new one
      if (!updatedValues.find(v => v.nodeId === nodeId)) {
        updatedValues.push({ nodeId, value });
      }
      
      return {
        ...prev,
        values: updatedValues,
        updatedAt: new Date().toISOString()
      };
    });
  };

  const getNodeValue = (nodeId: string): PromptNodeValue | undefined => {
    return promptInstance.values.find(v => v.nodeId === nodeId);
  };

  const updateTemplateNodeName = (nodeId: string, newName: string) => {
    const updateNodeInTree = (node: TemplateNode): TemplateNode => {
      if (node.id === nodeId) {
        return { ...node, name: newName };
      }
      if (Array.isArray(node.defaultValue)) {
        return {
          ...node,
          defaultValue: node.defaultValue.map(child => updateNodeInTree(child))
        };
      }
      return node;
    };

    setCurrentTemplate(prev => ({
      ...prev,
      rootNode: updateNodeInTree(prev.rootNode)
    }));
  };

  const addTemplateField = (parentNodeId?: string) => {
    const newNode: TemplateNode = {
      id: `node_${Date.now()}`,
      name: 'new_field',
      defaultValue: '',
      isArray: false
    };

    if (!parentNodeId) {
      // Add to root level
      setCurrentTemplate(prev => ({
        ...prev,
        rootNode: {
          ...prev.rootNode,
          defaultValue: Array.isArray(prev.rootNode.defaultValue)
            ? [...prev.rootNode.defaultValue, newNode]
            : [prev.rootNode, newNode]
        }
      }));
    } else {
      // Add to specific parent
      const addToNode = (node: TemplateNode): TemplateNode => {
        if (node.id === parentNodeId && Array.isArray(node.defaultValue)) {
          return {
            ...node,
            defaultValue: [...node.defaultValue, newNode]
          };
        }
        if (Array.isArray(node.defaultValue)) {
          return {
            ...node,
            defaultValue: node.defaultValue.map(child => addToNode(child))
          };
        }
        return node;
      };

      setCurrentTemplate(prev => ({
        ...prev,
        rootNode: addToNode(prev.rootNode)
      }));
    }

    // Add empty value for the new field
    updatePromptValue(newNode.id, '');
  };

  const removeTemplateField = (nodeId: string) => {
    const removeFromNode = (node: TemplateNode): TemplateNode | null => {
      if (Array.isArray(node.defaultValue)) {
        const filteredChildren = node.defaultValue
          .filter(child => child.id !== nodeId)
          .map(child => removeFromNode(child))
          .filter((child): child is TemplateNode => child !== null);
        
        return {
          ...node,
          defaultValue: filteredChildren
        };
      }
      return node;
    };

    const updatedRoot = removeFromNode(currentTemplate.rootNode);
    if (updatedRoot) {
      setCurrentTemplate(prev => ({
        ...prev,
        rootNode: updatedRoot
      }));
    }

    // Remove the corresponding value
    setPromptInstance(prev => ({
      ...prev,
      values: prev.values.filter(v => v.nodeId !== nodeId)
    }));
  };

  const addArrayItem = (nodeId: string) => {
    const nodeValue = getNodeValue(nodeId);
    const currentArray = Array.isArray(nodeValue?.value) ? nodeValue.value : [];
    
    updatePromptValue(nodeId, [...currentArray, '']);
  };

  const removeArrayItem = (nodeId: string, index: number) => {
    const nodeValue = getNodeValue(nodeId);
    const currentArray = Array.isArray(nodeValue?.value) ? nodeValue.value : [];
    
    updatePromptValue(nodeId, currentArray.filter((_, i) => i !== index));
  };

  const updateArrayItem = (nodeId: string, index: number, value: string) => {
    const nodeValue = getNodeValue(nodeId);
    const currentArray = Array.isArray(nodeValue?.value) ? nodeValue.value : [];
    const updatedArray = [...currentArray];
    updatedArray[index] = value;
    
    updatePromptValue(nodeId, updatedArray);
  };

  const handleSaveDraft = async () => {
    try {
      await window.promptee.prompt.save(promptInstance);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save prompt draft:', error);
      alert('Failed to save draft. Please try again.');
    }
  };



  const handleCopyAsFormat = async (format: 'json' | 'toon') => {
    try {
      const renderer = createRenderer(format);
      const output = renderer.render(currentTemplate, promptInstance);
      await window.promptee.clipboard.writeText(output);
      
      // Show brief confirmation
      const button = document.activeElement as HTMLButtonElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch (error) {
      console.error(`Failed to copy as ${format}:`, error);
      alert(`Failed to copy as ${format.toUpperCase()}. Please try again.`);
    }
  };

  const handleSaveAsTemplate = async () => {
    const choice = window.confirm(
      'Save as template:\n\nOK - Keep all current text and values\nCancel - Keep only structure and original template text'
    );
    
    try {
      // Create a new template based on current state
      const newTemplate: TemplateDefinition = {
        id: `template_${Date.now()}`,
        name: `${promptInstance.name || currentTemplate.name} (Copy)`,
        category: currentTemplate.category,
        folderPath: currentTemplate.folderPath,
        description: currentTemplate.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rootNode: choice ? 
          // Keep current values as defaults
          updateTemplateWithCurrentValues(currentTemplate.rootNode) :
          // Keep only structure
          JSON.parse(JSON.stringify(currentTemplate.rootNode))
      };

      await window.promptee.template.save(newTemplate);
      alert('Template saved successfully!');
    } catch (error) {
      console.error('Failed to save as template:', error);
      alert('Failed to save as template. Please try again.');
    }
  };

  const updateTemplateWithCurrentValues = (node: TemplateNode): TemplateNode => {
    const nodeValue = promptInstance.values.find(v => v.nodeId === node.id);
    
    let updatedNode = { ...node };
    
    if (nodeValue && typeof node.defaultValue === 'string') {
      updatedNode.defaultValue = nodeValue.value as string;
    } else if (nodeValue && node.isArray && Array.isArray(nodeValue.value)) {
      updatedNode.defaultValue = nodeValue.value.map((item: any, index: number) => ({
        id: `node_${Date.now()}_${index}`,
        name: `item_${index + 1}`,
        defaultValue: typeof item === 'string' ? item : JSON.stringify(item)
      }));
    }
    
    // Recursively update children
    if (Array.isArray(node.defaultValue)) {
      updatedNode.defaultValue = node.defaultValue.map(child => 
        updateTemplateWithCurrentValues(child)
      );
    }
    
    return updatedNode;
  };

  const handleSaveTemplateChanges = async () => {
    try {
      await window.promptee.template.save(currentTemplate);
      setIsEditingTemplate(false);
      alert('Template changes saved successfully!');
    } catch (error) {
      console.error('Failed to save template changes:', error);
      alert('Failed to save template changes. Please try again.');
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const draggedId = active.id as string;
      const overId = over?.id as string;

      // Find and reorder items in the template structure
      const reorderChildren = (node: TemplateNode): TemplateNode => {
        if (Array.isArray(node.defaultValue)) {
          const children = node.defaultValue;
          const oldIndex = children.findIndex(child => child.id === draggedId);
          const newIndex = children.findIndex(child => child.id === overId);
          
          if (oldIndex !== -1 && newIndex !== -1) {
            const reorderedChildren = arrayMove(children, oldIndex, newIndex);
            return { ...node, defaultValue: reorderedChildren };
          }
          
          // Recursively check children
          return {
            ...node,
            defaultValue: children.map(child => reorderChildren(child))
          };
        }
        return node;
      };

      setCurrentTemplate(prev => ({
        ...prev,
        rootNode: reorderChildren(prev.rootNode)
      }));
    }
  };

  const SortableField: React.FC<{ node: TemplateNode }> = ({ node }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
    } = useSortable({ id: node.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <div ref={setNodeRef} style={style} {...attributes}>
        {renderFormFieldContent(node, listeners)}
      </div>
    );
  };

  const renderFormField = (node: TemplateNode): React.ReactNode => {
    if (isEditingTemplate) {
      return <SortableField key={node.id} node={node} />;
    }
    return renderFormFieldContent(node);
  };

  const renderFormFieldContent = (node: TemplateNode, dragHandleProps?: any): React.ReactNode => {
    const nodeValue = getNodeValue(node.id);
    const currentValue = nodeValue?.value || node.defaultValue || '';

    // Text field
    if (typeof node.defaultValue === 'string') {
      const isLongText = node.defaultValue.length > 100;
      
      return (
        <Card key={node.id} className="mb-4">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center flex-1">
                {isEditingTemplate && dragHandleProps && (
                  <div {...dragHandleProps} className="mr-2 cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                {isEditingTemplate ? (
                  <Input
                    value={node.name}
                    onChange={(e) => updateTemplateNodeName(node.id, e.target.value)}
                    className="text-sm font-medium flex-1 mr-2"
                  />
                ) : (
                  <label className="text-sm font-medium block pt-1">{node.name}</label>
                )}
              </div>
              {isEditingTemplate && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTemplateField(node.id)}
                  className="text-destructive hover:text-destructive h-6 w-6"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
            {isLongText ? (
              <Textarea
                value={currentValue as string}
                onChange={(e) => updatePromptValue(node.id, e.target.value)}
                placeholder={`Enter ${node.name}...`}
                className="min-h-[100px]"
              />
            ) : (
              <Input
                value={currentValue as string}
                onChange={(e) => updatePromptValue(node.id, e.target.value)}
                placeholder={`Enter ${node.name}...`}
              />
            )}
          </CardContent>
        </Card>
      );
    }

    // Array field
    if (node.isArray) {
      const arrayValue = Array.isArray(currentValue) ? currentValue : [];
      
      return (
        <Card key={node.id} className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center flex-1">
                {isEditingTemplate && dragHandleProps && (
                  <div {...dragHandleProps} className="mr-2 cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                {isEditingTemplate ? (
                  <Input
                    value={node.name}
                    onChange={(e) => updateTemplateNodeName(node.id, e.target.value)}
                    className="text-lg font-semibold mr-2"
                  />
                ) : (
                  <span>{node.name}</span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem(node.id)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
                {isEditingTemplate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTemplateField(node.id)}
                    className="text-destructive hover:text-destructive h-8 w-8"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {arrayValue.map((item, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  value={item}
                  onChange={(e) => updateArrayItem(node.id, index, e.target.value)}
                  placeholder={`${node.name} item ${index + 1}`}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeArrayItem(node.id, index)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            
            {arrayValue.length === 0 && (
              <div className="text-center text-muted-foreground py-4">
                <p>No items added yet.</p>
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => addArrayItem(node.id)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Item
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    // Object field (with children)
    if (Array.isArray(node.defaultValue)) {
      return (
        <Card key={node.id} className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center flex-1">
                {isEditingTemplate && dragHandleProps && (
                  <div {...dragHandleProps} className="mr-2 cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                {isEditingTemplate ? (
                  <Input
                    value={node.name}
                    onChange={(e) => updateTemplateNodeName(node.id, e.target.value)}
                    className="text-lg font-semibold mr-2"
                  />
                ) : (
                  <span>{node.name}</span>
                )}
              </div>
              {isEditingTemplate && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addTemplateField(node.id)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Field
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTemplateField(node.id)}
                    className="text-destructive hover:text-destructive h-8 w-8"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditingTemplate && node.defaultValue.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={node.defaultValue.map(child => child.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {node.defaultValue.map(child => renderFormField(child))}
                </SortableContext>
              </DndContext>
            ) : (
              node.defaultValue.map(child => renderFormField(child))
            )}
            {isEditingTemplate && (
              <Button
                variant="ghost"
                className="w-full border-2 border-dashed"
                onClick={() => addTemplateField(node.id)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Field to {node.name}
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button 
              variant={isEditingTemplate ? "default" : "outline"}
              size="sm" 
              onClick={() => setIsEditingTemplate(!isEditingTemplate)}
            >
              {isEditingTemplate ? "Stop Editing" : "Edit Template"}
            </Button>
            <div className="flex items-center justify-between gap-4 pb-1">

 <div className="flex items-center justify-between gap-6 w-full">
  {/* Left: Template name */}
  <div className="flex items-center gap-2 min-w-[200px]">
    <span className="text-[10px] font-medium text-muted-foreground leading-none">
      Template Name:
    </span>
    <span className="text-xs font-semibold leading-none truncate">
      {currentTemplate.name}
    </span>
  </div>

  {/* Right: Inputs arranged horizontally */}
  <div className="flex items-center gap-3 flex-1">
    <Input
      value={promptInstance.name || ''}
      onChange={(e) =>
        setPromptInstance(prev => ({
          ...prev,
          name: e.target.value,
          updatedAt: new Date().toISOString(),
        }))
      }
      placeholder="Prompt name"
      className="h-7 text-xs border-0 px-2 py-0 focus-visible:ring-0 bg-transparent leading-none flex-1"
    />

    <Input
      value={promptInstance.chatShareLink || ''}
      onChange={(e) =>
        setPromptInstance(prev => ({
          ...prev,
          chatShareLink: e.target.value,
          updatedAt: new Date().toISOString(),
        }))
      }
      placeholder="Chat share link (optional)"
      className="h-7 text-xs text-muted-foreground border-0 px-2 py-0 focus-visible:ring-0 bg-transparent leading-none flex-[1.6]"
    />
  </div>
</div>

</div>


          </div>
          
          <div className="flex items-center space-x-2">
            {hasUnsavedChanges && (
              <span className="text-sm text-muted-foreground">Unsaved changes</span>
            )}
            {!isEditingTemplate ? (
              <>
                <Button variant="outline" size="sm" onClick={onEditTemplate}>
                  Edit Template
                </Button>
                <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={!hasUnsavedChanges}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Draft
                </Button>
                <Button variant="outline" size="sm" onClick={handleSaveAsTemplate}>
                  <FileText className="w-4 h-4 mr-2" />
                  Save as Template
                </Button>
              </>
            ) : (
              <Button variant="default" size="sm" onClick={handleSaveTemplateChanges}>
                <Save className="w-4 h-4 mr-2" />
                Save Template Changes
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Form Editor */}
        <div className="flex-1 overflow-auto">
          <div className="p-6 max-w-4xl">
            <h3 className="text-lg font-semibold mb-4">Fill out your prompt</h3>
            <div className="space-y-4">
              {Array.isArray(currentTemplate.rootNode.defaultValue) && currentTemplate.rootNode.defaultValue.length > 0 ? (
                isEditingTemplate ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={currentTemplate.rootNode.defaultValue.map(field => field.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {currentTemplate.rootNode.defaultValue.map(field => renderFormField(field))}
                    </SortableContext>
                  </DndContext>
                ) : (
                  currentTemplate.rootNode.defaultValue.map(field => renderFormField(field))
                )
              ) : (
                <Card className="p-8 text-center text-muted-foreground">
                  <p>This template has no fields. <Button variant="link" onClick={() => addTemplateField()}>Add a field</Button> to get started.</p>
                </Card>
              )}
              
              {/* Add New Field Button */}
              <div className="mt-4 flex justify-center">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => addTemplateField()}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Field
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Preview & Exports */}
        <div className="w-96 border-l border-border flex flex-col">
          {/* Preview */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Preview</h3>
                <div className="flex border rounded-lg p-1 bg-muted">
                  <Button
                    variant={previewMode === 'json' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setPreviewMode('json')}
                    className="text-xs px-2 py-1"
                  >
                    JSON
                  </Button>
                  <Button
                    variant={previewMode === 'toon' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setPreviewMode('toon')}
                    className="text-xs px-2 py-1"
                  >
                    TOON
                  </Button>
                </div>
              </div>
            </div>
            <ScrollArea className="flex-1 p-4">
              <pre className="text-xs font-mono bg-muted/50 p-3 rounded-md overflow-auto whitespace-pre-wrap">
                {previewMode === 'json' ? jsonPreview : toonPreview}
              </pre>
            </ScrollArea>
          </div>

          {/* Export Controls */}
          <div className="border-t border-border p-4 space-y-3">
            <h3 className="font-semibold text-sm">Export Options</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyAsFormat('json')}
                className="text-xs"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyAsFormat('toon')}
                className="text-xs"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy TOON
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};