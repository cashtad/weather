import { loadSavedLocation, PRAGUE } from './preferences.js';
import { getBrowserLocation } from './browserLocation.js';
import { getApproximateLocation } from './approximateLocation.js';
import { isAbortError } from '../api/client.js';

export async function detectLocation({ signal, useSaved = true, onStatus = () => {} } = {}) {
  if (signal?.aborted) throw new DOMException('Location request cancelled.', 'AbortError');
  const saved = useSaved ? loadSavedLocation() : null;
  if (saved) return saved;
  onStatus('Detecting your location... You can also search for a city.');
  try {
    return await getBrowserLocation({ signal });
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) throw error;
  }
  onStatus('Estimating your location with ipwho.is...');
  try {
    return await getApproximateLocation({ signal });
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  return { ...PRAGUE };
}
