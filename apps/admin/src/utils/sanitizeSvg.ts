import DOMPurify from 'dompurify';

export function sanitizeSvgMarkup(svg: string): string {
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
}
