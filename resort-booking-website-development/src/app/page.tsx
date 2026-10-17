import { getRooms, getGallery, sampleRooms, sampleGallery } from '@/lib/resort';
import { backendMessages, checkBackendReadiness } from '@/lib/readiness';
import ResortHome from '@/components/ResortHome';

export const dynamic = 'force-dynamic';

const previewRooms = sampleRooms.map((room, index) => ({ ...room, id: index + 1 }));
const previewGallery = sampleGallery.map((image, index) => ({ ...image, id: index + 1 }));

async function loadResortData() {
  try {
    const [rooms, gallery] = await Promise.all([getRooms(), getGallery()]);
    if (!rooms.length) throw new Error('No bookable accommodations are configured.');
    return { rooms, gallery };
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'unknown';
    console.error(`[PAINAWA] Resort data could not load (${code}).`);
    return null;
  }
}

export default async function HomePage() {
  const backend = await checkBackendReadiness();
  if (backend.status !== 'ready') {
    return <ResortHome rooms={previewRooms} gallery={previewGallery} backendStatus={backend.status} backendMessage={backend.message} />;
  }

  const resort = await loadResortData();
  if (resort) return <ResortHome rooms={resort.rooms} gallery={resort.gallery} />;

  return <ResortHome rooms={previewRooms} gallery={previewGallery} backendStatus="application_error" backendMessage={backendMessages.application_error} />;
}
