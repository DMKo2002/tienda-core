// Wrapper con default export — ver nota en sitemap.ts.
import { buildRobots } from '../lib/seo'

export default async function robots() {
  return buildRobots()
}
