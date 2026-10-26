import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, ArrowDownRight, BadgeDollarSign, BarChart3, CalendarDays,
  Check, CircleDollarSign, Clock3, CreditCard, LayoutGrid, LogOut, Package,
  Plus, Scissors, Search, Settings2, ShieldCheck, ShoppingBag, Sparkles, Users, Wallet, X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import {
  closeCashSession, createRecord, createSale, getSession, getShop, getWorkspace,
  isSupabaseConfigured, openCashSession, saveShop, signIn, signOut, signUp,
  updateAppointment,
  type Appointment, type CashSession, type Expense, type Product, type Sale,
  type Service, type Shop, type StaffMember, type WorkspaceData,
} from "../lib/barberos";

type ModuleId =
  | "overview" | "appointments" | "pos" | "cash" | "clients" | "services"
  | "inventory" | "team" | "expenses" | "commissions" | "settings";

const AUTHENTICATION_REQUIRED = false;

const modules: { id: ModuleId; label: string; description: string; icon: typeof CalendarDays; color: string }[] = [
  { id: "appointments", label: "Agenda", description: "Citas, horarios y estados", icon: CalendarDays, color: "amber" },
  { id: "pos", label: "Punto de venta", description: "Cobrar servicios", icon: CreditCard, color: "green" },
  { id: "cash", label: "Caja", description: "Apertura y cierre", icon: Wallet, color: "blue" },
  { id: "clients", label: "Clientes", description: "Directorio y visitas", icon: Users, color: "violet" },
  { id: "services", label: "Servicios", description: "Precios y duración", icon: Scissors, color: "rose" },
  { id: "inventory", label: "Inventario", description: "Productos y stock", icon: Package, color: "orange" },
  { id: "team", label: "Equipo", description: "Barberos y comisiones", icon: ShieldCheck, color: "teal" },
  { id: "expenses", label: "Gastos", description: "Egresos registrados", icon: ArrowDownRight, color: "red" },
  { id: "commissions", label: "Comisiones", description: "Detalle por barbero", icon: BadgeDollarSign, color: "indigo" },
  { id: "settings", label: "Configuración", description: "Datos del negocio", icon: Settings2, color: "slate" },
];

const emptyWorkspace: WorkspaceData = {
  appointments: [], services: [], products: [], clients: [], staff: [], expenses: [], sales: [], cashSessions: [],
};

function getPreviewWorkspace(): WorkspaceData {
  const now = new Date();
  const appointmentTime = new Date(now);
  appointmentTime.setHours(Math.min(17, appointmentTime.getHours() + 1), 0, 0, 0);
  const createdAt = now.toISOString();
  return {
    appointments: [
      { id: "preview-appointment-1", customer_name: "Carlos Martínez", customer_phone: "9999-1234", service_name: "Corte clásico", barber_name: "Diego López", starts_at: appointmentTime.toISOString(), price: 250, status: "CONFIRMED" },
      { id: "preview-appointment-2", customer_name: "Andrés Flores", customer_phone: "9888-5678", service_name: "Corte + barba", barber_name: "Miguel Reyes", starts_at: new Date(appointmentTime.getTime() + 60 * 60 * 1000).toISOString(), price: 380, status: "PENDING" },
    ],
    services: [
      { id: "preview-service-1", name: "Corte clásico", category: "Corte", duration_minutes: 30, price: 250, active: true },
      { id: "preview-service-2", name: "Corte + barba", category: "Paquete", duration_minutes: 50, price: 380, active: true },
      { id: "preview-service-3", name: "Perfilado de barba", category: "Barba", duration_minutes: 20, price: 180, active: true },
    ],
    products: [
      { id: "preview-product-1", name: "Pomada mate", category: "Cuidado capilar", price: 220, stock: 8, active: true },
      { id: "preview-product-2", name: "Aceite para barba", category: "Cuidado de barba", price: 190, stock: 3, active: true },
    ],
    clients: [
      { id: "preview-client-1", name: "Carlos Martínez", phone: "9999-1234", email: "carlos@example.com", visits: 8, created_at: createdAt },
      { id: "preview-client-2", name: "Andrés Flores", phone: "9888-5678", email: null, visits: 3, created_at: createdAt },
    ],
    staff: [
      { id: "preview-staff-1", name: "Diego López", phone: "9777-1010", commission_rate: 40, active: true },
      { id: "preview-staff-2", name: "Miguel Reyes", phone: "9666-2020", commission_rate: 35, active: true },
    ],
    expenses: [],
    sales: [
      { id: "preview-sale-1", description: "Corte clásico", item_name: "Corte clásico", appointment_id: null, quantity: 1, total: 250, payment_method: "cash", barber_name: "Diego López", commission_amount: 100, created_at: createdAt },
      { id: "preview-sale-2", description: "Pomada mate", item_name: "Pomada mate", appointment_id: null, quantity: 1, total: 220, payment_method: "card", barber_name: "Miguel Reyes", commission_amount: 77, created_at: createdAt },
    ],
    cashSessions: [],
  };
}

const previewShop: Shop = {
  id: "preview-shop",
  name: "La Navaja Barbería",
  slug: "la-navaja",
  city: "San Pedro Sula",
  phone: null,
  plan: "INICIAL",
  subscription_status: "VISTA PREVIA",
};

const money = (value: number) => new Intl.NumberFormat("es-HN", {
  style: "currency", currency: "HNL", maximumFractionDigits: 0,
}).format(Number(value) || 0);

