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
      if (['name', 'email', 'phone', 'country_code', 'service', 'message', 'company_fax'].indexOf(el.name) !== -1) f[el.name] = v;
      else if (el.name === 'website' || el.name === 'site') f.website = v;
      else if (el.name === 'first_name') f.first = v;
      else if (el.name === 'last_name') f.last = v;
      else details[el.name] = v;
    });
    if (!f.name && (f.first || f.last)) f.name = [f.first, f.last].filter(Boolean).join(' ');
    delete f.first; delete f.last;
    var t = readTouch();
    if (window.gdPlan && /^service-/.test(formType)) details.plan = String(window.gdPlan).slice(0, 300);
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

  // ---- The one lead form used everywhere (popup, contact, services, home) ----
  // Fields: name, email, phone (country code + digits only), website, service, message.
  // Mount point: <div data-gd-form data-form-type="..." data-service="..." data-submit="..." data-theme="dark"></div>
  var COUNTRIES = [
    ['IN', '+91'], ['US', '+1'], ['GB', '+44'], ['AE', '+971'], ['SA', '+966'], ['QA', '+974'], ['KW', '+965'],
    ['OM', '+968'], ['BH', '+973'], ['SG', '+65'], ['MY', '+60'], ['ID', '+62'], ['PH', '+63'], ['TH', '+66'],
    ['VN', '+84'], ['HK', '+852'], ['CN', '+86'], ['JP', '+81'], ['KR', '+82'], ['AU', '+61'], ['NZ', '+64'],
    ['CA', '+1'], ['DE', '+49'], ['FR', '+33'], ['NL', '+31'], ['ES', '+34'], ['IT', '+39'], ['CH', '+41'],
    ['IE', '+353'], ['TR', '+90'], ['RU', '+7'], ['PK', '+92'], ['BD', '+880'], ['LK', '+94'], ['NP', '+977'],
    ['NG', '+234'], ['KE', '+254'], ['ZA', '+27'], ['BR', '+55'], ['MX', '+52']
  ];
  // [min digits, max digits, optional required first-digit pattern]
  var PHONE_RULES = { '+91': [10, 10, /^[6-9]/], '+1': [10, 10, /^[2-9]/], '+44': [10, 10, /^7/], '+971': [9, 9], '+65': [8, 8] };
  var SERVICES = ['SEO', 'Local SEO', 'Google Business Profile', 'Google Ads', 'Meta Ads', 'Social Media Marketing',
    'Content Marketing', 'Email Marketing', 'Influencer Marketing', 'Crypto SEO', 'Not sure yet'];
  var NAME_RE = /^[A-Za-zÀ-ɏऀ-ॿ؀-ۿ][A-Za-zÀ-ɏऀ-ॿ؀-ۿ .'’-]{1,79}$/;
  var EMAIL_RE = /^[^\s@<>()]+@[^\s@<>()]+\.[A-Za-z]{2,}$/;
  var SITE_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  function formHTML(o) {
    var codes = COUNTRIES.map(function (c) {
      return '<option value="' + c[1] + '"' + (c[0] === 'IN' ? ' selected' : '') + '>' + c[0] + ' ' + c[1] + '</option>';
    }).join('');
    var services = '<option value="">Service (optional)</option>' + SERVICES.map(function (s) {
      return '<option' + (s === o.service ? ' selected' : '') + '>' + s + '</option>';
    }).join('');
    return '<form class="gd-form' + (o.theme === 'dark' ? ' gd-dark' : '') + '" novalidate data-form-type="' + esc(o.type) + '">' +
      '<div class="gd-field"><input type="text" name="name" placeholder="Your name" aria-label="Your name" autocomplete="name" maxlength="80" required><small class="gd-err"></small></div>' +
      '<div class="gd-field"><input type="email" name="email" placeholder="Work email" aria-label="Work email" autocomplete="email" maxlength="190" required><small class="gd-err"></small></div>' +
      '<div class="gd-field gd-full"><div class="gd-phone"><select name="country_code" aria-label="Country code">' + codes + '</select>' +
      '<input type="tel" name="phone" inputmode="numeric" placeholder="Phone number" aria-label="Phone number" autocomplete="tel-national" maxlength="14" required></div><small class="gd-err"></small></div>' +
      '<div class="gd-field"><input type="text" name="website" placeholder="Website (optional)" aria-label="Website" autocomplete="url" maxlength="255"><small class="gd-err"></small></div>' +
      '<div class="gd-field"><select name="service" aria-label="Service you need">' + services + '</select><small class="gd-err"></small></div>' +
      '<div class="gd-field gd-full"><textarea name="message" rows="3" maxlength="1000" placeholder="How can we help? (optional)" aria-label="Message"></textarea><small class="gd-err"></small></div>' +
      '<input type="text" name="company_fax" class="gd-hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<p class="gd-form-error" role="alert"></p>' +
      '<button type="submit" class="btn ' + (o.theme === 'dark' ? 'btn-primary' : 'btn-brand') + ' gd-full">' + esc(o.submit || 'Send My Request') + '</button>' +
      '</form>';
  }

  function fieldError(form, name, msg) {
    var el = form.elements[name];
    var wrap = el.closest('.gd-field');
    wrap.querySelector('.gd-err').textContent = msg || '';
    wrap.classList.toggle('has-error', !!msg);
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return msg;
  }

  function checkField(form, name) {
    var f = form.elements, v = (f[name].value || '').trim(), msg = '';
    if (name === 'name') {
      if (!v) msg = 'Please enter your name.';
      else if (!NAME_RE.test(v)) msg = 'Use letters only (at least 2).';
    } else if (name === 'email') {
      if (!v) msg = 'Please enter your email.';
      else if (!EMAIL_RE.test(v) || v.length > 190) msg = 'Enter a valid email, like name@company.com.';
    } else if (name === 'phone') {
      var d = f.phone.value.replace(/\D/g, '').replace(/^0+/, ''), r = PHONE_RULES[f.country_code.value] || [6, 14];
      if (!d) msg = 'Please enter your phone number.';
      else if (d.length < r[0] || d.length > r[1]) msg = r[0] === r[1] ? 'Enter a valid ' + r[0] + '-digit number.' : 'Enter a valid number (' + r[0] + '–' + r[1] + ' digits).';
      else if (r[2] && !r[2].test(d)) msg = 'That number does not look valid for ' + f.country_code.value + '.';
    } else if (name === 'website') {
      if (v && !SITE_RE.test(v)) msg = 'Enter a valid website, like yourbusiness.com.';
    }
    return fieldError(form, name, msg);
  }

  function wireForm(form) {
    var phone = form.elements.phone, code = form.elements.country_code;
    // digits only, as the visitor types or pastes
    phone.addEventListener('input', function () {
      var d = phone.value.replace(/\D/g, '');
      var dial = code.value.replace(/\D/g, ''), r = PHONE_RULES[code.value] || [6, 14];
      if (d.length > r[1] && d.indexOf(dial) === 0) d = d.slice(dial.length);   // pasted with country code
      phone.value = d.slice(0, 14);
    });
    code.addEventListener('change', function () { if (phone.value) checkField(form, 'phone'); });
    ['name', 'email', 'phone', 'website'].forEach(function (n) {
      form.elements[n].addEventListener('blur', function () { if (form.elements[n].value.trim() || form.elements[n].required) checkField(form, n); });
      form.elements[n].addEventListener('input', function () { if (form.elements[n].classList.contains('touched') || form.elements[n].closest('.gd-field').classList.contains('has-error')) checkField(form, n); });
      form.elements[n].addEventListener('blur', function () { form.elements[n].classList.add('touched'); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var general = form.querySelector('.gd-form-error');
      general.textContent = '';
      if (form.elements.company_fax.value) { window.location.href = '/thank-you'; return; }   // honeypot: pretend success
      var first = null;
      ['name', 'email', 'phone', 'website'].forEach(function (n) { if (checkField(form, n) && !first) first = form.elements[n]; });
      if (first) { first.focus(); return; }
      var btn = form.querySelector('[type="submit"]');
      btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Sending…';
      window.gdSubmitLead(form, form.dataset.formType).catch(function (ex) {
        general.textContent = ex.message;
        btn.disabled = false; btn.textContent = btn.dataset.label;
      });
    });
  }

  window.gdForm = {
    create: function (host, o) {
      host.innerHTML = formHTML(o);
      var form = host.querySelector('form');
      wireForm(form);
      return form;
    },
    mount: function () {
      document.querySelectorAll('[data-gd-form]').forEach(function (host) {
        if (host.querySelector('form')) return;
        window.gdForm.create(host, {
          type: host.dataset.formType || 'form', service: host.dataset.service || '',
          submit: host.dataset.submit || '', theme: host.dataset.theme || ''
        });
      });
    }
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

  // Smooth sliding is set here, not in CSS: scroll-behavior:smooth + scroll-snap on the track makes Chrome report no LCP.
  function smooth() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'; }

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
        dot.addEventListener('click', function () { track.scrollTo({ left: i * step(), behavior: smooth() }); });
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

      if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: smooth() }); });
      if (next) next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: smooth() }); });
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
      '<span class="pill">\u21aa Free Marketing Plan</span>' +
      '<h2 class="title" id="gdModalTitle">Get Your <strong>Free Marketing Plan</strong></h2>' +
      '<p>Tell us where to send it. A senior strategist replies within one business day.</p>' +
      '<div class="gd-modal-form"></div></div>';
    document.body.appendChild(modal);

    var form = window.gdForm.create(modal.querySelector('.gd-modal-form'), { type: 'popup', submit: 'Send My Plan Request' });
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
  }

  // ---- Floating contact buttons ------------------------------------------
  // Fill these in; an empty value hides that button.
  //   whatsapp: number with country code, digits only, e.g. '919876543210'
  //   telegram: username without @, e.g. 'gd_marketers'
  //   phone:    number with country code, digits only, e.g. '919876543210'
  var CONTACT = { whatsapp: '919123563756', telegram: '', phone: '919123563756' };

  function initFloatingContact() {
    var c = window.GD_CONTACT || CONTACT;
    var items = [];
    if (c.whatsapp) items.push({
      key: 'whatsapp', label: 'Chat on WhatsApp',
      href: 'https://wa.me/' + c.whatsapp.replace(/\D/g, '') + '?text=' + encodeURIComponent('Hi GD Digital Marketing, I would like to know more about your services.'),
      icon: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.95L2 22l5.2-1.5A9.9 9.9 0 1 0 12.04 2zm0 1.8a8.1 8.1 0 1 1-4.3 14.96l-.3-.2-3.1.9.9-3-.2-.3A8.1 8.1 0 0 1 12.04 3.8zm-3.2 4.1c-.2 0-.5.1-.7.4-.3.3-1 1-1 2.4s1 2.8 1.200 3c.1.2 2 3.1 4.900 4.300 2.400 1 2.900.8 3.400.7.600-.1 1.700-.7 1.900-1.400.2-.7.2-1.200.2-1.400-.1-.1-.3-.2-.7-.4l-1.700-.8c-.2-.1-.4-.1-.6.100l-.8 1c-.1.200-.3.200-.6.100-.9-.4-1.800-1-2.600-2-.2-.3-.7-.9-.9-1.400-.1-.2 0-.4.100-.5l.4-.5.3-.4v-.4l-.8-1.900c-.2-.5-.4-.5-.6-.5z"/></svg>'
    });
    if (c.telegram) items.push({
      key: 'telegram', label: 'Message on Telegram',
      href: 'https://t.me/' + c.telegram.replace(/^@/, ''),
      icon: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M21.9 4.1 18.7 19.6c-.2 1.100-.9 1.400-1.800.9l-4.900-3.600-2.400 2.300c-.3.300-.5.500-1 .5l.3-5 9.100-8.200c.4-.3-.1-.5-.6-.2L6.200 13l-4.800-1.500c-1-.3-1.100-1 .2-1.500l18.800-7.300c.9-.3 1.600.2 1.300 1.400z"/></svg>'
    });
    if (c.phone) items.push({
      key: 'call', label: 'Call us',
      href: 'tel:+' + c.phone.replace(/\D/g, ''),
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>'
    });
    if (!items.length) return;

    var box = document.createElement('div');
    box.className = 'gd-float';
    box.setAttribute('role', 'complementary');
    box.setAttribute('aria-label', 'Contact us');
    box.innerHTML = items.map(function (i) {
      var external = i.key !== 'call';
      return '<a class="gd-float-' + i.key + '" href="' + i.href + '" aria-label="' + i.label + '" title="' + i.label + '"' +
        (external ? ' target="_blank" rel="noopener noreferrer"' : '') + ' data-contact="' + i.key + '">' + i.icon + '</a>';
    }).join('');
    document.body.appendChild(box);

    box.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-contact]');
      if (a && typeof window.gtag === 'function') window.gtag('event', 'contact_click', { method: a.dataset.contact, page_path: location.pathname });
    });
  }

  async function init() {
    // Reveal first so content never waits on the header/footer fetch.
    initReveal();
    initSliders();
    window.gdForm.mount();

    await Promise.all([
      injectFragment('header', '/header.html?v=20261030'),
      injectFragment('footer', '/footer.html?v=20261030')
    ]);

    initNavigation();
    initPlanBuilder();
    initIndustriesSlider();
    initStaticButtons();
    initPopup();
    initFloatingContact();
  }

  init();
})();
