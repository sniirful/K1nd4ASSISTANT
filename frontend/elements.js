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