const dateKey = (date: string | Date) => new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Tegucigalpa",
}).format(new Date(date));
const today = () => dateKey(new Date());
const dateLabel = (date: string) => new Date(date).toLocaleDateString("es-HN", {
  day: "2-digit", month: "short", timeZone: "America/Tegucigalpa",
});
const timeLabel = (date: string) => new Date(date).toLocaleTimeString("es-HN", {
  hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Tegucigalpa",
});

type Field = { key: string; label: string; type?: string; placeholder?: string; required?: boolean; options?: string[] };
type ModuleConfig = {
  title: string;
  description: string;
  table: "barber_appointments" | "barber_services" | "barber_products" | "barber_clients" | "barber_staff" | "barber_expenses";
  fields: Field[];
  rows: (data: WorkspaceData) => Record<string, string | number>[];
  columns: { key: string; label: string }[];
};

const pageConfigs: Partial<Record<ModuleId, ModuleConfig>> = {
  appointments: {
    title: "Agenda", description: "Citas, horarios y estados.",
    table: "barber_appointments",
    fields: [
      { key: "customer_name", label: "Nombre del cliente", required: true },
      { key: "customer_phone", label: "Teléfono", placeholder: "9999-0000", required: true },
      { key: "service_name", label: "Servicio", placeholder: "Corte clásico", required: true },
      { key: "barber_name", label: "Barbero", placeholder: "Nombre del barbero", required: true },
      { key: "starts_at", label: "Fecha y hora", type: "datetime-local", required: true },
      { key: "price", label: "Precio (L)", type: "number", required: true },
    ],
    rows: (data) => data.appointments.map((a) => ({
      id: a.id, date: `${dateLabel(a.starts_at)} · ${timeLabel(a.starts_at)}`,
      customer: a.customer_name, service: a.service_name, barber: a.barber_name,
      amount: money(a.price), status: a.status,
    })),
    columns: [{ key: "date", label: "Fecha y hora" }, { key: "customer", label: "Cliente" }, { key: "service", label: "Servicio" }, { key: "barber", label: "Barbero" }, { key: "amount", label: "Total" }, { key: "status", label: "Estado" }],
  },
  services: {
    title: "Servicios", description: "Administra tu menú, tarifas y duración.",
    table: "barber_services",
    fields: [
      { key: "name", label: "Nombre del servicio", required: true },
      { key: "category", label: "Categoría", placeholder: "Corte, barba, cuidado" },
      { key: "duration_minutes", label: "Duración (minutos)", type: "number", required: true },
      { key: "price", label: "Precio (L)", type: "number", required: true },
    ],
    rows: (data) => data.services.map((s) => ({ id: s.id, name: s.name, category: s.category, duration: `${s.duration_minutes} min`, price: money(s.price), status: s.active ? "Activo" : "Inactivo" })),
    columns: [{ key: "name", label: "Servicio" }, { key: "category", label: "Categoría" }, { key: "duration", label: "Duración" }, { key: "price", label: "Precio" }, { key: "status", label: "Estado" }],
  },
  inventory: {
    title: "Inventario", description: "Controla productos, precios y existencias.",
    table: "barber_products",
    fields: [
      { key: "name", label: "Nombre del producto", required: true },
      { key: "category", label: "Categoría", placeholder: "Cuidado capilar, accesorios" },
      { key: "price", label: "Precio (L)", type: "number", required: true },
      { key: "stock", label: "Existencias", type: "number", required: true },
    ],
    rows: (data) => data.products.map((p) => ({ id: p.id, name: p.name, category: p.category, price: money(p.price), stock: `${p.stock} unidades`, status: p.stock <= 3 ? "Por agotarse" : "Disponible" })),
    columns: [{ key: "name", label: "Producto" }, { key: "category", label: "Categoría" }, { key: "price", label: "Precio" }, { key: "stock", label: "Existencias" }, { key: "status", label: "Estado" }],
  },
  clients: {
    title: "Clientes", description: "Directorio e historial de visitas.",
    table: "barber_clients",
    fields: [
      { key: "name", label: "Nombre completo", required: true },
      { key: "phone", label: "Teléfono", placeholder: "9999-0000", required: true },
      { key: "email", label: "Correo electrónico", type: "email" },
    ],
    rows: (data) => data.clients.map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email ?? "—", visits: `${c.visits} visitas`, joined: dateLabel(c.created_at) })),
    columns: [{ key: "name", label: "Cliente" }, { key: "phone", label: "Teléfono" }, { key: "email", label: "Correo" }, { key: "visits", label: "Visitas" }, { key: "joined", label: "Desde" }],
  },
  team: {
    title: "Equipo", description: "Gestiona barberos y su porcentaje de comisión.",
    table: "barber_staff",
    fields: [
      { key: "name", label: "Nombre del barbero", required: true },
      { key: "phone", label: "Teléfono", placeholder: "9999-0000" },
      { key: "commission_rate", label: "Comisión (%)", type: "number", required: true },
    ],
    rows: (data) => data.staff.map((s) => ({ id: s.id, name: s.name, phone: s.phone ?? "—", commission: `${s.commission_rate}%`, status: s.active ? "Activo" : "Inactivo" })),
    columns: [{ key: "name", label: "Barbero" }, { key: "phone", label: "Teléfono" }, { key: "commission", label: "Comisión" }, { key: "status", label: "Estado" }],
  },
  expenses: {
    title: "Gastos", description: "Registra las salidas para conocer tu rentabilidad.",
    table: "barber_expenses",
    fields: [
      { key: "description", label: "Descripción", placeholder: "Compra de insumos", required: true },
      { key: "category", label: "Categoría", placeholder: "Insumos, servicios, alquiler" },
      { key: "amount", label: "Monto (L)", type: "number", required: true },
      { key: "payment_method", label: "Método de pago", type: "select", options: ["cash", "card", "transfer"] },
    ],
    rows: (data) => data.expenses.map((e) => ({ id: e.id, description: e.description, category: e.category, amount: money(e.amount), method: paymentLabel(e.payment_method), date: dateLabel(e.created_at) })),
    columns: [{ key: "description", label: "Descripción" }, { key: "category", label: "Categoría" }, { key: "amount", label: "Monto" }, { key: "method", label: "Pago" }, { key: "date", label: "Fecha" }],
  },
};

