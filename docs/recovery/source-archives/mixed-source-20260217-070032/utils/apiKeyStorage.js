const API_KEY_PREFIX = "phk:v1:";

function encodeApiKey(rawValue) {
  const value = String(rawValue || "");
  if (!value) return "";
  try {
    return `${API_KEY_PREFIX}${btoa(encodeURIComponent(value))}`;
  } catch {
    return value;
  }
}

function decodeApiKey(rawValue) {
  const value = String(rawValue || "");
  if (!value) return "";
  if (!value.startsWith(API_KEY_PREFIX)) return value;
  const encoded = value.slice(API_KEY_PREFIX.length);
  if (!encoded) return "";
  try {
    return decodeURIComponent(atob(encoded));
  } catch {
    return "";
  }
}

export function encodeConfigApiKey(config) {
  if (!config || typeof config !== "object") return config;
  return {
    ...config,
    apiKey: encodeApiKey(config.apiKey)
  };
}

export function decodeConfigApiKey(config) {
  if (!config || typeof config !== "object") return config;
  return {
    ...config,
    apiKey: decodeApiKey(config.apiKey)
  };
}

export function encodeProfilesApiKeyMap(profilesMap) {
  if (!profilesMap || typeof profilesMap !== "object") return profilesMap;
  const next = {};
  Object.keys(profilesMap).forEach((providerKey) => {
    next[providerKey] = encodeConfigApiKey(profilesMap[providerKey]);
  });
  return next;
}

export function decodeProfilesApiKeyMap(profilesMap) {
  if (!profilesMap || typeof profilesMap !== "object") return profilesMap;
  const next = {};
  Object.keys(profilesMap).forEach((providerKey) => {
    next[providerKey] = decodeConfigApiKey(profilesMap[providerKey]);
  });
  return next;
}
