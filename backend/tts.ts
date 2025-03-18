async function toBase64(text: string): Promise<string | null> {
    try {
        const encodedText = encodeURIComponent(text);
        const url = `http://tts:5002/api/tts?text=${encodedText}`;

        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Request failed with status code ${response.status}: ${errorText}`);
        }

        return Buffer.from(await response.arrayBuffer()).toString('base64');
    } catch {
        return null;
    }
}

export {
    toBase64
};