function paymentLabel(value: string) {
  return ({ cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia" } as Record<string, string>)[value] ?? value;
}

function statusLabel(value: string) {
  return ({ PENDING: "Pendiente", CONFIRMED: "Confirmada", COMPLETED: "Completada", CANCELLED: "Cancelada", NO_SHOW: "No asistió" } as Record<string, string>)[value] ?? value;
}

export default function App() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceData>(emptyWorkspace);
  const [preview, setPreview] = useState(false);
  const [module, setModule] = useState<ModuleId>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<"login" | "register" | "create" | "sale" | "cash" | null>(null);
  const [authError, setAuthError] = useState("");
  const [search, setSearch] = useState("");

  const refresh = useCallback(async (businessId: string) => {
    setWorkspace(await getWorkspace(businessId));
  }, []);

  const loadAccount = useCallback(async () => {
    if (!isSupabaseConfigured) {
      if (AUTHENTICATION_REQUIRED) {
        setLoading(false);
        return;
      }
      setPreview(true);
      setShop(previewShop);
      setWorkspace(getPreviewWorkspace());
      setLoading(false);
      return;
    }
    try {
      const session = await getSession();
      if (!session?.user) {
        if (AUTHENTICATION_REQUIRED) {
          setLoading(false);
          return;
        }
        setPreview(true);
        setShop(previewShop);
        setWorkspace(getPreviewWorkspace());
        setLoading(false);
        return;
      }
      setPreview(false);
      setUser({ id: session.user.id, email: session.user.email });
      const currentShop = await getShop(session.user.id);
      setShop(currentShop);
      await refresh(currentShop.id);
    } catch (error) {
      setUser(null);
      setPreview(true);
      setShop(previewShop);
      setWorkspace(getPreviewWorkspace());
      setAuthError(error instanceof Error ? error.message : "No se pudo cargar la barbería.");
      toast.error("No se pudo cargar tu barbería", { description: error instanceof Error ? error.message : "Intenta de nuevo." });
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  const reload = async () => {
    if (shop) await refresh(shop.id);
  };

  const currentModule = modules.find((item) => item.id === module);
  const todayAppointments = useMemo(
    () => workspace.appointments.filter((appointment) => dateKey(appointment.starts_at) === today() && appointment.status !== "CANCELLED"),
    [workspace.appointments],
  );
  const todaySales = workspace.sales.filter((sale) => dateKey(sale.created_at) === today());
  const todayRevenue = todaySales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const monthRevenue = workspace.sales
    .filter((sale) => dateKey(sale.created_at).slice(0, 7) === today().slice(0, 7))
    .reduce((sum, sale) => sum + Number(sale.total), 0);
  const activeCash = workspace.cashSessions.find((session) => !session.closed_at);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setAuthError("");
    const form = new FormData(event.currentTarget);
    try {
      if (modal === "register") {
        await signUp(String(form.get("email")), String(form.get("password")), String(form.get("shop")), String(form.get("city")));
        toast.success("Cuenta creada", { description: "Revisa tu correo si Supabase solicita confirmar la cuenta." });
      } else {
        await signIn(String(form.get("email")), String(form.get("password")));
        setLoading(true);
        await loadAccount();
      }
      setModal(null);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "No se pudo completar la solicitud.");
    } finally {
      setSaving(false);
    }
  };

  const submitRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (preview) return;
    if (!shop || !pageConfigs[module]) return;
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const values: Record<string, string | number | boolean | null> = {};
    for (const [key, raw] of form.entries()) {
      const field = pageConfigs[module]!.fields.find((item) => item.key === key);
      values[key] = field?.type === "number"
        ? Number(raw)
        : key === "starts_at"
          ? new Date(`${String(raw)}:00-06:00`).toISOString()
          : String(raw);
      if (!String(raw).trim() && (key === "email" || key === "phone")) values[key] = null;
    }
    if (module === "services" || module === "inventory" || module === "team") values.active = true;
    if (module === "clients") values.visits = 0;
    try {
      await createRecord(pageConfigs[module]!.table, shop.id, values);
      await reload();
      setModal(null);
      toast.success("Registro guardado correctamente.");
    } catch (error) {
      toast.error("No se pudo guardar", { description: error instanceof Error ? error.message : "Revisa los datos e inténtalo de nuevo." });
    } finally {
      setSaving(false);
    }
  };

  const submitSale = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (preview) return;
    if (!shop) return;
    const form = new FormData(event.currentTarget);
    const selectedBarber = workspace.staff.find((member) => member.id === String(form.get("barber_id")));
    setSaving(true);
    try {
      await createSale(shop.id, {
        item_type: form.get("item_type") === "product" ? "product" : "service",
        item_id: String(form.get("item_id")),
        quantity: Number(form.get("quantity")),
        discount: Number(form.get("discount") || 0),
        tip: Number(form.get("tip") || 0),
        payment_method: String(form.get("payment_method")),
        commission_rate: selectedBarber?.commission_rate ?? 0,
        barber_name: selectedBarber?.name ?? "",
        appointment_id: String(form.get("appointment_id")) || null,
      });
      await reload();
      setModal(null);
      toast.success("Venta registrada", { description: "La comisión quedó calculada y guardada." });
    } catch (error) {
      toast.error("No se pudo registrar la venta", { description: error instanceof Error ? error.message : "Inténtalo de nuevo." });
    } finally {
      setSaving(false);
    }
  };

  const submitCash = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (preview) return;
    if (!shop) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      if (activeCash) await closeCashSession(activeCash.id, Number(form.get("counted_cash")));
      else await openCashSession(shop.id, Number(form.get("opening_cash")));
      await reload();
      setModal(null);
      toast.success(activeCash ? "Caja cerrada correctamente." : "Caja abierta correctamente.");
    } catch (error) {
      toast.error("No se pudo actualizar la caja", { description: error instanceof Error ? error.message : "Inténtalo de nuevo." });
    } finally {
      setSaving(false);
    }
  };

  const updateShop = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (preview) return;
    if (!shop) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await saveShop(shop.id, { name: String(form.get("name")), city: String(form.get("city")), phone: String(form.get("phone")) || null });
      setShop({ ...shop, name: String(form.get("name")), city: String(form.get("city")), phone: String(form.get("phone")) || null });
      toast.success("Configuración actualizada.");
    } catch (error) {
      toast.error("No se pudo guardar la configuración", { description: error instanceof Error ? error.message : "Inténtalo de nuevo." });
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (appointment: Appointment, status: Appointment["status"]) => {
    if (preview) return;
    try {
      await updateAppointment(appointment.id, status);
      await reload();
      toast.success(`Cita ${statusLabel(status).toLowerCase()}.`);
    } catch (error) {
      toast.error("No se pudo actualizar la cita", { description: error instanceof Error ? error.message : "Inténtalo de nuevo." });
    }
  };

  const doSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      if (AUTHENTICATION_REQUIRED) {
        setShop(null);
        setWorkspace(emptyWorkspace);
        setPreview(false);
      } else {
        setShop(previewShop);
        setWorkspace(getPreviewWorkspace());
        setPreview(true);
      }
      setModule("overview");
    } catch (error) {
      toast.error("No se pudo cerrar sesión", { description: error instanceof Error ? error.message : "Inténtalo de nuevo." });
    }
  };

  if (loading) return <div className="loading-screen"><div className="brand-mark"><Scissors size={22} /></div><span>Preparando tu barbería...</span></div>;
  if (!shop && !isSupabaseConfigured) return <SetupScreen />;
  if (!shop) return (
    <AuthScreen
      modal={modal === "register" ? "register" : "login"}
      onChange={(value) => { setModal(value); setAuthError(""); }}
      onSubmit={submitAuth}
      error={authError}
      loading={saving}
    />
  );

  return (
    <div className="app-shell">
      <Toaster position="top-right" richColors closeButton />
      <header className="topbar">
        <button className="brand-button" onClick={() => setModule("overview")} aria-label="Ir al inicio">
          <span className="brand-mark"><Scissors size={20} /></span>
          <span className="brand-name">barber<span>OS</span></span>
        </button>
        <div className="topbar-right">
          <span className="shop-chip"><span className="live-dot" /> {shop.name}</span>
          {preview
            ? <span className="user-button preview-user"><span className="user-avatar">V</span><span className="user-email">Vista previa</span></span>
            : <button className="user-button" onClick={doSignOut} title="Cerrar sesión"><span className="user-avatar">{(user?.email?.[0] ?? "B").toUpperCase()}</span><span className="user-email">{user?.email}</span><LogOut size={15} /></button>}
        </div>
      </header>
      <main className="main-content">
        {preview && <div className="preview-banner"><span><Sparkles size={16} /><strong>Modo vista previa</strong><span>Explora los módulos con datos de ejemplo. Los cambios no se guardarán.</span></span><span className="preview-badge">DEMO</span></div>}
        {module === "overview" ? (
          <Dashboard
            shop={shop}
            appointments={todayAppointments}
            revenue={todayRevenue}
            monthRevenue={monthRevenue}
            clients={workspace.clients.length}
            team={workspace.staff.filter((member) => member.active).length}
            services={workspace.services.length}
            products={workspace.products.length}
            onSelect={setModule}
            onNewAppointment={() => { if (!preview) { setModule("appointments"); setModal("create"); } }}
            preview={preview}
          />
        ) : (
          <section className="module-view">
            <div className="module-heading">
              <button className="back-link" onClick={() => setModule("overview")}><LayoutGrid size={16} /> Todos los módulos</button>
              <div className="module-title-row">
                <div>
                  <div className="eyebrow">{shop.name} <span>/</span> Gestión</div>
                  <h1>{currentModule?.label}</h1>
                  <p>{pageConfigs[module]?.description ?? moduleDescription(module)}</p>
                </div>
                {!preview && (module === "appointments" || pageConfigs[module]) ? (
                  <button className="button button-dark" onClick={() => setModal("create")}><Plus size={17} /> Nuevo registro</button>
                ) : null}
                {!preview && module === "pos" && <button className="button button-dark" onClick={() => setModal("sale")}><Plus size={17} /> Nueva venta</button>}
                {!preview && module === "cash" && <button className="button button-dark" onClick={() => setModal("cash")}><Plus size={17} /> {activeCash ? "Cerrar caja" : "Abrir caja"}</button>}
              </div>
            </div>
            {pageConfigs[module] && (
              <RecordTable
                columns={pageConfigs[module]!.columns}
                rows={pageConfigs[module]!.rows(workspace).filter((row) =>
                  Object.values(row).some((value) => String(value).toLowerCase().includes(search.toLowerCase()))
                )}
                search={search}
                onSearch={setSearch}
                appointments={module === "appointments" ? workspace.appointments : undefined}
                readOnly={preview}
                onStatus={changeStatus}
              />
            )}
            {module === "pos" && <SalesView sales={workspace.sales} />}
            {module === "cash" && <CashView session={activeCash} recent={workspace.cashSessions[0]} sales={workspace.sales} expenses={workspace.expenses} />}
            {module === "commissions" && <CommissionView sales={workspace.sales} staff={workspace.staff} />}
            {module === "settings" && <SettingsView shop={shop} onSubmit={updateShop} saving={saving} readOnly={preview} />}
          </section>
        )}
      </main>
      <footer className="footer"><span>BARBEROS · GESTIÓN</span><span>Honduras · Lempiras (HNL)</span></footer>
      {modal && modal !== "login" && modal !== "register" && (
        <Modal title={modalTitle(modal, module)} onClose={() => setModal(null)}>
          {modal === "create" && pageConfigs[module] && (
            <RecordForm fields={pageConfigs[module]!.fields} onSubmit={submitRecord} onCancel={() => setModal(null)} saving={saving} />
          )}
          {modal === "sale" && <SaleForm staff={workspace.staff} services={workspace.services} products={workspace.products} appointments={workspace.appointments} onSubmit={submitSale} saving={saving} />}
          {modal === "cash" && <CashForm session={activeCash} onSubmit={submitCash} saving={saving} />}
        </Modal>
      )}
    </div>
  );
}

