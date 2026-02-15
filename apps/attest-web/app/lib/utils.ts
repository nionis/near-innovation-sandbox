/** fetch that is used to proxy to '/api/verify?url=' */
export const fetchViaHost: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.toString();
  return fetch(`/api/verify?url=${encodeURIComponent(url)}`, init);
};
