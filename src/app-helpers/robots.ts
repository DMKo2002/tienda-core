// Wrapper con default export — ver nota en sitemap.ts.
import { buildRobots } from '../lib/seo'

export default function robots() {
  return buildRobots()
}
