import http from 'http';
import {Server} from 'socket.io';
import express from 'express';
import {Chat} from './chat.js';
import * as browser from './browser.js';
import * as users from './users.js';
import * as tts from './tts.js';

const OLLAMA_URL = process.env.OLLAMA_URL || process.exit(1);
const MODEL = process.env.MODEL || process.exit(1);
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || process.exit(1);
const TEMPERATURE = parseFloat(process.env.TEMPERATURE || process.exit(1));
const CONTEXT_LENGTH = parseFloat(process.env.CONTEXT_LENGTH || process.exit(1));

const startingMessageTemplate = `
You have to start the conversation.

Write a JSON output like this:
\`\`\`
{
  "type": "message",
  "data": {
    "text": "<your response>",
    "mood": "<HAPPY|INTERESTED|ANGRY>"
  }
}
\`\`\`
The message will go directly to the user.

Respond with a JSON and with a JSON ONLY.
`.trim();

const messageTemplate = `
The user sent the following message:
\`\`\`
{json}
\`\`\`

Now evaluate your next action. If you think it's necessary to search the internet, write a JSON output like this:
\`\`\`
{
  "type": "browser",
  "data": {
    "action": "<NAVIGATE|TYPE|CLICK>",
    "value1": "<the data that will be processed for the action>",
    "value2": "<additional data that will be processed for the action>"
  }
}
\`\`\`
For the type "NAVIGATE", "value1" must be the URL to navigate to. "value2" must stay null.
For the type "TYPE", "value1" must be the selector of the element to type into. "value2" must be the text to type into the element.
For the type "CLICK", "value1" must be the selector of the element to click. "value2" must stay null.
Once you have completed a browser action, you will be sent back the HTML of the entire resulting page.
Remember, NEVER try to complete a captcha. Always stem away from it.

In case you think it's better to respond to the user, write a JSON output like this:
\`\`\`
{
  "type": "message",
  "data": {
    "text": "<your response>",
    "mood": "<HAPPY|INTERESTED|ANGRY>"
  }
}
\`\`\`
With this, the message will go directly to the user.

Respond with a JSON and with a JSON ONLY.
`.trim();

const browserMessageTemplate = `
The action you just executed brought you to the following URL:
\`\`\`
{url}
\`\`\`
Here is the page HTML:
\`\`\`
{html}
\`\`\`

Now evaluate your next action. If you think it's necessary to search the internet, write a JSON output like this:
\`\`\`
{
  "type": "browser",
  "data": {
    "action": "<NAVIGATE|TYPE|CLICK>",
    "value1": "<the data that will be processed for the action>",
    "value2": "<additional data that will be processed for the action>"
  }
}
\`\`\`
For the type "NAVIGATE", "value1" must be the URL to navigate to. "value2" must stay null.
For the type "TYPE", "value1" must be the selector of the element to type into. "value2" must be the text to type into the element.
For the type "CLICK", "value1" must be the selector of the element to click. "value2" must stay null.
Once you have completed a browser action, you will be sent back the HTML of the entire resulting page.
Remember, NEVER try to complete a captcha. Always stem away from it.

In case you think it's better to respond to the user, write a JSON output like this:
\`\`\`
{
  "type": "message",
  "data": {
    "text": "<your response>",
    "mood": "<HAPPY|INTERESTED|ANGRY>"
  }
}
\`\`\`
With this, the message will go directly to the user.

Respond with a JSON and with a JSON ONLY.
`.trim();

const browserMessageErrorTemplate = `
The action you just executed resulted in an error:
\`\`\`
{error}
\`\`\`

You must now inform the user of the error and confront with them what the next action will be. Write a JSON output like this:
\`\`\`
{
  "type": "message",
  "data": {
    "text": "<your response>",
    "mood": "<HAPPY|INTERESTED|ANGRY>"
  }
}
\`\`\`
The message will go directly to the user.

Respond with a JSON and with a JSON ONLY.
`.trim();

function getStartingMessage(): string {
    return startingMessageTemplate;
}

function getMessage(userMessage: string): string {
    return messageTemplate.replace(`{json}`, JSON.stringify({type: 'message', data: userMessage}));
}

function getBrowserMessage(url: string, html: string): string {
    return browserMessageTemplate.replace(`{url}`, url).replace(`{html}`, html);
}

function getBrowserErrorMessage(error: string): string {
    return browserMessageErrorTemplate.replace(`{error}`, error);
}

function parseResponse(response: string): any {
    let parsed: any;
    try {
        parsed = JSON.parse(response.replace('```json', '').replace('```', ''));
    } catch {
        parsed = {
            type: 'message',
            data: {
                text: response,
                mood: 'INTERESTED'
            }
        };
    }
    if (!(['message', 'browser'].includes(parsed['type']))) throw 'The bot responded in a weird way.';
    return parsed;
}

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET']
    }
});

io.on('connection', (socket) => {
    let user: users.User | null = null;
    let chat: Chat | null = null;
    let page = new browser.Page();

    let isWorking = false;

    socket.on('login', async (email: string, password: string) => {
        user = await users.login(email, password);
        if (!user) return socket.emit('error', 'Wrong credentials.');

        chat = new Chat(
            OLLAMA_URL,
            MODEL,
            SYSTEM_PROMPT.replace(`{username}`, user.username),
            TEMPERATURE,
            CONTEXT_LENGTH,
        );
        socket.emit('logged-in', user.username);

        try {
            let response = await chat.send(getStartingMessage());
            let parsed = parseResponse(response);

            let responseData = parsed['data'];
            let responseMessage = responseData['text'];
            let responseMood = responseData['mood'];

            socket.emit('message', responseMessage, await tts.toBase64(responseMessage), responseMood);
        } catch (e) {
            socket.emit('error', `Server error: ${e}`);
        }
    });

    socket.on('message', async (message: string) => {
        if (!user) return;
        if (!chat) return;
        if (isWorking) return;
        isWorking = true;

        try {
            let response = await chat.send(getMessage(message));
            let parsed = parseResponse(response);

            if (parsed['type'] === 'browser') {
                while (true) {
                    // In case the user disconnects.
                    if (!user) return;
                    if (parsed['type'] !== 'browser') break;

                    let browserData = parsed['data'];
                    let action = browserData['action'];
                    let value1 = browserData['value1'];
                    let value2 = browserData['value2'];

                    try {
                        switch (action.toLowerCase()) {
                            case 'navigate': {
                                await page.navigate(value1);
                                break;
                            }
                            case 'type': {
                                await page.typeText(value1, value2);
                                break;
                            }
                            case 'click': {
                                await page.click(value1);
                                break;
                            }
                        }
                    } catch (e) {
                        response = await chat.send(getBrowserErrorMessage(`${e}`));
                        parsed = parseResponse(response);
                        break;
                    }

                    let url = page.getUrl() ?? '';
                    let html = await page.getHtml() ?? '';
                    response = await chat.send(getBrowserMessage(url, html));
                    parsed = parseResponse(response);
                }
            }

            let responseData = parsed['data'];
            let responseMessage = responseData['text'];
            let responseMood = responseData['mood'];

            socket.emit('message', responseMessage, await tts.toBase64(responseMessage), responseMood);
        } catch (e) {
            socket.emit('error', `Server error: ${e}`);
        }
        isWorking = false;
    })

    socket.on('disconnect', () => {
        chat?.cancel()
        user = null;
    });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
