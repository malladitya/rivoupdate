/**
 * Loads the shared header and footer components.
 */
document.addEventListener('DOMContentLoaded', () => {
    loadComponent('components/header.html', 'site-header-placeholder', initHeader);
    loadComponent('components/footer.html', 'site-footer-placeholder', initFooter);
    initTheme();
});

function loadComponent(url, placeholderId, callback) {
    const placeholder = document.getElementById(placeholderId);
    if (!placeholder) return;

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`Failed to load ${url}`);
            return response.text();
        })
        .then(html => {
            placeholder.innerHTML = html;
            if (callback) callback();
        })
        .catch(error => console.error(error));
}

function initHeader() {
    // Mobile nav toggle logic from script.js
    const navToggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('primary-nav');

    if (navToggle && nav) {
        navToggle.addEventListener('click', () => {
            const expanded = nav.getAttribute('aria-expanded') === 'true';
            nav.setAttribute('aria-expanded', String(!expanded));
            navToggle.setAttribute('aria-expanded', String(!expanded));
        });

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                nav.setAttribute('aria-expanded', 'false');
                navToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }
}

function initFooter() {
    // Update year
    const yearSpan = document.getElementById('year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
}

function initTheme() {
    // Don't initialize here for rivo.html - it has its own handler
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    
    // Skip if on rivo.html page (it handles its own toggle)
    if (window.location.pathname.includes('rivo')) return;
    
    // Skip if already initialized
    if (toggle.dataset.themeInitialized) return;
    toggle.dataset.themeInitialized = 'true';

    const setTheme = (isDark) => {
        if (isDark) {
            document.documentElement.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
        }
    };

    // Initial check (consistent with head-level flash-prevention script)
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark-mode');
    }

    const handleThemeToggle = (e) => {
        if (e) e.preventDefault();
        const isDark = document.documentElement.classList.contains('dark-mode');
        setTheme(!isDark);
    };

    toggle.addEventListener('click', handleThemeToggle);
    // Add touch support for faster mobile response
    toggle.addEventListener('touchend', (e) => {
        handleThemeToggle(e);
        // Prevent double trigger (click follow-through)
        if (e.cancelable) e.preventDefault();
    }, { passive: false });
}

// Global accessibility helpers
document.addEventListener('DOMContentLoaded', () => {
    const skipLink = document.querySelector('.skip-link');
    if (skipLink) {
        skipLink.addEventListener('click', (e) => {
            const targetId = skipLink.getAttribute('href');
            if (targetId && targetId.startsWith('#')) {
                const target = document.querySelector(targetId);
                if (target) {
                    target.setAttribute('tabindex', '-1');
                    target.focus();
                }
            }
        });
    }
});
