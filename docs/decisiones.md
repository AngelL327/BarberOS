# Decisiones de implementación

- Se transforma la aplicación Vite/React existente en lugar de crear un
  monorepo nuevo: se conservan el stack y la conexión Supabase ya configurada.
- La selección de funciones se presenta como cuadrícula de módulos en el inicio,
  no como un menú lateral, para priorizar una navegación visual y adaptable.
- El primer usuario que se registra crea una barbería y queda como propietario
  mediante un trigger de Supabase Auth. La membresía se usa para filtrar todas
  las consultas bajo RLS.
- El esquema previo de marketplace se conserva para no borrar datos de Supabase.
  BarberOS utiliza tablas separadas y no depende de datos de demostración.
- Los precios de servicios y productos usados en una venta se leen desde el
  catálogo en el servidor. Un RPC guarda el cobro, el detalle, la comisión y la
  disminución de inventario en una sola transacción.
- Las citas guardan precio, duración y nombres aplicados como copia del momento
  de la reserva. Una restricción de exclusión impide solapamientos del mismo
  barbero.
- La configuración regional se fija en Honduras (HNL y America/Tegucigalpa);
  las fechas se almacenan como `timestamptz` en Supabase.
