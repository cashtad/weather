const paths = {
  weather: '<circle cx="9" cy="9" r="4"/><path d="M9 1v1m0 14v1M1 9h1m14 0h1M3.3 3.3l.7.7m10 10 .7.7M3.3 14.7l.7-.7M14 4l.7-.7"/><path d="M8 21a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.5 1 3.5 3.5 0 0 1-.5 7Z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  heart: '<path d="M12 20s-7.5-4.5-8.5-9.5C2.5 5 9 3.5 12 8c3-4.5 9.5-3 8.5 2.5C19.5 15.5 12 20 12 20Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16m-12 4h2m4 0h2"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
};

// These SVG fragments and names are static application assets, never API or user input.
export function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}
