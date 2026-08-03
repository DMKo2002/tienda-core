// Wrapper con default export — Next.js exige que app/sitemap.ts exporte por
// default la función generadora. La lógica real vive en ../lib/seo.ts para
// poder reusarla (junto con robots.ts) sin duplicar código.
import { buildSitemap } from '../lib/seo'

export default async function sitemap() {
  return buildSitemap()
}
