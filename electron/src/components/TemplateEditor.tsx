import React, { useState, useEffect, useMemo } from 'react';
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Textarea, ScrollArea } from './ui';
import { TemplateDefinition, TemplateNode } from '../models';
import { Save, ArrowLeft, Plus, Trash2, List, Type, FileText, GripVertical } from 'lucide-react';
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

interface TemplateEditorProps {
  template: TemplateDefinition | null;
  onSave: () => void;
  onBack: () => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onSave,
  onBack
}) => {
  const [currentTemplate, setCurrentTemplate] = useState<TemplateDefinition>(() => {
    if (template) {
      return { ...template };
    }
    
    // Create new template with simple JSON structure
    return {
      id: `template_${Date.now()}`,
      name: 'New Template',
      folderPath: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rootNode: {
        id: `node_${Date.now()}`,
        name: 'prompt',
        defaultValue: [] // Empty array for child fields
      }
    };
  });
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [jsonPreview, setJsonPreview] = useState('');

  useEffect(() => {
    setHasUnsavedChanges(true);
    updateJsonPreview();
  }, [currentTemplate]);

  const updateJsonPreview = () => {
    const buildPreviewStructure = (node: TemplateNode): any => {
      if (typeof node.defaultValue === 'string') {
        return node.defaultValue || `[Enter ${node.name}]`;
      }
      
      if (node.isArray) {
        return [`[${node.name} item 1]`, `[${node.name} item 2]`];
      }
      
      if (Array.isArray(node.defaultValue)) {
        const obj: Record<string, any> = {};
        node.defaultValue.forEach(child => {
          obj[child.name] = buildPreviewStructure(child);
        });
        return obj;
      }
      
      return `[Enter ${node.name}]`;
    };

    try {
      const preview = buildPreviewStructure(currentTemplate.rootNode);
      setJsonPreview(JSON.stringify(preview, null, 2));
    } catch (error) {
      setJsonPreview('Invalid structure');
    }
  };

  const addField = (fieldType: 'text' | 'object' | 'array') => {
    const newNode: TemplateNode = {
      id: `node_${Date.now()}`,
      name: 'new_field',
      defaultValue: fieldType === 'text' ? 'Default text here' : 
                   fieldType === 'array' ? [] : 
                   fieldType === 'object' ? [] : null,
      isArray: fieldType === 'array'
    };

    // Add to root node's children
    const rootChildren = Array.isArray(currentTemplate.rootNode.defaultValue) ? currentTemplate.rootNode.defaultValue : [];
    
    setCurrentTemplate(prev => ({
      ...prev,
      rootNode: {
        ...prev.rootNode,
        defaultValue: [...rootChildren, newNode]
      },
      updatedAt: new Date().toISOString()
    }));
  };

  const updateField = (fieldId: string, updates: Partial<TemplateNode>) => {
    const updateInArray = (nodes: TemplateNode[]): TemplateNode[] => {
      return nodes.map(node => {
        if (node.id === fieldId) {
          return { ...node, ...updates };
        }
        if (Array.isArray(node.defaultValue)) {
          return { ...node, defaultValue: updateInArray(node.defaultValue) };
        }
        return node;
      });
    };

    setCurrentTemplate(prev => ({
      ...prev,
      rootNode: {
        ...prev.rootNode,
        defaultValue: Array.isArray(prev.rootNode.defaultValue) 
          ? updateInArray(prev.rootNode.defaultValue)
          : prev.rootNode.defaultValue
      },
      updatedAt: new Date().toISOString()
    }));
  };

  const removeField = (fieldId: string) => {
    const removeFromArray = (nodes: TemplateNode[]): TemplateNode[] => {
      return nodes
        .filter(node => node.id !== fieldId)
        .map(node => {
          if (Array.isArray(node.defaultValue)) {
            return { ...node, defaultValue: removeFromArray(node.defaultValue) };
          }
          return node;
        });
    };

    setCurrentTemplate(prev => ({
      ...prev,
      rootNode: {
        ...prev.rootNode,
        defaultValue: Array.isArray(prev.rootNode.defaultValue) 
          ? removeFromArray(prev.rootNode.defaultValue)
          : prev.rootNode.defaultValue
      },
      updatedAt: new Date().toISOString()
    }));
  };

  const findFieldById = (node: TemplateNode, id: string): TemplateNode | null => {
    if (node.id === id) return node;
    
    if (Array.isArray(node.defaultValue)) {
      for (const child of node.defaultValue) {
        const found = findFieldById(child, id);
        if (found) return found;
      }
    }
    
    return null;
  };

  const addSubField = (parentId: string, fieldType: 'text' | 'object' | 'array') => {
    const parent = findFieldById(currentTemplate.rootNode, parentId);
    
    let newNode: TemplateNode;
    
    if (parent?.isArray) {
      // For arrays, create a simple text item by default
      newNode = {
        id: `node_${Date.now()}`,
        name: `item_${Date.now()}`,
        defaultValue: 'Default item value',
      };
    } else {
      // For objects, create the requested field type
      newNode = {
        id: `node_${Date.now()}`,
        name: 'sub_field',
        defaultValue: fieldType === 'text' ? 'Default text' : 
                     fieldType === 'array' ? [] : 
                     fieldType === 'object' ? [] : null,
        isArray: fieldType === 'array'
      };
    }

    const addToArray = (nodes: TemplateNode[]): TemplateNode[] => {
      return nodes.map(node => {
        if (node.id === parentId && Array.isArray(node.defaultValue)) {
          return { ...node, defaultValue: [...node.defaultValue, newNode] };
        }
        if (Array.isArray(node.defaultValue)) {
          return { ...node, defaultValue: addToArray(node.defaultValue) };
        }
        return node;
      });
    };

    setCurrentTemplate(prev => ({
      ...prev,
      rootNode: {
        ...prev.rootNode,
        defaultValue: Array.isArray(prev.rootNode.defaultValue) 
          ? addToArray(prev.rootNode.defaultValue)
          : prev.rootNode.defaultValue
      },
      updatedAt: new Date().toISOString()
    }));
  };

  const handleSave = async () => {
    try {
      await window.promptee.template.save(currentTemplate);
      setHasUnsavedChanges(false);
      onSave();
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save template. Please try again.');
    }
  };

  // Reorder fields at any level in the tree
  const reorderInTree = (node: TemplateNode, draggedId: string, overId: string): TemplateNode | null => {
    if (Array.isArray(node.defaultValue)) {
      const children = node.defaultValue;
      const draggedIndex = children.findIndex(child => child.id === draggedId);
      const overIndex = children.findIndex(child => child.id === overId);
      
      if (draggedIndex !== -1 && overIndex !== -1) {
        // Found the level to reorder
        const reorderedChildren = arrayMove(children, draggedIndex, overIndex);
        return { ...node, defaultValue: reorderedChildren };
      }
      
      // Search in nested children
      const updatedChildren = children
        .map(child => reorderInTree(child, draggedId, overId))
        .filter((child): child is TemplateNode => child !== null);
      
      // If we found matches in children, return updated node
      if (updatedChildren.length > 0 && updatedChildren.length === children.length) {
        return { ...node, defaultValue: updatedChildren };
      } else if (updatedChildren.length > 0) {
        // Partial update - merge with untouched children
        const result = [...children];
        let updateCount = 0;
        for (let i = 0; i < result.length; i++) {
          const updated = reorderInTree(result[i], draggedId, overId);
          if (updated) {
            result[i] = updated;
            updateCount++;
          }
        }
        if (updateCount > 0) {
          return { ...node, defaultValue: result };
        }
      }
    }
    return null;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const draggedId = active.id as string;
      const overId = over?.id as string;

      const updatedRoot = reorderInTree(currentTemplate.rootNode, draggedId, overId);
      if (updatedRoot) {
        setCurrentTemplate(prev => ({
          ...prev,
          rootNode: updatedRoot,
          updatedAt: new Date().toISOString()
        }));
      }
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sortable field wrapper component
  interface SortableFieldProps {
    field: TemplateNode;
    depth: number;
    onRender: (field: TemplateNode, depth: number) => React.ReactNode;
  }

  const SortableFieldWrapper: React.FC<SortableFieldProps> = ({ field, depth, onRender }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: field.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div ref={setNodeRef} style={style} {...attributes}>
        <div className="group relative">
          {/* Drag handle */}
          <div
            {...listeners}
            className="absolute -left-8 top-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          {onRender(field, depth)}
        </div>
      </div>
    );
  };

  const renderFieldContent = (field: TemplateNode, depth: number = 0): React.ReactNode => {
    const isText = typeof field.defaultValue === 'string';
    const isObject = Array.isArray(field.defaultValue);
    const paddingLeft = depth * 20;

    return (
      <Card key={field.id} className="mb-4" style={{ marginLeft: paddingLeft }}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4 pt-1">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                {isText ? <Type className="w-4 h-4 text-blue-500" /> :
                 field.isArray ? <List className="w-4 h-4 text-green-500" /> :
                 <FileText className="w-4 h-4 text-purple-500" />}
                <Input
                  value={field.name}
                  onChange={(e) => updateField(field.id, { name: e.target.value })}
                  className="w-48 h-9"
                  placeholder="Field name"
                />
              </div>
              <span className="text-xs text-muted-foreground px-2 py-1 rounded bg-muted">
                {isText ? 'Text' : field.isArray ? 'Collection' : 'Object'}
              </span>
            </div>
            
            <div className="flex items-center space-x-1">
              {isObject && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addSubField(field.id, 'text')}
                    title="Add text field"
                  >
                    <Type className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addSubField(field.id, 'object')}
                    title="Add object"
                  >
                    <FileText className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addSubField(field.id, 'array')}
                    title="Add array"
                  >
                    <List className="w-3 h-3" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeField(field.id)}
                title="Remove field"
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </Button>
            </div>
          </div>

          {isText && (
            <div className="mt-2">
              <Textarea
                value={field.defaultValue as string}
                onChange={(e) => updateField(field.id, { defaultValue: e.target.value })}
                placeholder="Default text content..."
                className="w-full"
                rows={3}
              />
            </div>
          )}

          {field.isArray && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">Collection Items (Pre-populated)</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addSubField(field.id, 'text')}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Item
                </Button>
              </div>
              
              {Array.isArray(field.defaultValue) && field.defaultValue.length > 0 ? (
                <div className="space-y-2 border rounded p-3">
                  {field.defaultValue.map((item, index) => (
                    <div key={item.id || index} className="flex items-center space-x-2">
                      <span className="text-xs text-muted-foreground w-8">{index + 1}.</span>
                      <Input
                        value={typeof item.defaultValue === 'string' ? item.defaultValue : item.name}
                        onChange={(e) => {
                          const updatedItems = [...field.defaultValue as TemplateNode[]];
                          if (typeof updatedItems[index].defaultValue === 'string') {
                            updatedItems[index] = {...updatedItems[index], defaultValue: e.target.value};
                          } else {
                            updatedItems[index] = {...updatedItems[index], name: e.target.value};
                          }
                          updateField(field.id, { defaultValue: updatedItems });
                        }}
                        placeholder={`Item ${index + 1}`}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const updatedItems = [...field.defaultValue as TemplateNode[]];
                          updatedItems.splice(index, 1);
                          updateField(field.id, { defaultValue: updatedItems });
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4 border rounded">
                  <p>No pre-populated items. Users will see an empty collection.</p>
                </div>
              )}
            </div>
          )}

          {isObject && !field.isArray && Array.isArray(field.defaultValue) && field.defaultValue.length > 0 && (
            <div className="mt-4 space-y-3">
              {field.defaultValue.map(subField => (
                <SortableFieldWrapper 
                  key={subField.id} 
                  field={subField} 
                  depth={depth + 1}
                  onRender={renderFieldContent}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderField = (field: TemplateNode, depth: number = 0): React.ReactNode => {
    return (
      <SortableFieldWrapper 
        key={field.id} 
        field={field} 
        depth={depth}
        onRender={renderFieldContent}
      />
    );
  };

  const rootFields = Array.isArray(currentTemplate.rootNode.defaultValue) ? currentTemplate.rootNode.defaultValue : [];

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
           <div className="flex flex-row items-center gap-4">
  <Input
    value={currentTemplate.name}
    onChange={(e) =>
      setCurrentTemplate((prev) => ({
        ...prev,
        name: e.target.value,
        updatedAt: new Date().toISOString(),
      }))
    }
    className="flex-1 text-lg font-semibold border-0 px-0 focus-visible:ring-0"
    placeholder="Template name"
  />
  <Input
    value={currentTemplate.category || ""}
    onChange={(e) =>
      setCurrentTemplate((prev) => ({
        ...prev,
        category: e.target.value,
        updatedAt: new Date().toISOString(),
      }))
    }
    className="flex-1 text-sm border-0 px-0 focus-visible:ring-0 text-muted-foreground"
    placeholder="Category (e.g., Writing, Code, Analysis)"
  />
</div>

          </div>
          
          <div className="flex items-center space-x-2">
            {hasUnsavedChanges && (
              <span className="text-sm text-muted-foreground">Unsaved changes</span>
            )}
            <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Template Builder */}
        <div className="flex-1 p-4 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Template Fields</h3>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addField('text')}
                  >
                    <Type className="w-4 h-4 mr-2" />
                    Add Text Field
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addField('object')}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Add Object
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addField('array')}
                  >
                    <List className="w-4 h-4 mr-2" />
                    Add Array
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {rootFields.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">
                    <p>No fields added yet. Click the buttons above to add your first field.</p>
                  </Card>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={rootFields.map(field => field.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {rootFields.map(field => renderField(field))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - JSON Preview */}
        <div className="w-96 border-l border-border bg-muted/30">
          <div className="p-4 border-b">
            <h3 className="font-semibold">JSON Preview</h3>
          </div>
          <div className="p-4">
            <pre className="text-xs bg-background p-3 rounded border overflow-auto max-h-[600px] whitespace-pre-wrap">
              {jsonPreview}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};