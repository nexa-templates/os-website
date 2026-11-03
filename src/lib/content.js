export const sample = {
  name: 'Northline Studio', tagline: 'Architecture for a considered life.', theme: 'dark', email: 'hello@northline.example',
  pages: [
    { id: 'home', slug: '', title: 'Home', eyebrow: 'Independent architecture & interiors', headline: 'Spaces for what comes next.', summary: 'Thoughtful buildings. Quiet interiors. A closer connection to the places we call home.', body: '## A good space changes how you feel.\n\nWe begin with the people who will use a place. Then we bring light, natural materials, and a clear purpose together — creating spaces that feel effortless, every day.\n\nFrom a first sketch to the smallest detail, we make room for what matters.' },
    { id: 'work', slug: 'work', title: 'Work', eyebrow: 'Selected concept studies · 2026', headline: 'A sense of place.', summary: 'Homes and spaces shaped by their surroundings. A few ideas from our studio.', body: '## The Courtyard House\n\nA quiet retreat organized around a sheltered garden. Warm timber, generous daylight, and spaces that open to the landscape.\n\n## The Everyday Studio\n\nAn adaptable place to gather, focus, and make things. A small footprint with room for new possibilities.\n\n*These are fictional concept projects, included to help you try the template.*' },
    { id: 'about', slug: 'about', title: 'Studio', eyebrow: 'Small studio. Shared curiosity.', headline: 'Good things start with a conversation.', summary: 'We believe the best work happens when people, place, and purpose are understood together.', body: '## How we work\n\n1. **Listen.** Understand your everyday life, ambitions, and constraints.\n2. **Explore.** Turn the brief into a clear direction, with sketches and considered options.\n3. **Refine.** Bring the idea into focus through materials, light, and detail.\n\n## Rooted in simplicity\n\nLess noise. More intention. We look for lasting choices that make everyday life better.' },
    { id: 'contact', slug: 'contact', title: 'Contact', eyebrow: 'Let’s make something meaningful', headline: 'Tell us what you have in mind.', summary: 'A new space, a fresh perspective, or an early idea. Every project starts somewhere.', body: '## A place to begin\n\nTell us a little about your project, its location, and what you hope to achieve. Your message goes to the website owner’s private enquiry inbox.' },
  ],
};

const text = (value, max, required = false) => typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
export function validateDocument(value) {
  if (!value || !text(value.name, 80, true) || !text(value.tagline, 160) || !['dark', 'light'].includes(value.theme) || !text(value.email, 200) || (value.email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.email))) throw new Error('Check the website name, theme, and email address.');
  if (!Array.isArray(value.pages) || value.pages.length < 2 || value.pages.length > 12) throw new Error('Keep between 2 and 12 pages.');
  const slugs = new Set(), ids = new Set();
  const pages = value.pages.map(page => {
    if (!page || !text(page.id, 40, true) || !/^[a-z0-9-]+$/.test(page.id) || !text(page.slug, 48) || (page.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug)) || ['api', 'editor', 'preview', 'demo', 's', 'health'].includes(page.slug) || slugs.has(page.slug) || ids.has(page.id)) throw new Error('Each page needs a unique, non-reserved URL using lowercase letters, numbers, and hyphens.');
    if (!text(page.title, 60, true) || !text(page.eyebrow, 120) || !text(page.headline, 160, true) || !text(page.summary, 500) || !text(page.body, 20000)) throw new Error('Check page fields; page content must be under 20,000 characters.');
    slugs.add(page.slug); ids.add(page.id);
    return Object.fromEntries(['id', 'slug', 'title', 'eyebrow', 'headline', 'summary', 'body'].map(key => [key, page[key]]));
  });
  if (pages[0].id !== 'home' || pages[0].slug !== '' || !pages.some(page => page.id === 'contact' && page.slug === 'contact')) throw new Error('Keep the home page first and retain the contact page.');
  const doc = { name: value.name.trim(), tagline: value.tagline, theme: value.theme, email: value.email, pages };
  if (new TextEncoder().encode(JSON.stringify(doc)).length > 100000) throw new Error('Website content must be smaller than 100 KB.');
  return doc;
}
