import DOMPurify from 'isomorphic-dompurify';

// 許可するタグ
const ALLOWED_TAGS = [
  'h1','h2','h3','h4','h5','h6','p','br','hr',
  'ul','ol','li','dl','dt','dd',
  'strong','em','b','i','u','s','del','ins','mark','small','sub','sup',
  'a','img','figure','figcaption','picture','source',
  'table','thead','tbody','tfoot','tr','th','td','caption','colgroup','col',
  'blockquote','pre','code','kbd','samp','var',
  'div','span','section','article','aside','header','footer','nav','main',
  'details','summary','time','abbr','cite','dfn','ruby','rt','rp',
];

// 許可する属性
const ALLOWED_ATTR = [
  'href','src','alt','title','width','height','loading','decoding',
  'class','id','style','target','rel','aria-label','aria-hidden','role',
  'colspan','rowspan','scope','headers',
  'datetime','cite','open','lang','dir',
  'srcset','sizes','media','type',
  'data-asp','data-program-id',
];

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_ATTR: ['target'],
  });
}

// ASPバナー用（より制限的）
export function sanitizeBannerHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['a','img','span','div','p','br','strong','em'],
    ALLOWED_ATTR: ['href','src','alt','title','width','height','target','rel','class','style'],
    ALLOW_DATA_ATTR: false,
  });
}
