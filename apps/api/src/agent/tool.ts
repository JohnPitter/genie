export type ToolHandler = (args: unknown, signal?: AbortSignal) => Promise<unknown>;

export interface Tool {
  name: string;
  description: string;
  schema: object;
  handler: ToolHandler;
  concurrent: boolean;
}

export interface LLMTool {
  type: 'function';
  function: { name: string; description: string; parameters: object };
}

export class Registry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`agent: tool "${tool.name}" already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  schemas(): LLMTool[] {
    return this.list().map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.schema },
    }));
  }
}
