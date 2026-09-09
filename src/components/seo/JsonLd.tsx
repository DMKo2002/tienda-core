// Wrapper mínimo para renderizar datos estructurados (Schema.org) como
// <script type="application/ld+json">. Ver builders en ../../lib/seo.ts
// (buildProductJsonLd, buildOrganizationJsonLd).
export default function JsonLd({ data }: { data: Record<string, any> | null | undefined }) {
  if (!data) return null
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
