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

      const lines = [
        'Name: ' + name.value.trim(),
        'Email: ' + email.value.trim(),
        'Website: ' + (form.elements.website.value.trim() || 'Not provided'),
        'Industry: ' + (form.elements.industry.value || 'Not specified'),
        'Budget: ' + (form.elements.budget.value || 'Not specified'),
        'Goals: ' + (checked('goals').join(', ') || 'Not specified'),
        'Challenges: ' + (checked('challenges').join(', ') || 'Not specified')
      ];

      window.location.href = 'mailto:hello@gdmarketing.example.com'
        + '?subject=' + encodeURIComponent('Marketing plan request')
        + '&body=' + encodeURIComponent(lines.join('\n'));
      summary.textContent = 'Thanks! Your email app should open with your answers ready to send.';
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
        // and always allow in-page section links such as "#marketing-plan"
        const href = a.getAttribute('href') || '';
        if (a.dataset.allowNavigate === 'true' || /^\/?#.+/.test(href)) return;
        e.preventDefault();
        a.setAttribute('role', 'button');
      }
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
  }

  init();
})();
