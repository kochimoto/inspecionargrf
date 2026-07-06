import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001/api`;

const api = axios.create({
  baseURL: API_URL,
});

// Request interceptor to add JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export const authAPI = {
  login: async (username, password) => {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },
  me: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  }
};

export const vehicleAPI = {
  list: async (search = '') => {
    const response = await api.get('/vehicles', { params: { search } });
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/vehicles/${id}`);
    return response.data;
  },
  create: async (vehicleData) => {
    const response = await api.post('/vehicles', vehicleData);
    return response.data;
  },
  update: async (id, vehicleData) => {
    const response = await api.put(`/vehicles/${id}`, vehicleData);
    return response.data;
  }
};

export const checklistAPI = {
  getTree: async (all = false) => {
    const response = await api.get('/checklist', { params: { all } });
    return response.data;
  },
  createCategory: async (name) => {
    const response = await api.post('/checklist/categories', { name });
    return response.data;
  },
  updateCategory: async (id, name) => {
    const response = await api.put(`/checklist/categories/${id}`, { name });
    return response.data;
  },
  deleteCategory: async (id) => {
    const response = await api.delete(`/checklist/categories/${id}`);
    return response.data;
  },
  createItem: async (category_id, name) => {
    const response = await api.post('/checklist/items', { category_id, name });
    return response.data;
  },
  updateItem: async (id, name, is_active) => {
    const response = await api.put(`/checklist/items/${id}`, { name, is_active });
    return response.data;
  },
  deleteItem: async (id) => {
    const response = await api.delete(`/checklist/items/${id}`);
    return response.data;
  }
};

export const inspectionAPI = {
  get: async (id) => {
    const response = await api.get(`/inspections/${id}`);
    return response.data;
  },
  start: async (vehicle_id) => {
    const response = await api.post('/inspections/start', { vehicle_id });
    return response.data;
  },
  saveItem: async (inspection_id, item_id, itemData) => {
    // Send as multipart/form-data for photo uploads
    const formData = new FormData();
    formData.append('status', itemData.status);
    if (itemData.description) formData.append('description', itemData.description);
    if (itemData.priority) formData.append('priority', itemData.priority);
    if (itemData.photos && itemData.photos.length > 0) {
      itemData.photos.forEach((photo) => {
        formData.append('photos', photo);
      });
    }
    const response = await api.post(`/inspections/items/${inspection_id}/${item_id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },
  finalize: async (inspection_id, signature_name) => {
    const response = await api.post(`/inspections/finalize/${inspection_id}`, { signature_name });
    return response.data;
  },
  getReportURL: (inspection_id) => {
    const token = localStorage.getItem('token');
    const backendBase = import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace('/api', '') 
      : `http://${window.location.hostname}:3001`;
    return `${backendBase}/api/inspections/report/${inspection_id}?token=${token}`;
  }
};

export const pendenciesAPI = {
  list: async (status = '', vehicle_id = '') => {
    const response = await api.get('/pendencies', { params: { status, vehicle_id } });
    return response.data;
  },
  updateStatus: async (id, status, responsible_id = null) => {
    const response = await api.put(`/pendencies/${id}/status`, { status, responsible_id });
    return response.data;
  },
  resolve: async (id, photos = []) => {
    const formData = new FormData();
    if (photos.length > 0) {
      photos.forEach(photo => {
        formData.append('photos', photo);
      });
    }
    const response = await api.post(`/pendencies/${id}/resolve`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }
};

export const dashboardAPI = {
  getStats: async () => {
    const response = await api.get('/dashboard');
    return response.data;
  }
};

export default api;
