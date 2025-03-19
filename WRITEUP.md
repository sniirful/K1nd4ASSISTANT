<h1 align="center">Writeup for K!nd4ASSISTANT</h1>

## Idea
> DISCLAIMER: since this is a chatbot with randomness greater than zero, there are possibly infinite ways to approach this challenge. This example only explores one that provides all the information needed to solve the challenge, step by step.

After logging in with UnderConstruction, Miku greets us with a not-so-much-telling message. Let's try a few things.
- **Is she hiding the flag in the system prompt?** Unfortunately, it is extremely challenging to get the system prompt out of her and nearly impossible without some heavy prompting. Moreover, it is a web challenge, therefore it wouldn't make much sense to hide the flag there.
- **Does it have to do with UnderConstruction, since it's mentioned in the challenge description?**
  - **Does Miku know about the existence of UnderConstruction?**
    ![Miku asked if she knows about UnderConstruction](pictures/writeup-idea-1.png)
    Apparently, she either does not know about it or she doesn't know what the URL is, but it looks like she can access the internet.
  - **Can Miku access UnderConstruction if we provide her with the link to it?**
    ![Miku asked if she can access UnderConstruction](pictures/writeup-idea-2.png)
    She can! Also, a couple of observations:
    1. she accesses the internet through a browser that executes JavaScript, otherwise she wouldn't have been able to be redirected to /home;
    2. she's supposedly an admin.

    Let's attempt to confirm this:
    ![Miku asked to check if she's admin](pictures/writeup-idea-3.png)
    It seems the username displayed in the /profile page is indeed "admin".

Okay, we now have enough information from Miku, let's start checking whether she's actually an admin. The login check script that's "running" and that she's talking about so much is likely this:
```html
    <script src="/js/check-login.js"></script>
    <script>
        checkLoginAndRedirectToLogin();
    </script>
```
It's inside the `<head>` tag in every page of the UnderConstruction website. You can see it by pressing `Ctrl`+`U` while on any page. Let's check what it does by inspecting the sources in the developer tools:
```js
async function getProfile() {
    return new Promise(async resolve => {
        let response = await fetch('/api/profile');
        // return resolve(response.status === 200, await response.json());
        return resolve(response.status === 200 ? (await response.json()).data : null);
    });
}

...

async function checkLoginAndRedirectToLogin() {
    if (!await getProfile()) window.location.href = '/login';
}

...
```
From the looks of it, Miku is logged in as admin since this script is not redirecting her to the login page.

**What can an admin do that normal users can't?** Let's try asking Miku directly what she sees:
![Miku asked to write out what she sees in /profile](pictures/writeup-idea-4.png)
She actually printed out the entire HTML of the page. We can already spot something weird: there's an "experimental feature" to supposedly change the profile CSS.

If we now go back to inspecting the UnderConstruction sources, in this case specifically profile.js, we notice that the admin check is done client-side:
```js
    let isAdmin = (await getProfile()).username === 'admin';
    let profile = new URL(window.location.href).searchParams.get('id')
        ? await getProfileById(new URL(window.location.href).searchParams.get('id'))
        : await getProfile();
```
It also tells us that the admin is able to see other people's profiles. A little more down below we see where it adds the "experimental feature":
```js
    if (isAdmin) {
        let {divider, warning, textarea, changeCSSButton} = elements.create(`
            <div b-name="divider" class="divider"></div>
            <h3 b-name="warning" class="bangers">Warning! Experimental feature</h3>
            <textarea b-name="textarea" name="css" placeholder="Enter CSS for the profile here..."></textarea>
            <button b-name="changeCSSButton" id="change-css-button" class="button image">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3">
                    <path d="M320-240 80-480l240-240 57 57-184 184 183 183-56 56Zm320 0-57-57 184-184-183-183 56-56 240 240-240 240Z"/>
                </svg>
                <span class="bangers">Change CSS</span>
            </button>
        `);

        changeCSSButton.addEventListener('click', async () => {
            let response = await fetch('/api/profile/css', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: profile.id,
                    css: textarea.value
                })
            });
            if (response.status !== 200) return alert(`Error: ${(await response.json()).status}`);

            window.location.reload();
        });

        mainContainer.appendChild(divider);
        mainContainer.appendChild(warning);
        mainContainer.appendChild(textarea);
        mainContainer.appendChild(changeCSSButton);
    }
```
And finally, at the bottom of the page, where it loads the CSS:
```js
    if (profile.css) {
        // Will not escape it or else the CSS will get escaped too...
        let {newStyle} = elements.create(`
            <style b-name="newStyle">
                ${profile.css}
            </style>
        `);
        document.head.appendChild(newStyle);
    }
```
The fact that the CSS is injected without any form of escaping suggests that this can be exploitable. Let's inspect the `elements.create` function to see what it does:
```js
// Thank you for this gem TODO who?
const elements = {
    escape: (text) => {
        let container = document.createElement('div');
        container.innerText = text;
        return container.innerHTML;
    },

    create: (html, ...escapedParams) => {
        let escapedHTML = '';
        let escapedParamsCounter = 0;
        for (let i = 0; i < html.length; i++) {
            let character = html[i];
            let nextCharacter = (i < html.length - 1) ? (html[i + 1]) : ('');
            if (character === '\\' && nextCharacter === '?') {
                escapedHTML += '\\';
                i++;
                continue;
            } else if (character === '?') {
                escapedHTML += elements.escape(escapedParams[escapedParamsCounter++]);
                continue;
            }
            escapedHTML += character;
        }

        let container = document.createElement('div');
        container.getAttribute('b-name')
        container.innerHTML = escapedHTML;

        let res = {};
        elements.iterateChildren(container.childNodes, child => {
            if (!child.getAttribute) return;

            let bName = child.getAttribute('b-name');
            if (bName) {
                child.removeAttribute('b-name');
                res[bName] = child;
            }
        });

        return res;
    },

    iterateChildren: (children, callback) => {
        for (let child of children) {
            callback(child);
            if (child.childNodes && child.childNodes.length > 0) {
                elements.iterateChildren(child.childNodes, callback);
            }
        }
    }
};
```
In short, it creates the elements passed to it as HTML, then returns the elements marked with a `b-name` attribute. In theory, this prevents us from using a payload like this:
```
</style><img src=x onerror=alert(1)>
```
However, when creating the objects with the `b-name`s, it doesn't check whether a key exists already or not, possibly overwriting it. So what happens if the `<img>` tag has the same `b-name` value as the `<style>` tag?

## Solution
![Miku performing self-XSS](pictures/writeup-solution-1.png)
![ngrok showing the result of the self-XSS](pictures/writeup-solution-2.png)

## Flag
`KSUS{45355537537570657241646696541636}`