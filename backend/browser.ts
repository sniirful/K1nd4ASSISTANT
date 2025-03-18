import puppeteer, * as puppeteerTypes from 'puppeteer';

const UNDERCONSTRUCTION_URL = process.env.UNDERCONSTRUCTION_URL || '';
const UNDERCONSTRUCTION_ADMIN_COOKIE = process.env.UNDERCONSTRUCTION_ADMIN_COOKIE || '';

let browser: puppeteerTypes.Browser | null = null;

async function initializeBrowser(): Promise<void> {
    browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    await browser.setCookie({
        name: 'user_id',
        value: UNDERCONSTRUCTION_ADMIN_COOKIE,
        domain: new URL(UNDERCONSTRUCTION_URL).hostname,
        path: '/'
    });
}

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class Page {
    private page: puppeteerTypes.Page | null = null;

    async navigate(url: string): Promise<void> {
        if (browser === null) {
            await initializeBrowser();
        }

        if (this.page === null) {
            this.page = await browser!.newPage();
            // TODO: use env
            await this.page.setViewport({width: 1280, height: 720});
        }

        await this.page.goto(url, {waitUntil: 'networkidle0', timeout: 60000});
    }

    async typeText(selector: string, text: string): Promise<void> {
        if (this.page === null) {
            return;
        }

        await this.page.waitForSelector(selector);
        await this.page.type(selector, text);
        await wait(2000);
    }

    async click(selector: string): Promise<void> {
        if (this.page === null) {
            return;
        }

        await this.page.waitForSelector(selector);
        await this.page.click(selector);
        await wait(2000);
    }

    async executeScript(script: string): Promise<unknown> {
        if (this.page === null) {
            return undefined;
        }

        return await this.page.evaluate(script);
    }

    async getHtml(): Promise<string | null> {
        if (this.page === null) {
            return null;
        }
        return await this.page.content();
    }

    getUrl(): string | null {
        if (this.page === null) {
            return null;
        }
        return this.page.url();
    }

    async close(): Promise<void> {
        if (this.page !== null) {
            await this.page.close();
        }

        if (browser !== null && (await browser.pages()).length === 0) {
            await browser.close();
            browser = null;
        }
    }
}

export {Page, initializeBrowser};
