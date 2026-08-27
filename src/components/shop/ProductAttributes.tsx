// Atributos adicionales de una variante (ej: "Contenido neto", "Sabor",
// "Marca") — configurados por el tenant en Panel Admin > Catálogo y cargados
// por variante desde el editor de producto.
//
// Se guardan en variants.attributes (JSONB) y hasta ahora no se mostraban en
// ninguna tienda: el dato quedaba en la base sin que el cliente final lo
// viera. Este componente es el que los renderiza, y lo hace para la variante
// que el cliente tiene seleccionada — dos variantes del mismo producto pueden
// tener valores distintos (ramen suelto 120 g vs pack x5 600 g).
//
// Se excluyen las claves internas de talle/color: son la identidad de la
// variante (ya se ven en los selectores de arriba), no atributos informativos.
const SIZE_KEYS = ['talle', 'numero', 'talla', 'size']

export interface AttrConfig {
  key: string
  label: string
  type?: 'text' | 'select' | 'color'
  options?: string[]
}

interface Props {
  // Atributos de la variante seleccionada (variants.attributes).
  attributes?: Record<string, any> | null
  // Config del tenant (store_config.variant_attributes) — de acá sale la
  // etiqueta linda ("Contenido neto") para cada key ("contenido_neto"). Si
  // una key no está en la config (por ej. quedó de un atributo ya borrado en
  // Catálogo), se muestra la key tal cual como fallback.
  attrConfig?: AttrConfig[]
}

export default function ProductAttributes({ attributes, attrConfig = [] }: Props) {
  if (!attributes) return null

  const labelByKey: Record<string, string> = {}
  for (const a of attrConfig) labelByKey[a.key] = a.label

  // Un atributo vacío no se muestra (queda como si no existiera para esa
  // variante) — es lo que permite que dos variantes del mismo producto
  // muestren fichas distintas sin dejar filas en blanco.
  const entries = Object.entries(attributes).filter(
    ([key, value]) => key !== 'color' && !SIZE_KEYS.includes(key) && value != null && String(value).trim() !== ''
  )

  if (entries.length === 0) return null

  // Orden estable: primero los atributos en el orden que el tenant los
  // configuró, después cualquier sobrante que no esté en la config.
  const order = new Map(attrConfig.map((a, i) => [a.key, i]))
  entries.sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999))

  return (
    <dl className="border-t border-[var(--color-border)] pt-4 space-y-1.5">
      {entries.map(([key, value]) => (
        <div key={key} className="flex justify-between gap-4 text-sm">
          <dt className="text-[var(--color-stone)] font-light">{labelByKey[key] ?? key}</dt>
          <dd className="text-[var(--color-charcoal)] font-light text-right">{String(value)}</dd>
        </div>
      ))}
    </dl>
  )
}
