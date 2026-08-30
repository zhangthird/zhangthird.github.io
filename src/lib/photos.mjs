/** Validate gallery entries before publishing and sort dated photos newest first. */
export function preparePhotos(entries) {
  if (!Array.isArray(entries)) throw new Error('Photos must be an array.');
  const ids = new Set();
  return entries.map(photo => {
    if (!photo || typeof photo.id !== 'string' || !/^[a-z0-9-]+$/.test(photo.id) || ids.has(photo.id)) {
      throw new Error('Each photo needs a unique lowercase id.');
    }
    ids.add(photo.id);
    if (typeof photo.src !== 'string' || !/^\/photos\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp|avif)$/i.test(photo.src)) {
      throw new Error(`Photo ${photo.id}: use an image under /photos/ with a simple filename.`);
    }
    if (typeof photo.alt !== 'string' || !photo.alt.trim()) throw new Error(`Photo ${photo.id}: alt text is required.`);
    if (![photo.width, photo.height].every(value => Number.isInteger(value) && value > 0)) {
      throw new Error(`Photo ${photo.id}: positive image dimensions are required.`);
    }
    if (photo.caption !== undefined && typeof photo.caption !== 'string') throw new Error(`Photo ${photo.id}: caption must be text.`);
    if (photo.date !== undefined && (typeof photo.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(photo.date) || Number.isNaN(Date.parse(photo.date)) || new Date(photo.date).toISOString().slice(0,10) !== photo.date)) {
      throw new Error(`Photo ${photo.id}: use a valid YYYY-MM-DD date.`);
    }
    return { ...photo };
  }).sort((a,b) => (b.date || '').localeCompare(a.date || ''));
}
