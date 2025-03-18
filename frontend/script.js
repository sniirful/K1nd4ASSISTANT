///
/// top bar section
///

const soundButton = document.querySelector('#top-bar > div');

function isSoundActive() {
    return !soundButton.classList.contains('muted');
}

soundButton.addEventListener('click', () => {
    if (isSoundActive()) soundButton.classList.add('muted');
    else soundButton.classList.remove('muted');
});

///
/// socket section
///

const socket = io();
let email = localStorage.getItem('email');
let password = localStorage.getItem('password');
let connected = false;

function performLogin() {
    if (email && password) return socket.emit('login', email, password);

    alert('To use K!nd4ASSISTANT, you must first login with UnderConstruction.');
    email = prompt('Enter your UnderConstruction email:');
    password = prompt('Enter your UnderConstruction password:');

    socket.emit('login', email, password);
}

socket.on('connect', () => {
    if (connected) return;

    performLogin();
    connected = true;
});

socket.on('disconnect', () => {
    alert('Connection to the server lost.');
});

socket.on('error', e => {
    alert(`Error from the server: ${e}`);
});

socket.on('logged-in', username => {
    if (!localStorage.getItem('email') || !localStorage.getItem('password')) {
        alert(`Successfully logged in as ${username}`);

        localStorage.setItem('email', email);
        localStorage.setItem('password', password);
    }
});

const sprite = document.querySelector('div#sprite');
let timeout = null;

function setSpriteAnimation(animation) {
    if (timeout) clearTimeout(timeout);
    sprite.className = animation;
    if (animation !== 'idle') return;

    timeout = setTimeout(() => {
        let animation = Math.random() < 0.5 ? 'dancing' : 'waiting';
        setSpriteAnimation(animation);

        setTimeout(
            () => setSpriteAnimation('idle'),
            3000
        )
    }, (Math.floor(Math.random() * 31) + 30) * 1000); // Random time between 30 and 60 seconds.
}

const chatContainer = document.querySelector('div#chat');
const inputContainer = document.querySelector('div#input');
const voiceEnabledButton = document.querySelector('div#voice-enabled');

function typeText(element, text, speed = 20) {
    return new Promise(resolve => {
        const originalText = text;
        element.textContent = '';
        let charIndex = 0;

        const interval = setInterval(() => {
            if (charIndex < originalText.length) {
                element.textContent += originalText.charAt(charIndex);
                charIndex++;
            } else {
                clearInterval(interval);
                element.innerHTML = marked.parse(text);
                resolve();
            }
        }, speed);
    });
}

socket.on('message', (text, voiceBase64, mood) => {
    console.log(text, voiceBase64, mood);
    if (!(['happy', 'angry', 'interested'].includes(mood.toLowerCase()))) mood = 'interested';
    setSpriteAnimation(`typing-${mood.toLowerCase()}`);

    let {messageElement, typingElement} = elements.create(`
        <div class="message" b-name="messageElement">
            <div class="received" b-name="typingElement"></div>
        </div>
    `);

    if (!voiceEnabledButton.classList.contains('muted') && voiceBase64) {
        let audio = new Audio(`data:audio/wav;base64,${voiceBase64}`);
        audio.play();
    }

    chatContainer.insertBefore(messageElement, inputContainer.nextSibling);
    typeText(typingElement, text).then(
        () => {
            textarea.disabled = false;
            sendButton.classList.remove('disabled');

            textarea.focus();
            setSpriteAnimation('idle');
        }
    ).catch(
        () => {
            textarea.disabled = false;
            sendButton.classList.remove('disabled');

            textarea.focus();
            setSpriteAnimation('idle');
        }
    );
});

// Already declared.
// const textarea = document.querySelector('textarea');
const sendButton = document.querySelector('div#send-button');

sendButton.addEventListener('click', sendMessage);

textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

function sendMessage() {
    textarea.disabled = true;
    sendButton.classList.add('disabled');

    let {messageElement} = elements.create(`
        <div class="message" b-name="messageElement">
            <div class="sent">
                ?
            </div>
        </div>
    `, textarea.value);
    chatContainer.insertBefore(messageElement, inputContainer.nextSibling);

    socket.emit('message', textarea.value);
    textarea.value = '';
    resizeTextarea();

    setSpriteAnimation('reading');
}
