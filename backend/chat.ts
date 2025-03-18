import fetch from 'node-fetch';

interface ChatResponse {
    response?: string;
    context?: any[];
}

export class Chat {
    private endpoint: string;
    private model: string;
    private system_prompt: string;
    private temperature: number;
    private contextLength: number;
    private context: any[] = [];
    private currentRequest: AbortController | null = null;

    constructor(
        url: string,
        model: string,
        system_prompt: string,
        temperature: number,
        contextLength: number,
    ) {
        this.endpoint = `${url}/api/generate`;
        this.model = model;
        this.system_prompt = system_prompt;
        this.temperature = temperature;
        this.contextLength = contextLength;
    }

    private async _send(text: string): Promise<string> {

        const startTime = Date.now();

        this.currentRequest = new AbortController();

        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.model,
                prompt: text,
                system: this.system_prompt,
                context: this.context,
                stream: false,
                temperature: this.temperature,
                options: {
                    num_ctx: this.contextLength
                }
            }),
            signal: this.currentRequest.signal
        });
        const endTime = Date.now();

        const data = await response.json() as ChatResponse;
        this.context = data.context || [];

        console.log(`Response: ${data.response}`);
        console.log(`Response time: ${endTime - startTime} ms`);
        return data.response || '';
    }

    async send(text: string): Promise<string> {
        console.log(`Sending to the bot: ${text}`);
        return this._send(text);
    }

    cancel(): void {
        if (this.currentRequest) {
            this.currentRequest.abort();
            this.currentRequest = null;
        }
    }
}