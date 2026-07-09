# Setup tienda-core en GitHub

## 1. Crear el repo en GitHub

1. Ir a https://github.com/new
2. Nombre: `tienda-core`
3. Visibilidad: **Public** (o Private si preferís)
4. No agregar README ni .gitignore (ya los tenemos)
5. Crear el repo


## ⚠️ Tailwind CSS — paso obligatorio

En el  de cada template, agregar el path de tienda-core al :

```ts
content: [
  './src/**/*.{js,ts,jsx,tsx,mdx}',
  './node_modules/@creart/tienda-core/src/**/*.{js,ts,jsx,tsx}',
],
```

Sin esto, las clases Tailwind de los componentes de tienda-core no se incluyen en el CSS y los componentes no se renderizan visualmente.

## 2. Inicializar git en tienda-core y pushear

Desde la terminal, dentro de `C:\Plataforma CreArt\tienda-core`:

```bash
git init
git add .
git commit -m "feat: initial tienda-core package"
git branch -M main
git remote add origin https://github.com/DMKo2002/tienda-core.git
git push -u origin main
```

## 3. Instalar tienda-core en tienda-frontend

Dentro de `C:\Plataforma CreArt\tienda-frontend`:

```bash
npm install github:DMKo2002/tienda-core
```

Esto actualiza `package.json` y `package-lock.json`. Commitear y pushear:

```bash
git add package.json package-lock.json
git commit -m "feat: use @creart/tienda-core shared package"
git push
```

Vercel auto-deploya. El primer build instala tienda-core desde GitHub.

## 4. Migrar los demás templates (tienda-mono, tienda-atelier, tienda-axis)

Para cada template, repetir los mismos cambios que se hicieron en tienda-frontend:

### next.config.js — agregar transpilePackages:
```js
const nextConfig = {
  transpilePackages: ['@creart/tienda-core'],
  // ... resto de la config
}
```

### tsconfig.json — agregar preserveSymlinks (solo para dev local):
```json
"preserveSymlinks": true,
```

### package.json — agregar dependencia:
```json
"@creart/tienda-core": "github:DMKo2002/tienda-core",
```

### Reemplazar archivos con re-exports (ver lista completa abajo):

```
src/middleware.ts
src/lib/supabase-server.ts
src/lib/supabase.ts
src/lib/email.ts
src/lib/ratelimit.ts
src/components/shop/ProductCard.tsx
src/components/shop/AddToCartButton.tsx
src/components/shop/CartContext.tsx
src/components/shop/CatalogFilters.tsx
src/components/shop/MobileFilterDrawer.tsx
src/components/shop/ProductGallery.tsx
src/components/cuenta/LogoutButton.tsx
src/components/layout/CookieBanner.tsx
src/app/api/auth/registro/route.ts
src/app/api/checkout/crear-pedido/route.ts
src/app/api/nav-categories/route.ts
src/app/api/mp/crear-preferencia/route.ts
src/app/auth/callback/route.ts
```

Contenido de cada archivo (copiar textualmente):

```ts
// middleware.ts
export { middleware, config } from '@creart/tienda-core/middleware'

// lib/supabase-server.ts
export * from '@creart/tienda-core/supabase-server'

// lib/supabase.ts
export * from '@creart/tienda-core/supabase'

// lib/email.ts
export * from '@creart/tienda-core/email'

// lib/ratelimit.ts
export * from '@creart/tienda-core/ratelimit'

// components/shop/ProductCard.tsx
export { default } from '@creart/tienda-core/ProductCard'

// components/shop/AddToCartButton.tsx
export { default } from '@creart/tienda-core/AddToCartButton'

// components/shop/CartContext.tsx
export * from '@creart/tienda-core/CartContext'

// components/shop/CatalogFilters.tsx
export { default } from '@creart/tienda-core/CatalogFilters'

// components/shop/MobileFilterDrawer.tsx
export { default } from '@creart/tienda-core/MobileFilterDrawer'

// components/shop/ProductGallery.tsx
export { default } from '@creart/tienda-core/ProductGallery'

// components/cuenta/LogoutButton.tsx
export { default } from '@creart/tienda-core/LogoutButton'

// components/layout/CookieBanner.tsx
export { default } from '@creart/tienda-core/CookieBanner'

// app/api/auth/registro/route.ts
export { POST } from '@creart/tienda-core/api/registro'

// app/api/checkout/crear-pedido/route.ts
export { POST } from '@creart/tienda-core/api/crear-pedido'

// app/api/nav-categories/route.ts
export { GET } from '@creart/tienda-core/api/nav-categories'

// app/api/mp/crear-preferencia/route.ts
export { POST } from '@creart/tienda-core/api/mp-preferencia'

// app/auth/callback/route.ts
export { GET } from '@creart/tienda-core/api/auth-callback'
```

## 5. Flujo de trabajo post-setup

### Cuando cambias lógica (ProductCard, API routes, etc.):

```bash
# 1. Editás los archivos en tienda-core/
# 2. Commitear y pushear tienda-core
cd tienda-core
git add .
git commit -m "fix: descripción del cambio"
git push

# 3. Propagar a todos los templates de una vez:
cd ..
./update-core.sh
```

Vercel detecta el push en cada template y deploya automáticamente.

### Cuando personalizás un template (ej: cambiar el ProductCard de tienda-atelier):

Simplemente reemplazá el re-export con la implementación propia:

```tsx
// tienda-atelier/src/components/shop/ProductCard.tsx
// (implementación propia — ya no usa tienda-core)
'use client'
export default function ProductCard({ ... }) {
  // tu diseño custom
}
```

Ese template deja de recibir actualizaciones de ProductCard desde el core,
pero sigue recibiendo actualizaciones de todo lo demás.
