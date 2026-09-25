# tienda-core — Guía para Claude

Ver `C:\Plataforma CreArt\SQL\CLAUDE.md` para la guía general de la plataforma (arquitectura, reglas de Supabase, deploy). Para arquitectura de features/incidentes/decisiones de producto, el vault de Obsidian en `C:\Plataforma CreArt\Gounuri Obsidian` (`Index.md`) es la referencia más completa y actualizada. `tienda-core` es el paquete compartido (`@creart/tienda-core`) del que dependen todos los templates de tienda (`tienda-mono`, `tienda-atelier`, etc.), pineado a un commit exacto en cada uno.

## ⚠ Antes de arrancar una migración de tenant, leer esto primero

`C:\Plataforma CreArt\MIGRATION_PLAYBOOK.md` — estándar de migración de Gounuri, escrito a raíz del incidente de My Queen Trend (210 fotos de producto rotas al cortar el DNS porque se migraron las rutas a WordPress y no los archivos). No es contexto opcional: si estás iniciando o revisando una migración de catálogo (fotos, precios, stock, variantes, categorías) para cualquier tenant, leelo entero antes de tocar la base — trae la regla general, el estándar por tipo de dato (sección 05) y el gate de 5 chequeos que tiene que dar en cero/completo antes de cortar el DNS del sistema viejo (sección 06). Si algún punto no aplica al caso puntual, decilo explícitamente en vez de asumir que no aplica.
