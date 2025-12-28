// --- VISUAL ENHANCEMENTS (3D Tilt & Scroll Reveal) ---
// This file contains purely visual enhancements with NO external dependencies

console.log('visual-reveal.js loaded');

// 1. 3D Tilt Effect for Cards
const cards = document.querySelectorAll('.spotify-card');

cards.forEach(card => {
    // Add glare element dynamically if not exists
    if (!card.querySelector('.glare')) {
        const glare = document.createElement('div');
        glare.classList.add('glare');
        card.appendChild(glare);
    }

    const glare = card.querySelector('.glare');

    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -10;
        const rotateY = ((x - centerX) / centerX) * 10;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;

        if (glare) {
            glare.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 80%)`;
            glare.style.opacity = '1';
        }
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
        if (glare) {
            glare.style.opacity = '0';
        }
    });
});


// 2. Scroll Reveal Animation
const revealTargets = document.querySelectorAll('section, .spotify-card, .section-title, .gallery-item, .shop-item, .footer');
console.log('REVEAL: Found targets:', revealTargets.length);

const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.remove('pending');
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, {
    root: null,
    threshold: 0.01,
    rootMargin: "0px"
});

revealTargets.forEach(el => {
    el.classList.add('reveal');

    const rect = el.getBoundingClientRect();
    const inView = (rect.top < window.innerHeight);

    if (!inView && !el.closest('.hero')) {
        el.classList.add('pending');
        revealObserver.observe(el);
    } else {
        el.classList.add('visible');
    }
});

console.log('visual-reveal.js initialized');
