import sanitizeHtml from 'sanitize-html';

const SVG_TAGS = [
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'defs', 'clipPath', 'mask', 'use', 'symbol', 'linearGradient',
  'radialGradient', 'stop', 'title', 'desc', 'pattern', 'filter',
  'feGaussianBlur', 'feOffset', 'feMerge', 'feMergeNode', 'feColorMatrix',
  'feBlend', 'feComposite', 'feFlood', 'feImage',
];

const SVG_ATTRIBUTES = [
  'id', 'class', 'style', 'transform', 'viewBox', 'width', 'height', 'x', 'y',
  'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill',
  'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap',
  'stroke-linejoin', 'stroke-dasharray', 'stroke-opacity', 'opacity',
  'clip-path', 'clip-rule', 'mask', 'filter', 'gradientUnits', 'gradientTransform',
  'offset', 'stop-color', 'stop-opacity', 'preserveAspectRatio', 'xmlns',
  'xmlns:xlink', 'xlink:href', 'href', 'font-family', 'font-size', 'font-weight',
  'text-anchor',
];

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: SVG_TAGS,
  allowedAttributes: { '*': SVG_ATTRIBUTES },
  allowedSchemes: ['data', 'http', 'https'],
  allowVulnerableTags: false,
  disallowedTagsMode: 'discard',
  parser: { lowerCaseAttributeNames: false },
};

export function sanitizeSvg(svg: string): string {
  return sanitizeHtml(svg, sanitizeOptions);
}
