'use strict';
/**
 * Ierahkwa Platform — Shared Interactivity
 * v3.5.0 — Vanilla JS, zero dependencies
 * Progressive enhancement: each init checks for required DOM elements
 */

/* ============================================
   1. SEARCH & FILTER (Portal Central)
   ============================================ */
function initSearch() {
  var searchInput = document.querySelector('[data-search]');
  var filterBtns = document.querySelectorAll('[data-filter]');
  var cards = document.querySelectorAll('[data-name]');
  var countEl = document.querySelector('[data-results-count]');
  if (!searchInput || !cards.length) return;

  var activeFilter = 'all';

  function filterCards() {
    var query = searchInput.value.toLowerCase().trim();
    var visible = 0;
    cards.forEach(function(card) {
      var name = (card.dataset.name || '').toLowerCase();
      var nexus = card.dataset.nexus || '';
      var matchesSearch = !query || name.indexOf(query) !== -1;
      var matchesFilter = activeFilter === 'all' || nexus === activeFilter;
      var show = matchesSearch && matchesFilter;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    if (countEl) countEl.textContent = visible + ' plataformas';
  }

  searchInput.addEventListener('input', filterCards);

  filterBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      filterBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      filterCards();
    });
  });
}

/* ============================================
   2. SMOOTH SCROLL
   ============================================ */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      var href = anchor.getAttribute('href');
      if (href === '#') return;
      var target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.focus({ preventScroll: true });
      }
    });
  });
}

/* ============================================
   3. COUNTER ANIMATION (Count-up on scroll)
   ============================================ */
function initCounters() {
  var counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  // Respect reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    counters.forEach(function(el) { el.textContent = el.dataset.count; });
    return;
  }

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  counters.forEach(function(el) { observer.observe(el); });

  function animateCount(el) {
    var target = el.dataset.count;
    var numMatch = target.match(/^([\d,.]+)/);
    if (!numMatch) { el.textContent = target; return; }

    var suffix = target.replace(/^[\d,.]+/, '');
    var finalNum = parseFloat(numMatch[1].replace(/,/g, ''));
    var duration = 1500;
    var start = performance.now();

    function step(now) {
      var progress = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.floor(finalNum * eased);
      el.textContent = current.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    requestAnimationFrame(step);
  }
}

/* ============================================
   4. THEME TOGGLE (Optional dark/light)
   ============================================ */
function initThemeToggle() {
  var toggle = document.querySelector('[data-theme-toggle]');
  if (!toggle) return;

  var saved = localStorage.getItem('ierahkwa-theme');
  if (saved === 'light') document.documentElement.classList.add('light-theme');

  toggle.addEventListener('click', function() {
    document.documentElement.classList.toggle('light-theme');
    var isLight = document.documentElement.classList.contains('light-theme');
    localStorage.setItem('ierahkwa-theme', isLight ? 'light' : 'dark');
    toggle.setAttribute('aria-pressed', String(isLight));
  });
}

/* ============================================
   5. NAVIGATION ACTIVE STATES
   ============================================ */
function initNavActive() {
  var links = document.querySelectorAll('nav a[href^="#"]');
  if (!links.length) return;

  var sections = [];
  links.forEach(function(a) {
    var id = a.getAttribute('href').slice(1);
    var section = document.getElementById(id);
    if (section) sections.push({ link: a, section: section });
  });

  if (!sections.length) return;

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      var match = sections.find(function(s) { return s.section === entry.target; });
      if (match) {
        if (entry.isIntersecting) match.link.classList.add('active');
        else match.link.classList.remove('active');
      }
    });
  }, { threshold: 0.3 });

  sections.forEach(function(s) { observer.observe(s.section); });
}

/* ============================================
   6. CARD HOVER INTERACTIONS
   ============================================ */
function initCardInteractions() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if ('ontouchstart' in window) return;

  document.querySelectorAll('.card').forEach(function(card) {
    card.addEventListener('mousemove', function(e) {
      var rect = card.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width - 0.5) * 6;
      var y = ((e.clientY - rect.top) / rect.height - 0.5) * -6;
      card.style.transform = 'translateY(-2px) perspective(500px) rotateX(' + y + 'deg) rotateY(' + x + 'deg)';
    });
    card.addEventListener('mouseleave', function() {
      card.style.transform = '';
    });
  });
}

/* ============================================
   INIT — Run on DOMContentLoaded
   ============================================ */
document.addEventListener('DOMContentLoaded', function() {
  initSearch();
  initSmoothScroll();
  initCounters();
  initThemeToggle();
  initNavActive();
  initCardInteractions();
});
