(function () {
  // ---- Lead capture: every form posts to /api/lead.php (DB, email, WhatsApp) ----
  var TOUCH_KEY = 'gd_touch';
  function readTouch() {
    try { return JSON.parse(sessionStorage.getItem(TOUCH_KEY)) || {}; } catch (e) { return {}; }
  }
  (function captureTouch() {
    var t = readTouch();
    if (t.captured) return;
    var q = new URLSearchParams(location.search);
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) { if (q.get(k)) t[k] = q.get(k); });
    if (document.referrer) {
      try { if (new URL(document.referrer).host !== location.host) t.referrer = document.referrer; } catch (e) {}
    }
    t.captured = true;
    try { sessionStorage.setItem(TOUCH_KEY, JSON.stringify(t)); } catch (e) {}
  })();

  function collectLead(form, formType) {
    var f = {}, details = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === 'submit' || el.type === 'button') return;
      if (el.type === 'checkbox') {
        if (el.checked) (details[el.name] = details[el.name] || []).push(el.value);
        return;
      }
      if (el.type === 'radio' && !el.checked) return;
      var v = (el.value || '').trim();
      if (!v) return;
      if (el.name === 'name' || el.name === 'email' || el.name === 'phone') f[el.name] = v;
      else if (el.name === 'website' || el.name === 'site') f.website = v;
      else if (el.name === 'first_name') f.first = v;
      else if (el.name === 'last_name') f.last = v;
      else details[el.name] = v;
    });
    if (!f.name && (f.first || f.last)) f.name = [f.first, f.last].filter(Boolean).join(' ');
    delete f.first; delete f.last;
    var t = readTouch();
    f.details = details;
    f.form_type = formType;
    f.page_path = location.pathname;
    f.utm_source = t.utm_source; f.utm_medium = t.utm_medium; f.utm_campaign = t.utm_campaign;
    f.referrer = t.referrer;
    return f;
  }

  // Resolves on success (after redirecting), rejects with a user-facing message.
  window.gdSubmitLead = function (form, formType) {
    return fetch('/api/lead.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectLead(form, formType))
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
        window.location.href = '/thank-you';
      });
    }, function () {
      throw new Error('Network error. Please check your connection and try again.');
    });
  };

  // Shared submit wiring: busy state + inline error under the form.
  window.gdHandleForm = function (form, formType, validate) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = form.querySelector('.gd-form-error');
      if (!err) {
        err = document.createElement('p');
        err.className = 'gd-form-error';
        err.setAttribute('role', 'alert');
        form.appendChild(err);
      }
      err.textContent = '';
      var msg = validate ? validate(form) : (form.checkValidity() ? '' : 'Please fill in the required fields.');
      if (msg) { err.textContent = msg; return; }
      var btn = form.querySelector('[type="submit"]');
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Sending…'; }
      window.gdSubmitLead(form, formType).catch(function (ex) {
        err.textContent = ex.message;
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
      });
    });
  };
})();

