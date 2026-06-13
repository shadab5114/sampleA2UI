// Catalog conformance: every component name exists in the catalog and every
// prop is allowed (with valid enum values). Used to validate static surfaces and
// to gate/repair agent output before rendering. Shared by both flows.

import { A2uiMessage, ComponentNode, isBinding } from '@/lib/a2ui/types';
import { catalogProvider } from './provider';

export interface ValidationIssue {
  nodeId?: string;
  message: string;
}

// Structural keys that are not catalog props.
const RESERVED = new Set([
  'id',
  'component',
  'children',
  'itemsPath',
  'itemTemplate',
  'onPress',
  'sx',
]);

async function validateNode(node: ComponentNode): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const spec = await catalogProvider.getComponentSpec(node.component);
  if (!spec) {
    issues.push({ nodeId: node.id, message: `Unknown component "${node.component}"` });
    return issues;
  }
  for (const key of Object.keys(node)) {
    if (RESERVED.has(key)) continue;
    const def = spec.props?.[key];
    if (!def) {
      issues.push({
        nodeId: node.id,
        message: `Unknown prop "${key}" on ${node.component}`,
      });
      continue;
    }
    const value = node[key];
    // Skip enum checks on bound values — they resolve at render time.
    if (
      def.type === 'enum' &&
      typeof value === 'string' &&
      !isBinding(value) &&
      def.values &&
      !def.values.includes(value)
    ) {
      issues.push({
        nodeId: node.id,
        message: `Invalid value "${value}" for ${node.component}.${key} (expected ${def.values.join('|')})`,
      });
    }
  }
  return issues;
}

export async function validateMessages(messages: A2uiMessage[]): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  for (const m of messages) {
    if ('updateComponents' in m) {
      for (const node of m.updateComponents.components) {
        issues.push(...(await validateNode(node)));
      }
    }
  }
  return issues;
}
