// Tap-to-copy buttons: any <button class="copy" data-copy="..."> on the page.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button.copy');
  if (!button) return;
  await copyText(button.dataset.copy);
  button.textContent = 'Copied';
  button.classList.add('copied');
  setTimeout(() => {
    button.textContent = 'Copy';
    button.classList.remove('copied');
  }, 1500);
});
