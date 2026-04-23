export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  role: Role;
  content: string;
  toolCalls?: ToolCallRequest[];
  toolCallId?: string;
  name?: string;
}

export interface ToolCallRequest {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}
