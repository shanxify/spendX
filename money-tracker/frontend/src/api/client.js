import axios from 'axios';
import { supabase } from '../supabaseClient';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add this function to get current session token
async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

// Update axios instance to add auth header to every request
api.interceptors.request.use(async (config) => {
  const headers = await getAuthHeaders();
  config.headers = { ...config.headers, ...headers };
  return config;
});

export const Client = {
  uploadPDF: async (file, provider) => {
    const formData = new FormData();
    formData.append('file', file);
    if (provider) {
      formData.append('provider', provider);
    }
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/stats');
    return response.data;
  },

  getTransactions: async (params) => {
    const response = await api.get('/transactions', { params });
    return response.data;
  },

  updateTransactionCategory: async (id, category) => {
    const response = await api.put(`/transactions/${id}`, { category });
    return response.data;
  },

  deleteTransaction: async (id) => {
    const response = await api.delete(`/transactions/${id}`);
    return response.data;
  },

  clearTransactions: async () => {
    const response = await api.delete('/transactions/clear');
    return response.data;
  },

  seedCategories: async () => {
    const response = await api.post('/seed-categories');
    return response.data;
  },

  getCategories: async () => {
    const response = await api.get('/categories');
    return response.data;
  },

  createCategory: async (data) => {
    const response = await api.post('/categories', data);
    return response.data;
  },

  updateCategory: async (id, data) => {
    const response = await api.put(`/categories/${id}`, data);
    return response.data;
  },

  deleteCategory: async (id) => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  },

  getMerchants: async (params) => {
    const response = await api.get('/merchants', { params });
    return response.data;
  },

  updateMerchantCategory: async (normalized, category) => {
    const response = await api.put(`/merchants/${normalized}`, { category });
    return response.data;
  },

  bulkUpdateMerchants: async (merchants, category) => {
    const response = await api.put('/merchants/bulk/assign', { merchants, category });
    return response.data;
  },

  sendFeedback: async (message) => {
    const response = await api.post('/feedback', { message });
    return response.data;
  },

  sendChatMessage: async (message, history = []) => {
    const response = await api.post('/chat', { message, history });
    return response.data;
  }
};

export default Client;
