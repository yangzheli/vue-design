const emptyTag = ['area', 'base', 'basefont', 'br', 'col', 'frame', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'embed', 'command', 'keygen', 'source', 'track', 'wbr']

const htmlTag = [
    'html', 'body', 'base', 'head', 'link', 'meta', 'style', 'title',
    'address', 'article', 'aside', 'footer', 'header', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hgroup', 'nav', 'section',
    'div', 'dd', 'dl', 'dt', 'figcaption', 'figure', 'picture', 'hr', 'img', 'li', 'main', 'ol', 'p', 'pre', 'ul',
    'a', 'b', 'abbr', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd', 'mark', 'q', 'rp', 'rt', 'rtc', 'ruby',
    's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'area', 'audio', 'map', 'track', 'video',
    'embed', 'object', 'param', 'source', 'canvas', 'script', 'noscript', 'del', 'ins',
    'caption', 'col', 'colgroup', 'table', 'thead', 'tbody', 'td', 'th', 'tr',
    'button', 'datalist', 'fieldset', 'form', 'input', 'label', 'legend', 'meter', 'optgroup', 'option',
    'output', 'progress', 'select', 'textarea',
    'details', 'dialog', 'menu', 'menuitem', 'summary',
    'content', 'element', 'shadow', 'template', 'blockquote', 'iframe', 'tfoot'
]

export function isEmptyTag(tag) {
    return emptyTag.indexOf(tag) != -1 
}

export function isHTMLTag(tag) {
    return htmlTag.indexOf(tag) != -1
}

export function isUndef(s) {
    return s === undefined
}

export function isDef(s) {
    return s !== undefined
}

export function concat(a, b) {
    return a ? b ? (a + ' ' + b) : a : (b || '')
}