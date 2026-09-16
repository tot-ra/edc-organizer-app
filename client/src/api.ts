// Data layer: typed fetch helpers + TanStack Query hooks. Every mutation invalidates all queries,
// which is fine at this data size and keeps derived stats (weights, fill) always consistent.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Bag, BagDetail, Item, ItemWithPlacement, Location, LocationWithBags, Section,
} from '../../shared/edc.ts';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${url}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.issues) msg = body.issues.map((i: { path: string[]; message: string }) => `${i.path.join('.')}: ${i.message}`).join('; ');
      else if (body?.error) msg = body.error;
    } catch { /* non-json error body */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type LocationInput = Omit<Location, 'id'>;
export type BagInput = Omit<Bag, 'id'>;
export type SectionInput = Omit<Section, 'id'>;
export type ItemInput = Omit<Item, 'id'>;

export const useLocations = () =>
  useQuery({ queryKey: ['locations'], queryFn: () => request<LocationWithBags[]>('/locations') });

export const useBag = (id: number | undefined) =>
  useQuery({
    queryKey: ['bag', id],
    queryFn: () => request<BagDetail>(`/bags/${id}`),
    enabled: id != null && Number.isFinite(id),
  });

export const useItems = () =>
  useQuery({ queryKey: ['items'], queryFn: () => request<ItemWithPlacement[]>('/items') });

/** One hook exposing all write operations; each resolves after caches are invalidated. */
export function useApi() {
  const qc = useQueryClient();
  const wrap = <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
    useMutation({
      mutationFn: (args: A) => fn(...args),
      onSettled: () => qc.invalidateQueries(),
    });

  return {
    createLocation: wrap((d: LocationInput) => request<Location>('/locations', { method: 'POST', body: JSON.stringify(d) })),
    updateLocation: wrap((id: number, d: Partial<LocationInput>) => request<Location>(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(d) })),
    deleteLocation: wrap((id: number) => request<void>(`/locations/${id}`, { method: 'DELETE' })),

    createBag: wrap((d: BagInput) => request<Bag>('/bags', { method: 'POST', body: JSON.stringify(d) })),
    updateBag: wrap((id: number, d: Partial<BagInput>) => request<Bag>(`/bags/${id}`, { method: 'PUT', body: JSON.stringify(d) })),
    deleteBag: wrap((id: number) => request<void>(`/bags/${id}`, { method: 'DELETE' })),

    createSection: wrap((d: SectionInput) => request<Section>('/sections', { method: 'POST', body: JSON.stringify(d) })),
    updateSection: wrap((id: number, d: Partial<SectionInput>) => request<Section>(`/sections/${id}`, { method: 'PUT', body: JSON.stringify(d) })),
    deleteSection: wrap((id: number) => request<void>(`/sections/${id}`, { method: 'DELETE' })),

    createItem: wrap((d: ItemInput) => request<Item>('/items', { method: 'POST', body: JSON.stringify(d) })),
    updateItem: wrap((id: number, d: Partial<ItemInput>) => request<Item>(`/items/${id}`, { method: 'PUT', body: JSON.stringify(d) })),
    deleteItem: wrap((id: number) => request<void>(`/items/${id}`, { method: 'DELETE' })),
    moveItem: wrap((id: number, section_id: number | null, index: number) =>
      request<Item>(`/items/${id}/move`, { method: 'POST', body: JSON.stringify({ section_id, index }) })),
  };
}
