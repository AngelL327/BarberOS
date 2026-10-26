import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export type Shop = {
  id: string;
  name: string;
  slug: string;
  city: string;
  phone: string | null;
  plan: string;
  subscription_status: string;
};

export type Appointment = {
  id: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  barber_name: string;
  starts_at: string;
  price: number;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
};

export type Service = {
  id: string;
  name: string;
  category: string;
  duration_minutes: number;
  price: number;
  active: boolean;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  active: boolean;
};

export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  visits: number;
  created_at: string;
};

export type StaffMember = {
  id: string;
  name: string;
  phone: string | null;
  commission_rate: number;
  active: boolean;
};

export type Expense = {
  id: string;
  description: string;
  category: string;
  amount: number;
  payment_method: string;
  created_at: string;
};

export type Sale = {
  id: string;
  description: string;
  appointment_id: string | null;
  item_name: string;
  quantity: number;
  total: number;
  payment_method: string;
  barber_name: string;
  commission_amount: number;
  created_at: string;
};

export type CashSession = {
  id: string;
  opening_cash: number;
  counted_cash: number | null;
  opened_at: string;
  closed_at: string | null;
};

export type WorkspaceData = {
  appointments: Appointment[];
  services: Service[];
  products: Product[];
  clients: Client[];
  staff: StaffMember[];
  expenses: Expense[];
  sales: Sale[];
  cashSessions: CashSession[];
};

type TableName =
  | "barber_services"
  | "barber_products"
  | "barber_clients"
  | "barber_staff"
  | "barber_appointments"
  | "barber_expenses";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para conectar Supabase.");
  }
  return supabase;
}

export async function getSession() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email: string, password: string) {
  const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string, shopName: string, city: string) {
  const { error } = await requireSupabase().auth.signUp({
    email,
    password,
    options: { data: { shop_name: shopName, shop_city: city } },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}

export async function getShop(userId: string): Promise<Shop> {
  const { data, error } = await requireSupabase()
    .from("barber_memberships")
    .select("barber_shops(id,name,slug,city,phone,plan,subscription_status)")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  const shop = data.barber_shops;
  if (!shop || typeof shop !== "object") throw new Error("Tu usuario aún no tiene una barbería asociada.");
  return {
    id: shop.id,
    name: shop.name,
    slug: shop.slug,
    city: shop.city,
    phone: shop.phone,
    plan: shop.plan,
    subscription_status: shop.subscription_status,
  };
}

export async function getWorkspace(businessId: string): Promise<WorkspaceData> {
  const client = requireSupabase();
  const results = await Promise.all([
    client.from("barber_appointments").select("*").eq("business_id", businessId).order("starts_at"),
    client.from("barber_services").select("*").eq("business_id", businessId).order("name"),
    client.from("barber_products").select("*").eq("business_id", businessId).order("name"),
    client.from("barber_clients").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
    client.from("barber_staff").select("*").eq("business_id", businessId).order("name"),
    client.from("barber_expenses").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
    client.from("barber_sales").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
    client.from("barber_cash_sessions").select("*").eq("business_id", businessId).order("opened_at", { ascending: false }),
  ]);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  return {
    appointments: results[0].data ?? [],
    services: results[1].data ?? [],
    products: results[2].data ?? [],
    clients: results[3].data ?? [],
    staff: results[4].data ?? [],
    expenses: results[5].data ?? [],
    sales: results[6].data ?? [],
    cashSessions: results[7].data ?? [],
  } as WorkspaceData;
}

export async function createRecord(
  table: TableName,
  businessId: string,
  values: Record<string, string | number | boolean | null>,
) {
  const { error } = await requireSupabase()
    .from(table)
    .insert({ ...values, business_id: businessId });
  if (error) throw error;
}

export async function updateAppointment(id: string, status: Appointment["status"]) {
  const { error } = await requireSupabase().from("barber_appointments").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function saveShop(shopId: string, values: Pick<Shop, "name" | "city" | "phone">) {
  const { error } = await requireSupabase().from("barber_shops").update(values).eq("id", shopId);
  if (error) throw error;
}

export async function openCashSession(businessId: string, openingCash: number) {
  const { error } = await requireSupabase()
    .from("barber_cash_sessions")
    .insert({ business_id: businessId, opening_cash: openingCash });
  if (error) throw error;
}

export async function closeCashSession(id: string, countedCash: number) {
  const { error } = await requireSupabase()
    .from("barber_cash_sessions")
    .update({ counted_cash: countedCash, closed_at: new Date().toISOString() })
    .eq("id", id)
    .is("closed_at", null);
  if (error) throw error;
}

export async function createSale(
  businessId: string,
  values: {
    item_type: "service" | "product";
    item_id: string;
    quantity: number;
    discount: number;
    tip: number;
    payment_method: string;
    commission_rate: number;
    barber_name: string;
    appointment_id: string | null;
  },
) {
  const { error } = await requireSupabase().rpc("create_barber_sale", {
    p_business_id: businessId,
    p_item_type: values.item_type,
    p_item_id: values.item_id,
    p_quantity: values.quantity,
    p_discount: values.discount,
    p_tip: values.tip,
    p_payment_method: values.payment_method,
    p_commission_rate: values.commission_rate,
    p_barber_name: values.barber_name,
    p_appointment_id: values.appointment_id,
  });
  if (error) throw error;
}
