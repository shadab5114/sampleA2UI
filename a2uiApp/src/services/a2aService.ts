import type { Part } from '@a2a-js/sdk';

export class A2aService {
  private serverUrl: string = 'http://localhost:7860';
  private sendCredentialsValue: boolean = false;
  private uiModeValue: boolean = true;
  private usernameValue: string = '';
  private passwordValue: string = '';
  public lastHeaders: Record<string, string> = {};

  setServerUrl(url: string) {
    this.serverUrl = url;
  }

  getServerUrl() {
    return this.serverUrl;
  }

  setUiMode(mode: boolean) {
    this.uiModeValue = mode;
  }

  get uiMode() {
    return this.uiModeValue;
  }

  setSendCredentials(send: boolean) {
    this.sendCredentialsValue = send;
  }

  get sendCredentials() {
    return this.sendCredentialsValue;
  }

  setUsername(u: string) {
    this.usernameValue = u;
  }

  getUsername() {
    return this.usernameValue;
  }

  setPassword(p: string) {
    this.passwordValue = p;
  }

  getPassword() {
    return this.passwordValue;
  }

  async sendMessage(parts: Part[]): Promise<any> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    const transformedParts = parts.map((p: any) => ({
      kind: p.kind || p.type || 'text',
      type: p.kind || p.type || 'text',
      ...(p.kind === 'data' || p.type === 'data' ? { data: p.data } : { text: p.text }),
      metadata: p.metadata || null
    }));

    const requestBody = {
      jsonrpc: '2.0',
      method: 'tasks/send',
      params: {
        id: messageId,
        sessionId: sessionId,
        message: {
          role: 'user',
          parts: transformedParts
        }
      },
      id: requestId
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'A2A-Version': '1.0',
      'X-A2A-MessageId': messageId,
      'X-A2A-RequestId': requestId
    };

    if (this.sendCredentialsValue && this.usernameValue && this.passwordValue) {
      const credentials = btoa(`${this.usernameValue}:${this.passwordValue}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }

    if (this.uiModeValue) {
      headers['X-A2A-Extensions'] = 'https://a2ui.org/a2a-extension/a2ui/v0.9.1';
    }

    this.lastHeaders = { ...headers };

    const response = await fetch(this.serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getAgentCard(): Promise<any> {
    const baseUrl = this.serverUrl.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/.well-known/agent.json`);
    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
}

export const a2aService = new A2aService();
