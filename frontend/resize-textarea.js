const textarea = document.querySelector('textarea');

function resizeTextarea() {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

textarea.addEventListener('input', resizeTextarea);
document.addEventListener('DOMContentLoaded', resizeTextarea);