function moduleDescription(id: ModuleId) {
  const descriptions: Partial<Record<ModuleId, string>> = {
    pos: "Ventas y cobros registrados.",
    cash: "Aperturas, cierres y arqueos.",
    commissions: "Comisiones calculadas por venta.",
    settings: "Datos de la barbería.",
  };
  return descriptions[id] ?? "";
}

function Dashboard(props: {
  shop: Shop; appointments: Appointment[]; revenue: number; monthRevenue: number; clients: number; team: number;
  services: number; products: number; onSelect: (module: ModuleId) => void; onNewAppointment: () => void; preview: boolean;
}) {
  return (
    <div className="dashboard">
      <section className="welcome-row">
        <div>
          <div className="eyebrow"><span className="live-dot" /> {props.shop.name}</div>
          <h1>Resumen</h1>
          <p>{new Date().toLocaleDateString("es-HN", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Tegucigalpa" })}</p>
        </div>
        <button className="button button-dark" onClick={props.onNewAppointment} disabled={props.preview}><Plus size={17} /> Agendar cita</button>
      </section>
      <section className="stats-grid">
        <StatCard label="Ingresos de hoy" value={money(props.revenue)} note="Ventas registradas" source={props.preview ? "Datos de ejemplo" : "En tiempo real"} icon={CircleDollarSign} color="green" />
        <StatCard label="Ingresos del mes" value={money(props.monthRevenue)} note="Acumulado mensual" source={props.preview ? "Datos de ejemplo" : "En tiempo real"} icon={BarChart3} color="blue" />
        <StatCard label="Citas de hoy" value={String(props.appointments.length)} note="En tu agenda" source={props.preview ? "Datos de ejemplo" : "En tiempo real"} icon={CalendarDays} color="amber" />
        <StatCard label="Clientes" value={String(props.clients)} note="En tu directorio" source={props.preview ? "Datos de ejemplo" : "En tiempo real"} icon={Users} color="violet" />
        <StatCard label="Equipo activo" value={String(props.team)} note="Barberos registrados" source={props.preview ? "Datos de ejemplo" : "En tiempo real"} icon={Activity} color="blue" />
      </section>
      <section className="dashboard-grid">
        <div className="module-section">
          <div className="section-heading">
            <div><div className="eyebrow">GESTIÓN</div><h2>Módulos</h2></div>
            <span className="section-caption">Operación de la barbería</span>
          </div>
          <div className="module-grid">
            {modules.map(({ id, label, description, icon: Icon, color }) => (
              <button className="module-card" key={id} onClick={() => props.onSelect(id)}>
                <span className={`module-icon ${color}`}><Icon size={19} strokeWidth={1.8} /></span>
                <span className="module-card-copy"><strong>{label}</strong><small>{description}</small></span>
                <span className="module-arrow">↗</span>
              </button>
            ))}
          </div>
        </div>
        <aside className="today-panel">
          <div className="section-heading compact">
            <div><div className="eyebrow">AGENDA</div><h2>Citas de hoy</h2></div>
            <span className="count-pill">{props.appointments.length}</span>
          </div>
          {props.appointments.length ? (
            <div className="today-list">
              {props.appointments.slice(0, 5).map((appointment) => (
                <div className="today-item" key={appointment.id}>
                  <span className="appointment-time">{timeLabel(appointment.starts_at)}</span>
                  <span className="appointment-marker" />
                  <span className="today-copy"><strong>{appointment.customer_name}</strong><small>{appointment.service_name} · {appointment.barber_name}</small></span>
                  <span className={`status-pill ${appointment.status.toLowerCase()}`}>{statusLabel(appointment.status)}</span>
                </div>
              ))}
              <button className="text-link" onClick={() => props.onSelect("appointments")}>Ver agenda completa <span>→</span></button>
            </div>
          ) : (
            <div className="empty-agenda">
              <div className="empty-icon"><CalendarDays size={21} /></div>
              <strong>Sin citas para hoy</strong>
              <button className="button button-outline" onClick={props.onNewAppointment} disabled={props.preview}><Plus size={15} /> Agendar cita</button>
            </div>
          )}
          <div className="quick-summary">
            <div className="summary-top"><Scissors size={15} /><span>BARBERÍA</span></div>
            <div className="summary-row"><span>Servicios</span><strong>{props.services}</strong></div>
            <div className="summary-row"><span>Productos</span><strong>{props.products}</strong></div>
            <div className="summary-row"><span>Ubicación</span><strong>{props.shop.city || "Honduras"}</strong></div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function StatCard({ label, value, note, source, icon: Icon, color }: { label: string; value: string; note: string; source: string; icon: typeof CalendarDays; color: string }) {
  return <div className="stat-card"><div className={`stat-icon ${color}`}><Icon size={18} /></div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-note">{note}</span><span className={`stat-trend ${color}`}>{source}</span></div>;
}

function RecordTable(props: {
  columns: { key: string; label: string }[]; rows: Record<string, string | number>[];
  search: string; onSearch: (value: string) => void; appointments?: Appointment[];
  readOnly: boolean;
  onStatus: (appointment: Appointment, status: Appointment["status"]) => void;
}) {
  const appointmentById = new Map(props.appointments?.map((appointment) => [appointment.id, appointment]));
  return (
    <div className="table-panel">
      <div className="table-toolbar"><div className="table-search"><Search size={17} /><input value={props.search} onChange={(event) => props.onSearch(event.target.value)} placeholder="Buscar en tus registros..." /></div><span>{props.rows.length} registros</span></div>
      {props.rows.length ? (
        <div className="table-scroll"><table><thead><tr>{props.columns.map((column) => <th key={column.key}>{column.label}</th>)}{props.appointments && !props.readOnly && <th>Acciones</th>}</tr></thead><tbody>
          {props.rows.map((row) => <tr key={String(row.id)}>{props.columns.map((column) => <td key={column.key}>{column.key === "status" ? <span className={`status-pill ${String(row[column.key]).toLowerCase()}`}>{statusLabel(String(row[column.key]))}</span> : row[column.key]}</td>)}
            {props.appointments && !props.readOnly && <td><AppointmentActions appointment={appointmentById.get(String(row.id))} onStatus={props.onStatus} /></td>}
          </tr>)}
        </tbody></table></div>
      ) : <EmptyState title="Todavía no hay registros" message="Agrega el primer registro para empezar a organizar tu operación." />}
    </div>
  );
}

function AppointmentActions({ appointment, onStatus }: { appointment?: Appointment; onStatus: (appointment: Appointment, status: Appointment["status"]) => void }) {
  if (!appointment || appointment.status === "CANCELLED" || appointment.status === "COMPLETED") return <span className="muted">—</span>;
  return <div className="row-actions">
    {appointment.status === "PENDING" && <button className="mini-action" onClick={() => onStatus(appointment, "CONFIRMED")} title="Confirmar"><Check size={14} /></button>}
    <button className="mini-action cancel" onClick={() => onStatus(appointment, "CANCELLED")} title="Cancelar"><X size={14} /></button>
  </div>;
}

function SalesView({ sales }: { sales: Sale[] }) {
  return <div className="table-panel"><div className="table-toolbar"><div><strong>Ventas registradas</strong><p>Los ingresos y comisiones provienen de cobros guardados.</p></div><span>{sales.length} ventas</span></div>
    {sales.length ? <div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Artículo</th><th>Barbero</th><th>Método</th><th>Comisión</th><th>Total</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td>{dateLabel(sale.created_at)} · {timeLabel(sale.created_at)}</td><td>{sale.item_name} × {sale.quantity}</td><td>{sale.barber_name || "—"}</td><td>{paymentLabel(sale.payment_method)}</td><td>{money(sale.commission_amount)}</td><td className="amount-cell">{money(sale.total)}</td></tr>)}</tbody></table></div> : <EmptyState title="Aún no hay ventas" message="Registra un cobro para empezar a ver tus ventas." />}</div>;
}

function CashView({ session, recent, sales, expenses }: { session?: CashSession; recent?: CashSession; sales: Sale[]; expenses: Expense[] }) {
  const viewedSession = session ?? recent;
  const from = viewedSession ? new Date(viewedSession.opened_at).getTime() : Date.now();
  const through = viewedSession?.closed_at ? new Date(viewedSession.closed_at).getTime() : Date.now();
  const isInSession = (date: string) => {
    const timestamp = new Date(date).getTime();
    return timestamp >= from && timestamp <= through;
  };
  const cashSales = sales.filter((sale) => sale.payment_method === "cash" && isInSession(sale.created_at))
    .reduce((sum, sale) => sum + Number(sale.total), 0);
  const cashExpenses = expenses.filter((expense) => expense.payment_method === "cash" && isInSession(expense.created_at))
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
  const expected = Number(viewedSession?.opening_cash ?? 0) + cashSales - cashExpenses;
  const difference = viewedSession?.counted_cash == null ? null : Number(viewedSession.counted_cash) - expected;
  return <div className="cash-layout"><div className="cash-status-card"><div className="cash-status-head"><span className={`cash-state ${session ? "open" : "closed"}`}><span /> Caja {session ? "abierta" : "cerrada"}</span><span>{viewedSession ? `${session ? "Desde" : "Turno"} ${timeLabel(viewedSession.opened_at)}` : "Sin turnos registrados"}</span></div><div className="cash-balance"><span>Saldo esperado</span><strong>{money(expected)}</strong><small>Fondo inicial + efectivo - gastos en efectivo</small></div><div className="cash-details"><div><span>Fondo inicial</span><strong>{money(Number(viewedSession?.opening_cash ?? 0))}</strong></div><div><span>Ventas en efectivo</span><strong>{money(cashSales)}</strong></div><div><span>Gastos en efectivo</span><strong>- {money(cashExpenses)}</strong></div>{viewedSession?.counted_cash != null && <><div><span>Efectivo contado</span><strong>{money(Number(viewedSession.counted_cash))}</strong></div><div><span>Diferencia de cierre</span><strong className={difference === 0 ? "cash-balanced" : "cash-difference"}>{money(difference ?? 0)}</strong></div></>}</div></div><div className="cash-info"><div className="info-icon"><Clock3 size={20} /></div><h3>Control de caja</h3><p>El saldo se calcula con el fondo inicial, las ventas y los gastos en efectivo del turno.</p><span className="info-note"><ShieldCheck size={15} /> El arqueo queda guardado en el historial.</span></div></div>;
}

function CommissionView({ sales, staff }: { sales: Sale[]; staff: StaffMember[] }) {
  const total = sales.reduce((sum, sale) => sum + Number(sale.commission_amount), 0);
  return <><div className="commission-summary"><div><span>Comisiones acumuladas</span><strong>{money(total)}</strong></div><div><span>Ventas con comisión</span><strong>{sales.length}</strong></div><div><span>Equipo activo</span><strong>{staff.filter((member) => member.active).length}</strong></div></div><div className="table-panel"><div className="table-toolbar"><div><strong>Detalle por venta</strong><p>La comisión se calcula al registrar cada venta.</p></div></div>{sales.length ? <div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Venta</th><th>Barbero</th><th>Comisión</th><th>Método</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td>{dateLabel(sale.created_at)}</td><td>{sale.item_name} × {sale.quantity}</td><td>{sale.barber_name || "—"}</td><td className="amount-cell">{money(sale.commission_amount)}</td><td>{paymentLabel(sale.payment_method)}</td></tr>)}</tbody></table></div> : <EmptyState title="Sin comisiones todavía" message="Las comisiones aparecerán automáticamente con las ventas." />}</div></>;
}

