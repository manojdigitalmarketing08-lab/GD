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
    const planGroups = document.querySelectorAll('.plan-chips');
    const planSummary = document.getElementById('planSummary');
    const planCta = document.getElementById('planCta');

    if (!planGroups.length || !planSummary) return;

    const selections = { services: [], goal: '', budget: '' };

    function updateSummary() {
      const parts = [];
      if (selections.services.length) parts.push(selections.services.join(' + '));
      if (selections.goal) parts.push('Goal: ' + selections.goal);
      if (selections.budget) parts.push('Budget: ' + selections.budget);

      planSummary.textContent = parts.length
        ? 'Your plan: ' + parts.join(' · ')
        : 'Make a selection above to build your plan.';

      if (!planCta) return;
      const subject = encodeURIComponent('Custom plan request');
      const bodyLines = [
        'Services: ' + (selections.services.join(', ') || 'Not specified'),
        'Goal: ' + (selections.goal || 'Not specified'),
        'Budget: ' + (selections.budget || 'Not specified')
      ];
      const body = encodeURIComponent(bodyLines.join('\n'));

      planCta.setAttribute(
        'href',
        selections.services.length || selections.goal || selections.budget
          ? 'mailto:hello@gdmarketing.example.com?subject=' + subject + '&body=' + body
          : '#contact'
      );
    }

    planGroups.forEach(function (group) {
      const key = group.getAttribute('data-group');
      const isMulti = group.getAttribute('data-multi') === 'true';
      const chips = group.querySelectorAll('.plan-chip');

      chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          const value = chip.getAttribute('data-value');
          if (!value) return;

          if (isMulti) {
            const idx = selections[key].indexOf(value);
            if (idx > -1) {
              selections[key].splice(idx, 1);
              chip.classList.remove('is-selected');
              chip.setAttribute('aria-pressed', 'false');
            } else {
              selections[key].push(value);
              chip.classList.add('is-selected');
              chip.setAttribute('aria-pressed', 'true');
            }
          } else {
            chips.forEach(function (c) {
              c.classList.remove('is-selected');
              c.setAttribute('aria-pressed', 'false');
            });
            chip.classList.add('is-selected');
            chip.setAttribute('aria-pressed', 'true');
            selections[key] = value;
          }

          updateSummary();
        });
      });
    });
  }

  function initStaticButtons() {
    // Prevent default navigation for anchor elements styled as buttons across pages
    document.addEventListener('click', function (e) {
      const a = e.target.closest('a');
      if (!a) return;

      // treat anchors with these classes as UI buttons (static)
      const buttonLike = a.classList.contains('btn') || a.classList.contains('card-link') || a.classList.contains('header-cta') || a.id === 'planCta';

      if (buttonLike) {
        // allow explicit opt-out by adding data-allow-navigate="true"
        if (a.dataset.allowNavigate === 'true') return;
        e.preventDefault();
        a.setAttribute('role', 'button');
      }
    });
  }

  async function init() {
    await Promise.all([
      injectFragment('header', '/header.html'),
      injectFragment('footer', '/footer.html')
    ]);

    initNavigation();
    initPlanBuilder();
    initStaticButtons();
  }

  init();
})();