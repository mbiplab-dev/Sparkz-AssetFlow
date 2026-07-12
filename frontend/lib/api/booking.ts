import { authRequest } from "@/lib/api/client";

export type BookingStatus = "upcoming" | "ongoing" | "completed" | "cancelled";

export type Booking = {
  id: number;
  asset: number;
  asset_name: string;
  asset_tag: string;
  booked_by: number;
  booked_by_name: string;
  department: number | null;
  department_name: string | null;
  starts_at: string; // ISO
  ends_at: string; // ISO
  purpose: string;
  status: BookingStatus;
  status_label: string;
  cancelled_at: string | null;
  cancelled_by: number | null;
  reminder_sent: boolean;
  created_at: string;
};

export type BookingCreateInput = {
  asset: number;
  department?: number | null;
  starts_at: string;
  ends_at: string;
  purpose?: string;
};

const BASE = "/api/booking/bookings/";

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function listBookings(
  params: {
    asset?: number;
    starts_after?: string;
    ends_before?: string;
  } = {},
): Promise<Booking[]> {
  const res = (await authRequest(`${BASE}${qs(params)}`)) as Booking[] | { results: Booking[] };
  return Array.isArray(res) ? res : res.results;
}

export async function createBooking(input: BookingCreateInput): Promise<Booking> {
  return (await authRequest(BASE, {
    method: "POST",
    body: JSON.stringify(input),
  })) as Booking;
}

export async function cancelBooking(id: number): Promise<Booking> {
  return (await authRequest(`${BASE}${id}/cancel/`, {
    method: "POST",
    body: JSON.stringify({}),
  })) as Booking;
}
