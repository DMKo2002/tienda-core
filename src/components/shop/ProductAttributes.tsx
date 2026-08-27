// Atributos adicionales del producto (ej: "Contenido neto", "Material",
// "Origen") — configurados por el tenant en Panel Admin > Catálogo y
// cargados por producto al editarlo. Se guardan en variants.attributes
// (JSONB) pero, hasta ahora, nunca se mostraban en ninguna tienda: el dato
// quedaba guardado en la base sin que el cliente final lo viera en ningún
// lado de la ficha de producto. Este componente es el primer lugar que los
// renderiza.
//
// Se excluyen las claves internas de talle/color (usadas para matchear la
// variante seleccionada con AddToCartButton, no son "atributos extra" desde
// el punto de vista del tenant).
const SIZE_KEYS = ['talle', 'numero', 'talla', 'size']

export interface AttrConfig {
  key: string
  label: string
  type?: 'text' | 'select' | 'color'
  options?: string[]
}

interface Props {
  // Atributos guardados en la variante (normalmente la primera/priceada del
  // producto — hoy son iguales para todas las variantes de un mismo
  // producto, ver productos/[id]/page.tsx en Panel Admin).
  attributes?: Record<string, string> | null
  // Config del tenant (store_config.variant_attributes) — de acá sale la
  // etiqueta linda ("Contenido neto") para cada key ("contenido_neto"). Si
  // una key no está en la config (por ej. quedó de un atributo ya borrado
  // en Mi Tienda), se muestra la key tal cual como fallback.
  attrConfig?: AttrConfig[]
}

export default function ProductAttributes({ attributes, attrConfig = [] }: Props) {
  if (!attributes) return null

  const labelByKey: Record<string, string> = {}
  for (const a of attrConfig) labelByKey[a.key] = a.label

  const entries = Object.entries(attributes).filter(
    ([key, value]) => key !== 'color' && !SIZE_KEYS.includes(key) && value != null && String(value).trim() !== ''
  )

  if (entries.length === 0) return null

  return (
    <div className="border-t border-[var(--color-border)] pt-6 mt-2">
      <p className="text-xs tracking-[0.15em] uppercase text-[var(--color-stone)] mb-3">
        Detalles del producto
      </p>
      <dl className="space-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between gap-4 text-sm">
            <dt className="text-[var(--color-stone)] font-light">{labelByKey[key] ?? key}</dt>
            <dd className="text-[var(--color-charcoal)] font-light text-right">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
