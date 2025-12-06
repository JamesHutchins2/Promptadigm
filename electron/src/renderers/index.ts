import { TemplateDefinition, TemplateNode, PromptInstance, PromptNodeValue, ResourceLink } from '../models';
import { encode } from '@toon-format/toon';

// Renderer interface for consistent API
export interface Renderer {
  render(template: TemplateDefinition, promptInstance: PromptInstance): string;
}

// JSON Renderer - exports the prompt instance as clean JSON
export class JSONRenderer implements Renderer {
  render(template: TemplateDefinition, promptInstance: PromptInstance): string {
    const content = this.buildContentTree(template.rootNode, promptInstance.values);
    
    const exportData = {
      templateId: template.id,
      templateName: template.name,
      promptName: promptInstance.name || 'Untitled Prompt',
      createdAt: promptInstance.createdAt,
      updatedAt: promptInstance.updatedAt,
      content,
      resources: promptInstance.resources.map(resource => ({
        id: resource.id,
        label: resource.label,
        type: resource.type,
        path: resource.absolutePath,
        addedAt: resource.addedAt,
        tags: resource.tags || []
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  private buildContentTree(templateNode: TemplateNode, values: PromptNodeValue[]): any {
    const nodeValue = values.find(v => v.nodeId === templateNode.id);
    
    // Handle text fields
    if (typeof templateNode.defaultValue === 'string') {
      return nodeValue?.value || templateNode.defaultValue || '';
    }
    
    // Handle arrays
    if (templateNode.isArray) {
      return Array.isArray(nodeValue?.value) ? nodeValue.value : [];
    }
    
    // Handle objects with children
    if (Array.isArray(templateNode.defaultValue)) {
      const result: Record<string, any> = {};
      templateNode.defaultValue.forEach(child => {
        result[child.name] = this.buildContentTree(child, values);
      });
      return result;
    }
    
    return nodeValue?.value || null;
  }
}

// XML Renderer - exports the prompt as structured XML
export class XMLRenderer implements Renderer {
  render(template: TemplateDefinition, promptInstance: PromptInstance): string {
    const xmlContent = this.renderNode(template.rootNode, promptInstance.values, 0);
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<!-- Generated from template: ${template.name} -->\n`;
    xml += `<!-- Created: ${promptInstance.createdAt} -->\n`;
    xml += xmlContent;

    // Add resources as comments if they exist
    if (promptInstance.resources.length > 0) {
      xml += '\n<!-- Attached Resources:\n';
      promptInstance.resources.forEach(resource => {
        xml += `     ${resource.label} (${resource.type}): ${resource.absolutePath}\n`;
      });
      xml += '-->';
    }

    return xml;
  }

  private renderNode(templateNode: TemplateNode, values: PromptNodeValue[], depth: number): string {
    const indent = '  '.repeat(depth);
    const nodeValue = values.find(v => v.nodeId === templateNode.id);
    const tagName = templateNode.name.replace(/[^a-zA-Z0-9_]/g, '_');

    // Handle text fields
    if (typeof templateNode.defaultValue === 'string') {
      const content = nodeValue?.value || templateNode.defaultValue || '';
      return `${indent}<${tagName}>${this.escapeXml(content as string)}</${tagName}>\n`;
    }

    // Handle arrays
    if (templateNode.isArray) {
      const arrayValue = Array.isArray(nodeValue?.value) ? nodeValue.value : [];
      let result = `${indent}<${tagName}>\n`;
      arrayValue.forEach((item, index) => {
        result += `${indent}  <item index="${index}">${this.escapeXml(item as string)}</item>\n`;
      });
      result += `${indent}</${tagName}>\n`;
      return result;
    }

    // Handle objects
    if (Array.isArray(templateNode.defaultValue)) {
      let result = `${indent}<${tagName}>\n`;
      templateNode.defaultValue.forEach(child => {
        result += this.renderNode(child, values, depth + 1);
      });
      result += `${indent}</${tagName}>\n`;
      return result;
    }

    return `${indent}<${tagName}></${tagName}>\n`;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// TOON Renderer - exports using Token-Oriented Object Notation
export class TOONRenderer implements Renderer {
  render(template: TemplateDefinition, promptInstance: PromptInstance): string {
    const content = this.buildDataStructure(template.rootNode, promptInstance.values);
    
    // For TOON export, only include the actual content, not metadata
    return encode(content);
  }

  private buildDataStructure(templateNode: TemplateNode, values: PromptNodeValue[]): any {
    const nodeValue = values.find(v => v.nodeId === templateNode.id);
    
    // Handle text fields
    if (typeof templateNode.defaultValue === 'string') {
      return nodeValue?.value || templateNode.defaultValue || '';
    }
    
    // Handle arrays
    if (templateNode.isArray) {
      return Array.isArray(nodeValue?.value) ? nodeValue.value : [];
    }
    
    // Handle objects with children
    if (Array.isArray(templateNode.defaultValue)) {
      const result: Record<string, any> = {};
      templateNode.defaultValue.forEach(child => {
        result[child.name] = this.buildDataStructure(child, values);
      });
      return result;
    }
    
    return nodeValue?.value || null;
  }
}

// Factory function to create renderers
export function createRenderer(format: 'json' | 'xml' | 'toon'): Renderer {
  switch (format) {
    case 'json':
      return new JSONRenderer();
    case 'xml':
      return new XMLRenderer();
    case 'toon':
      return new TOONRenderer();
    default:
      throw new Error(`Unknown renderer format: ${format}`);
  }
}

// Utility functions for resource rendering (for UI use)
export function renderResourceAsTOON(resource: ResourceLink): string {
  return encode({ 
    type: 'resource_reference',
    resource: {
      id: resource.id,
      label: resource.label,
      type: resource.type,
      path: resource.absolutePath,
      tags: resource.tags || []
    }
  });
}

export function renderResourcesAsTOON(resources: ResourceLink[]): string {
  return encode({
    type: 'resource_collection',
    resources: resources.map(resource => ({
      id: resource.id,
      label: resource.label,
      type: resource.type,
      path: resource.absolutePath,
      tags: resource.tags || []
    }))
  });
}