export const getAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('citeos_token');
  }
  return null;
};

export const setAuthToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('citeos_token', token);
  }
};

export const clearAuthToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('citeos_token');
  }
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  if (token) {
    return {
      'Authorization': `Bearer ${token}`
    };
  }
  return {};
};