function SettingsView({ shop, onSubmit, saving, readOnly }: { shop: Shop; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean; readOnly: boolean }) {
  return <form className="settings-panel" onSubmit={onSubmit}><div className="settings-intro"><span className="settings-icon"><Settings2 size={20} /></span><div><h2>Datos del negocio</h2><p>Esta información identifica tu barbería en BarberOS.</p></div></div><label>Nombre de la barbería<input name="name" required defaultValue={shop.name} disabled={readOnly} /></label><label>Ciudad<input name="city" required defaultValue={shop.city} disabled={readOnly} /></label><label>Teléfono<input name="phone" defaultValue={shop.phone ?? ""} disabled={readOnly} /></label><div className="settings-public"><div><strong>Identificador de barbería</strong><span>Se asignó automáticamente al registrar tu cuenta.</span></div><code>/b/{shop.slug}</code></div><div className="settings-plan"><div><span>Plan actual</span><strong>{shop.plan}</strong></div><span className="plan-state">{shop.subscription_status}</span></div>{!readOnly && <button className="button button-dark" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button>}</form>;
}

function RecordForm({ fields, onSubmit, onCancel, saving }: { fields: Field[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; saving: boolean }) {
  return <form className="record-form" onSubmit={onSubmit}><div className="form-grid">{fields.map((field) => <label className={field.type === "datetime-local" ? "wide-field" : ""} key={field.key}>{field.label}{field.type === "select" ? <select name={field.key} required={field.required}>{field.options?.map((option) => <option value={option} key={option}>{paymentLabel(option)}</option>)}</select> : <input name={field.key} type={field.type ?? "text"} placeholder={field.placeholder} min={field.type === "number" ? "0" : undefined} step={field.key === "price" || field.key === "amount" ? "0.01" : undefined} required={field.required} />}</label>)}</div><div className="form-actions"><button type="button" className="button button-outline" onClick={onCancel}>Cancelar</button><button className="button button-dark" disabled={saving}>{saving ? "Guardando..." : "Guardar registro"}</button></div></form>;
}

function SaleForm({ staff, services, products, appointments, onSubmit, saving }: { staff: StaffMember[]; services: Service[]; products: Product[]; appointments: Appointment[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean }) {
  const [itemType, setItemType] = useState<"service" | "product">("service");
  const available = itemType === "service" ? services.filter((item) => item.active) : products.filter((item) => item.active && item.stock > 0);
  return <form className="record-form" onSubmit={onSubmit}><div className="form-grid"><label className="wide-field">Cita relacionada (opcional)<select name="appointment_id"><option value="">Venta sin cita</option>{appointments.filter((appointment) => ["PENDING","CONFIRMED"].includes(appointment.status)).map((appointment) => <option value={appointment.id} key={appointment.id}>{dateLabel(appointment.starts_at)} · {appointment.customer_name} · {appointment.service_name}</option>)}</select></label><label>Tipo de artículo<select name="item_type" value={itemType} onChange={(event) => setItemType(event.target.value === "product" ? "product" : "service")}><option value="service">Servicio</option><option value="product">Producto</option></select></label><label>Artículo<select name="item_id" required disabled={!available.length}>{available.map((item) => <option value={item.id} key={item.id}>{item.name} · {money(item.price)}{itemType === "product" ? ` · Stock ${"stock" in item ? item.stock : 0}` : ""}</option>)}</select></label><label>Cantidad<input name="quantity" type="number" min="1" defaultValue="1" required /></label><label>Descuento (L)<input name="discount" type="number" min="0" step="0.01" defaultValue="0" /></label><label>Propina (L)<input name="tip" type="number" min="0" step="0.01" defaultValue="0" /></label><label>Método de pago<select name="payment_method"><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="transfer">Transferencia</option></select></label><label className="wide-field">Barbero<select name="barber_id"><option value="">Sin asignar</option>{staff.filter((member) => member.active).map((member) => <option value={member.id} key={member.id}>{member.name} · {member.commission_rate}%</option>)}</select></label></div>{!available.length && <p className="form-hint">Agrega primero {itemType === "service" ? "un servicio" : "un producto con existencias"} al catálogo.</p>}{!staff.length && <p className="form-hint">Agrega barberos al equipo para asignar comisiones.</p>}<div className="form-actions"><button className="button button-dark" disabled={saving || !available.length}>{saving ? "Procesando..." : "Registrar cobro"}</button></div></form>;
}

function CashForm({ session, onSubmit, saving }: { session?: CashSession; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean }) {
  return <form className="record-form" onSubmit={onSubmit}><p className="modal-copy">{session ? "Cuenta el efectivo disponible. El saldo esperado se calcula con el fondo inicial, ventas y gastos en efectivo." : "Registra el fondo inicial disponible en caja para comenzar el turno."}</p><label>{session ? "Efectivo contado al cierre (L)" : "Fondo inicial (L)"}<input name={session ? "counted_cash" : "opening_cash"} type="number" min="0" step="0.01" required autoFocus /></label>{session && <div className="expected-note"><span>Saldo esperado</span><strong>{money(Number(session.opening_cash))}</strong></div>}<div className="form-actions"><button className="button button-dark" disabled={saving}>{saving ? "Guardando..." : session ? "Cerrar caja" : "Abrir caja"}</button></div></form>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const onCloseEvent = () => onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("close-modal", onCloseEvent);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("close-modal", onCloseEvent); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card"><div className="modal-heading"><div><span className="eyebrow">BARBEROS · GESTIÓN</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>{children}</section></div>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="empty-state"><span className="empty-icon"><ShoppingBag size={20} /></span><strong>{title}</strong><p>{message}</p></div>;
}

function AuthScreen({ modal, onChange, onSubmit, error, loading }: {
  modal: "login" | "register"; onChange: (mode: "login" | "register") => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; error: string; loading: boolean;
}) {
  const register = modal === "register";
  return <div className="auth-screen"><div className="auth-decoration" /><div className="auth-card"><div className="auth-brand"><span className="brand-mark"><Scissors size={22} /></span><span className="brand-name">barber<span>OS</span></span></div><div className="auth-heading"><span className="eyebrow">BARBEROS · GESTIÓN</span><h1>{register ? "Crear cuenta" : "Iniciar sesión"}</h1><p>{register ? "Registra tu barbería para configurar el espacio de trabajo." : "Accede al panel de gestión de tu barbería."}</p></div><form className="auth-form" onSubmit={onSubmit}>{register && <><label>Nombre de la barbería<input name="shop" placeholder="Ej. La Navaja" required /></label><label>Ciudad<input name="city" placeholder="San Pedro Sula" required /></label></>}<label>Correo electrónico<input name="email" type="email" placeholder="tu@barberia.hn" required /></label><label>Contraseña<input name="password" type="password" minLength={6} placeholder="Mínimo 6 caracteres" required /></label>{error && <p className="auth-error">{error}</p>}<button className="button button-dark auth-submit" disabled={loading}>{loading ? "Un momento..." : register ? "Crear mi barbería" : "Iniciar sesión"} <span>→</span></button></form><p className="auth-switch">{register ? "¿Ya tienes cuenta?" : "¿Primera vez en BarberOS?"}<button onClick={() => onChange(register ? "login" : "register")}>{register ? "Iniciar sesión" : "Crear cuenta"}</button></p><div className="auth-security"><ShieldCheck size={14} /> Conexión segura con Supabase</div></div></div>;
}

function SetupScreen() {
  return <div className="setup-screen"><div className="auth-card setup-card"><div className="auth-brand"><span className="brand-mark"><Scissors size={22} /></span><span className="brand-name">barber<span>OS</span></span></div><div className="auth-heading"><span className="eyebrow">CONFIGURACIÓN REQUERIDA</span><h1>Conexión a Supabase</h1><p>Agrega la URL y la clave pública del proyecto para iniciar.</p></div><div className="setup-steps"><div><span>01</span><p>Copia <code>.env.example</code> como <code>.env.local</code>.</p></div><div><span>02</span><p>Completa <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>.</p></div><div><span>03</span><p>Ejecuta <code>supabase/schema.sql</code> en el SQL Editor de Supabase.</p></div></div><p className="setup-note"><ShieldCheck size={15} /> Usa solo la clave publicable (anon). Nunca expongas la service_role.</p></div></div>;
}

function modalTitle(modal: "create" | "sale" | "cash", module: ModuleId) {
  if (modal === "sale") return "Registrar venta";
  if (modal === "cash") return module === "cash" ? "Movimiento de caja" : "Caja";
  return `Nueva ${module === "appointments" ? "cita" : "entrada"}`;
}
