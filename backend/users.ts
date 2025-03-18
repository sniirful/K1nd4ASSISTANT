import {CookieJar} from 'tough-cookie';
import fetchCookie from 'fetch-cookie';

const UNDERCONSTRUCTION_URL = process.env.UNDERCONSTRUCTION_URL || '';

interface User {
    css: string;
    email: string;
    fav_genres: string[];
    fav_manga: string;
    id: number;
    password: string;
    profile_picture: string | null;
    username: string;
}

async function login(email: string, password: string): Promise<User | null> {
    try {
        const cookieJar = new CookieJar();
        const sessionFetch = fetchCookie(fetch, cookieJar);

        const loginResponse = await sessionFetch(`${UNDERCONSTRUCTION_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({email, password}),
        });

        if (loginResponse.status !== 200) {
            return null;
        }

        const profileResponse = await sessionFetch(`${UNDERCONSTRUCTION_URL}/api/profile`);

        if (profileResponse.status !== 200) {
            return null;
        }

        const userData = (await profileResponse.json()).data;
        return userData as User;
    } catch {
        return null;
    }
}

export {
    User,
    login
};
