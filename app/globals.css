@import url('https://cdnjs.cloudflare.com/ajax/libs/tabler-icons/2.47.0/tabler-icons.min.css');

@tailwind base;
@tailwind components;
@tailwind utilities;

@keyframes ticker-scroll {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

@keyframes live-pulse {
  0% {
    transform: scale(0.55);
    opacity: 0.7;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

.animate-ticker {
  animation: ticker-scroll 46s linear infinite;
}

.animate-ticker:hover {
  animation-play-state: paused;
}

.animate-live-pulse {
  animation: live-pulse 2.2s ease-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .animate-ticker,
  .animate-live-pulse {
    animation: none;
  }
}

/* Warnmarkierung (DIN 14502) als echtes Absperrband-Element -- bewusst nur
   an den ganz wenigen dramatischen "Leitstelle"-Momenten eingesetzt, nicht
   flächendeckend. */
.hazard-stripe-amber {
  background: repeating-linear-gradient(-45deg, #08090b 0 16px, #e8a93d 16px 32px);
}

.hazard-stripe-signal {
  background: repeating-linear-gradient(-45deg, #08090b 0 16px, #c81e2c 16px 32px);
}

/* Weicher Lichtschein hinter der großen Headline in den dunklen Bereichen --
   verleiht Tiefe, ohne dass es nach Neon-Effekt aussieht. */
.void-glow::before {
  content: '';
  position: absolute;
  inset: -20% -10% auto -10%;
  height: 70%;
  background: radial-gradient(ellipse at top, rgba(232, 169, 61, 0.16), transparent 70%);
  pointer-events: none;
}

.prose-article p {
  margin-bottom: 0.9em;
}

.prose-article h2 {
  font-family: var(--font-barlow), sans-serif;
  font-weight: 700;
  font-size: 21px;
  margin: 1.3em 0 0.5em;
}

.prose-article ul {
  list-style: disc;
  padding-left: 1.25em;
  margin-bottom: 0.9em;
}

.prose-article a {
  color: #8e1420;
  text-decoration: underline;
}

.prose-article:empty::before {
  content: attr(data-placeholder);
  color: #93969b;
}
