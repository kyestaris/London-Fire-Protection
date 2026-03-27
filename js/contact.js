document.addEventListener('DOMContentLoaded', () => {
  const form    = document.getElementById('contact-form');
  const success = document.getElementById('form-success');
  const error   = document.getElementById('form-error');
  const btn     = form.querySelector('button[type="submit"]');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const SEND_BTN_HTML = 'Send Message <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  function showAlert(el) {
    el.style.display = 'block';
    // trigger animation by toggling class
    el.classList.remove('visible');
    void el.offsetWidth; // reflow
    el.classList.add('visible');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    success.style.display = 'none';
    success.classList.remove('visible');
    error.style.display   = 'none';
    error.classList.remove('visible');

    const name  = form.querySelector('#name').value.trim();
    const email = form.querySelector('#email').value.trim();

    if (!name || !email || !emailRegex.test(email)) {
      error.textContent = 'Please fill in your name and a valid email address.';
      showAlert(error);
      return;
    }

    const data = {
      name,
      phone:   form.querySelector('#phone').value.trim(),
      email,
      service: form.querySelector('#service').value,
      message: form.querySelector('#message').value.trim(),
    };

    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Sending…';

    try {
      const res = await fetch('/api/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });

      if (res.ok) {
        form.style.display = 'none';
        success.textContent = "We've received your request and will call you within 2 hours. If you'd prefer not to call, simply reply to the confirmation email we just sent you.";
        showAlert(success);
      } else {
        throw new Error('Server error');
      }
    } catch {
      error.textContent = 'Something went wrong. Please try again or call us directly.';
      showAlert(error);
      btn.disabled  = false;
      btn.innerHTML = SEND_BTN_HTML;
    }
  });
});
