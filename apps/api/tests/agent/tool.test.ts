import { describe, it, expect } from 'vitest';
import { Registry } from '../../src/agent/tool.ts';
import type { Tool } from '../../src/agent/tool.ts';

function makeTool(name: string, concurrent = false): Tool {
  return {
    name,
    description: `Tool ${name}`,
    schema: { type: 'object', properties: {}, required: [] },
    concurrent,
    handler: async () => ({ result: name }),
  };
}

describe('Registry', () => {
  it('registers and retrieves a tool', () => {
    const reg = new Registry();
    reg.register(makeTool('search'));
    expect(reg.get('search')).toBeDefined();
    expect(reg.get('search')?.name).toBe('search');
  });

  it('throws on duplicate registration', () => {
    const reg = new Registry();
    reg.register(makeTool('search'));
    expect(() => reg.register(makeTool('search'))).toThrow('already registered');
  });

  it('returns undefined for unknown tool', () => {
    const reg = new Registry();
    expect(reg.get('nonexistent')).toBeUndefined();
  });

  it('list() returns all tools', () => {
    const reg = new Registry();
    reg.register(makeTool('a'));
    reg.register(makeTool('b'));
    expect(reg.list()).toHaveLength(2);
  });

  it('schemas() returns LLM-compatible format', () => {
    const reg = new Registry();
    reg.register(makeTool('search'));
    const schemas = reg.schemas();
    expect(schemas).toHaveLength(1);
    expect(schemas[0]?.type).toBe('function');
    expect(schemas[0]?.function.name).toBe('search');
  });
});