(function () {
  async function injectFragment(id, url) {
    const container = document.getElementById(id);
    if (!container) return;

    try {
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) throw new Error('Failed to load ' + url + ' (' + response.status + ')');
      container.innerHTML = await response.text();
    } catch (err) {
      console.error(err);
    }
  }

  function initNavigation() {
    const header = document.querySelector('.site-header');
    const toggle = document.getElementById('navToggle');
    const nav = document.getElementById('main-nav');
    const megaDetails = document.querySelectorAll('.mega-details');

    if (!toggle || !nav || !header) return;

    function closeMegaMenus(except) {
      megaDetails.forEach(function (d) {
        if (d !== except) d.removeAttribute('open');
      });
    }

    toggle.addEventListener('click', function () {
      const isOpen = header.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      if (!isOpen) closeMegaMenus();
    });

    megaDetails.forEach(function (details) {
      details.addEventListener('toggle', function () {
        if (details.open) closeMegaMenus(details);
      });
    });

    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        header.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
        closeMegaMenus();
      }
    });

    document.addEventListener('click', function (e) {
      if (header.classList.contains('nav-open') && !header.contains(e.target)) {
        header.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      }

      megaDetails.forEach(function (details) {
        if (details.open && !details.contains(e.target)) {
          details.removeAttribute('open');
        }
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (header.classList.contains('nav-open')) {
        header.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
      megaDetails.forEach(function (details) {
        if (details.open) {
          details.removeAttribute('open');
          const summary = details.querySelector('summary');
          if (summary) summary.focus();
        }
      });
    });
  }


  function initPlanBuilder() {
    const form = document.getElementById('planForm');
    const summary = document.getElementById('planSummary');
    if (!form || !summary) return;

    function checked(name) {
      return Array.prototype.map.call(
        form.querySelectorAll('input[name="' + name + '"]:checked'),
        function (input) { return input.value; }
      );
    }

    function updateSummary() {
      const goals = checked('goals');
      const challenges = checked('challenges');
      const parts = [];
      if (goals.length) parts.push('Goal: ' + goals.join(', '));
      if (challenges.length) parts.push('Fixing: ' + challenges.join(', '));
      summary.textContent = parts.length ? parts.join(' · ') : 'Pick a goal above to start your plan.';
    }

    form.addEventListener('change', updateSummary);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const name = form.elements.name;
      const email = form.elements.email;

      if (!name.value.trim()) {
        name.focus();
        summary.textContent = 'Please add your name so we know who to send the plan to.';
        return;
      }
      if (!email.value.trim() || !email.checkValidity()) {
        email.focus();
        summary.textContent = 'Please add a valid email address.';
        return;
      }

      summary.textContent = 'Sending your plan request…';
      window.gdSubmitLead(form, 'home-plan-form').catch(function (ex) { summary.textContent = ex.message; });
    });
  }

  function initReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -40px 0px', threshold: 0 });

    items.forEach(function (el) { observer.observe(el); });
  }

  function initSliders() {
    document.querySelectorAll('[data-slider]').forEach(function (slider) {
      const track = slider.querySelector('[data-slider-track]');
      const prev = slider.querySelector('[data-slider-prev]');
      const next = slider.querySelector('[data-slider-next]');
      const dotsWrap = slider.querySelector('[data-slider-dots]');
      if (!track) return;

      const slides = Array.prototype.slice.call(track.children);
      const step = function () {
        const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        return slides[0].getBoundingClientRect().width + gap;
      };

      const dots = slides.map(function (_, i) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        dot.addEventListener('click', function () { track.scrollTo({ left: i * step() }); });
        if (dotsWrap) dotsWrap.appendChild(dot);
        return dot;
      });

      function update() {
        const index = Math.round(track.scrollLeft / step());
        const maxScroll = track.scrollWidth - track.clientWidth - 2;
        dots.forEach(function (dot, i) { dot.setAttribute('aria-current', String(i === index)); });
        if (prev) prev.disabled = track.scrollLeft <= 2;
        if (next) next.disabled = track.scrollLeft >= maxScroll;
      }

      if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step() }); });
      if (next) next.addEventListener('click', function () { track.scrollBy({ left: step() }); });
      track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
      window.addEventListener('resize', update);
      update();
    });
  }

  function initIndustriesSlider() {
    const slider = document.querySelector('[data-ind-slider]');
    if (!slider) return;

    const items = Array.prototype.slice.call(slider.querySelectorAll('[data-ind-list] > .ind-item'));
    const photos = Array.prototype.slice.call(slider.querySelectorAll('[data-ind-photo]'));
    const prevBtn = slider.querySelector('[data-ind-prev]');
    const nextBtn = slider.querySelector('[data-ind-next]');
    if (!items.length || items.length !== photos.length) return;

    let active = items.findIndex(function (item) { return item.classList.contains('is-active'); });
    if (active < 0) active = 0;
    let timer = null;

    function sync() {
      photos.forEach(function (photo, i) { photo.classList.toggle('is-active', i === active); });
    }

    function goTo(index) {
      active = (index + items.length) % items.length;

      // Every capsule's look is purely a function of its distance from the active
      // one, so the browser can always transition smoothly between two known
      // states regardless of which direction we're navigating.
      items.forEach(function (item, i) {
        const distance = (i - active + items.length) % items.length;
        item.classList.remove('is-active', 'is-peek', 'is-prev');
        if (distance === 0) {
          item.classList.add('is-active');
          const bar = item.querySelector('.ind-bar');
          if (bar) {
            bar.style.transition = 'none';
            bar.style.width = '0';
            // Force reflow so the width reset takes effect before the timed fill starts.
            void bar.offsetWidth;
            bar.style.transition = '';
          }
        } else if (distance === 1) {
          item.classList.add('is-peek');
        } else if (distance === items.length - 1) {
          item.classList.add('is-prev');
        }
      });
      sync();
    }

    function restart() {
      if (timer) clearInterval(timer);
      timer = setInterval(function () { goTo(active + 1); }, 6000);
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(active - 1); restart(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(active + 1); restart(); });

    items.forEach(function (item, i) {
      const btn = item.querySelector('[data-ind-btn]');
      if (!btn) return;
      // The peeking capsule is visibly clickable (pointer cursor, hover/press
      // feedback), so it needs a real handler - otherwise it's a focusable
      // button that does nothing for keyboard and screen-reader users.
      btn.addEventListener('click', function () {
        goTo(i);
        restart();
      });
    });

    slider.addEventListener('mouseenter', function () { if (timer) clearInterval(timer); });
    slider.addEventListener('mouseleave', restart);

    goTo(active);
    restart();
  }

  function initStaticButtons() {
    // Prevent default navigation for anchor elements styled as buttons across pages
    document.addEventListener('click', function (e) {
      const a = e.target.closest('a');
      if (!a) return;

      // treat anchors with these classes as UI buttons (static)
      const buttonLike = a.classList.contains('btn') || a.classList.contains('card-link') || a.classList.contains('header-cta');

      if (buttonLike) {
        // allow explicit opt-out by adding data-allow-navigate="true",
        // and always allow real links; only empty "#" placeholders are neutralised
        const href = a.getAttribute('href') || '';
        if (a.dataset.allowNavigate === 'true' || (href && href !== '#')) return;
        e.preventDefault();
        a.setAttribute('role', 'button');
      }
    });
  }


  function initPopup() {
    var modal = document.createElement('div');
    modal.className = 'gd-modal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="gd-modal-box" role="dialog" aria-modal="true" aria-labelledby="gdModalTitle">' +
      '<button type="button" class="gd-modal-close" aria-label="Close">&times;</button>' +
      '<span class="pill">↪ Free Marketing Plan</span>' +
      '<h2 class="title" id="gdModalTitle">Get Your <strong>Free Marketing Plan</strong></h2>' +
      '<p>Tell us where to send it. A senior strategist replies within one business day.</p>' +
      '<form class="gd-modal-form" novalidate>' +
      '<input type="text" name="name" placeholder="Your name" aria-label="Your name" autocomplete="name" required>' +
      '<input type="tel" name="phone" placeholder="Phone" aria-label="Phone" autocomplete="tel" required>' +
      '<input type="email" name="email" placeholder="Work email" aria-label="Work email" autocomplete="email" required>' +
      '<input type="text" name="website" placeholder="Website (optional)" aria-label="Website" autocomplete="url">' +
      '<p class="gd-modal-error" role="alert"></p>' +
      '<button type="submit" class="btn btn-brand">Send My Plan Request</button>' +
      '</form></div>';
    document.body.appendChild(modal);

    var form = modal.querySelector('form');
    var error = modal.querySelector('.gd-modal-error');
    var lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.body.classList.add('gd-modal-open');
      form.elements.name.focus();
    }
    function close() {
      modal.hidden = true;
      document.body.classList.remove('gd-modal-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    document.addEventListener('click', function (e) {
      if (e.target.closest('.header-cta, [data-open-popup]')) {
        e.preventDefault();
        var header = document.querySelector('.site-header');
        if (header) header.classList.remove('nav-open');
        open();
      } else if (e.target === modal || e.target.closest('.gd-modal-close')) {
        close();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) close();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      if (!f.name.value.trim()) { error.textContent = 'Please add your name.'; f.name.focus(); return; }
      if (f.phone.value.replace(/\D/g, '').length < 7) { error.textContent = 'Please add a valid phone number.'; f.phone.focus(); return; }
      if (!f.email.value.trim() || !f.email.checkValidity()) { error.textContent = 'Please add a valid email address.'; f.email.focus(); return; }
      error.textContent = '';
      var btn = form.querySelector('[type="submit"]');
      btn.disabled = true; btn.textContent = 'Sending…';
      window.gdSubmitLead(form, 'popup').catch(function (ex) {
        error.textContent = ex.message;
        btn.disabled = false; btn.textContent = 'Send My Plan Request';
      });
    });
  }

  async function init() {
    // Reveal first so content never waits on the header/footer fetch.
    initReveal();
    initSliders();

    await Promise.all([
      injectFragment('header', '/header.html'),
      injectFragment('footer', '/footer.html')
    ]);

    initNavigation();
    initPlanBuilder();
    initIndustriesSlider();
    initStaticButtons();
    initPopup();

    document.querySelectorAll('.contact-form').forEach(function (form) {
      window.gdHandleForm(form, 'contact-form', function (f) {
        if (!f.elements.name.value.trim()) return 'Please add your name.';
        if (!f.elements.email.value.trim() || !f.elements.email.checkValidity()) return 'Please add a valid email address.';
        return '';
      });
    });

    document.querySelectorAll('.ls-form').forEach(function (form) { window.gdHandleForm(form, 'local-seo-form'); });
  }

  init();
})();
