'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { applyTheme } from '@/components/ThemeProvider';
import { 
  Settings as SettingsIcon, 
  Users, 
  ShieldCheck, 
  Bell,
  Database,
  Plus,
  Trash2,
  Edit2,
  Building2,
  Save,
  Loader2,
  CheckCircle2,
  Image as ImageIcon,
  Maximize,
  Upload,
  X,
  Mail,
  Lock,
  AlertTriangle,
  ChevronRight,
  Eye,
  EyeOff,
  User as UserIcon,
  Palette,
  Moon,
  Sun
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('roles');
  const { refreshConfig } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const colorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDark, setIsDark] = useState(false);

  // Sync dark mode state from DOM on mount
  useEffect(() => {
    setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
  }, []);

  const handleDarkModeToggle = async () => {
    const next = !isDark;
    setIsDark(next);
    applyTheme(next);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_param', name: 'dark_mode', value: String(next) })
    });
    await refreshConfig();
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar al usuario "${userName}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch('/api/users/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al eliminar usuario.');
      await fetchData();
      setMessage('Usuario eliminado correctamente.');
      setTimeout(() => setMessage(''), 5000);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // Data states
  const [roles, setRoles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [companyParams, setCompanyParams] = useState<any[]>([]);

  // Modal states
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'roles') {
        const { data: rolesData } = await supabase.from('roles').select('*').order('name', { ascending: true });
        let { data: permsData } = await supabase.from('permissions').select('*');

        // Sincronizar módulos faltantes automáticamente para que siempre se vean en el menú
        const expectedModules = [
          { module: 'dashboard', name: 'Dashboard', description: 'Vista de indicadores clave' },
          { module: 'orders', name: 'Órdenes', description: 'Gestión de órdenes de producción' },
          { module: 'cutting', name: 'Mesa de Corte', description: 'Gestión de cortes y trazos' },
          { module: 'masters', name: 'Maestros', description: 'Configuración de telas, colores y tallas' },
          { module: 'inventory', name: 'Inventario', description: 'Control de stock de insumos' },
          { module: 'costs', name: 'Costos', description: 'Módulo de costeo de producción' },
          { module: 'tracking', name: 'Seguimiento', description: 'Estado de envíos a talleres' },
          { module: 'workshops', name: 'Talleres', description: 'Gestión de talleres satélite' },
          { module: 'sewing', name: 'Confección', description: 'Gestión de envío y recepción de prendas' },
          { module: 'quality', name: 'Calidad', description: 'Control de calidad y auditoría' },
          { module: 'settings', name: 'Ajustes', description: 'Configuración del sistema' },
          { module: 'help', name: 'Ayuda', description: 'Documentación y soporte' }
        ];

        if (permsData) {
          const missingModules = expectedModules.filter(em => !permsData?.some(p => p.module === em.module));
          if (missingModules.length > 0) {
            const { data: inserted } = await supabase.from('permissions').insert(missingModules).select('*');
            if (inserted) {
              permsData = [...permsData, ...inserted];
            }
          }
        }
        
        // Ordenar los permisos por módulo
        permsData?.sort((a, b) => a.module.localeCompare(b.module));
        
        // Fetch role permissions for all roles
        const { data: rolePerms } = await supabase.from('role_permissions').select('*');
        
        const rolesWithPerms = rolesData?.map(role => ({
          ...role,
          permissions: rolePerms?.filter(rp => rp.role_id === role.id).map(rp => rp.permission_id) || []
        })) || [];

        setRoles(rolesWithPerms);
        setPermissions(permsData || []);
      } else if (activeTab === 'users') {
        const res = await fetch('/api/users/list');
        if (res.ok) {
          const result = await res.json();
          setUsers(result.users || []);
        } else {
          const { data: profiles } = await supabase.from('profiles').select('*, roles(id, name)');
          setUsers(profiles || []);
        }
        const { data: rolesData } = await supabase.from('roles').select('*');
        setRoles(rolesData || []);
      } else if (activeTab === 'company' || activeTab === 'parametrization') {
        const { data } = await supabase.from('company_params').select('*');
        if (data && data.length > 0) {
          setCompanyParams(data);
        } else {
          // Initialize defaults if empty
          const defaults = [
            { name: 'logo_url', value: '', description: 'URL del logo' },
            { name: 'logo_width', value: '150', description: 'Ancho del logo (px)' },
            { name: 'mobile_app_image_url', value: '', description: 'Imagen App Móvil' },
            { name: 'min_wage', value: '1300000', description: 'Salario Mínimo' },
            { name: 'iva_percent', value: '19', description: 'IVA (%)' },
            { name: 'max_marcaciones', value: '7', description: 'Máximo número de marcación' },
            { name: 'admin_revert_obs', value: 'false', description: 'Permitir al administrador reversar avances de tendido' }
          ];
          setCompanyParams(defaults);
        }
      }
    } catch (err) {
      console.error('Error fetching settings data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditRole = (role: any) => {
    setEditingRole(role);
    setSelectedPermissions(role.permissions || []);
    setShowRoleModal(true);
  };

  const handleTogglePermission = (id: string) => {
    setSelectedPermissions(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const roleData = {
      name: formData.get('name'),
      description: formData.get('description'),
    };

    try {
      let roleId = editingRole?.id;

      if (editingRole) {
        const { error } = await supabase.from('roles').update(roleData).eq('id', editingRole.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('roles').insert([roleData]).select();
        if (error) throw error;
        roleId = data[0].id;
      }

      // Update role permissions
      // 1. Delete existing
      await supabase.from('role_permissions').delete().eq('role_id', roleId);
      
      // 2. Insert new ones
      if (selectedPermissions.length > 0) {
        const newPerms = selectedPermissions.map(pId => ({
          role_id: roleId,
          permission_id: pId
        }));
        const { error: permError } = await supabase.from('role_permissions').insert(newPerms);
        if (permError) throw permError;
      }

      // Esperar que los datos se recarguen ANTES de cerrar el modal
      // para que al reabrirlo los permisos ya estén actualizados
      await fetchData();
      // Refresca la navegación/sidebar para reflejar los nuevos módulos del rol
      await refreshConfig();

      setShowRoleModal(false);
      setEditingRole(null);
      setSelectedPermissions([]);
      setMessage('Rol y permisos actualizados correctamente.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este rol? Se perderán todos sus permisos asignados.')) return;
    try {
      const { error } = await supabase.from('roles').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const userData = {
      full_name: formData.get('full_name'),
      role_id: formData.get('role_id') || null,
    };
    const newPassword = formData.get('new_password') as string;

    try {
      if (editingUser) {
        // Actualizar perfil del usuario
        const { error } = await supabase.from('profiles').update(userData).eq('id', editingUser.id);
        if (error) throw error;

        // Actualizar contraseña si se proporcionó una
        if (newPassword && newPassword.trim() !== '') {
          const res = await fetch('/api/users/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: editingUser.id, newPassword })
          });
          const result = await res.json();
          if (!res.ok) {
            throw new Error(result.error || 'Error al actualizar contraseña');
          }
        }
      }
      setShowUserModal(false);
      setEditingUser(null);
      fetchData();
      setMessage('Usuario y accesos actualizados.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const full_name = formData.get('full_name') as string;
    const role_id = formData.get('role_id') as string;
    const cleanRoleId = role_id && role_id !== '' ? role_id : null;

    if (password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name, role_id: cleanRoleId })
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Error al crear el usuario.');
      }

      setShowCreateUserModal(false);
      await fetchData();
      setMessage('Usuario registrado exitosamente.');
      setTimeout(() => setMessage(''), 5000);
    } catch (err: any) {
      alert('Error en registro: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;

      // Convertir archivo a Base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = (error) => reject(error);
      });
      reader.readAsDataURL(file);
      const fileBase64 = await base64Promise;
      
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'logo_url', fileBase64, fileName })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Error al guardar el logo');

      fetchData();
      setMessage('Logo actualizado.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateParam = async (name: string, value: string) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, value })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Error al guardar ajuste');

      await refreshConfig();
      setMessage('Ajuste guardado.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      console.error(err);
      setMessage('Error al guardar ajuste.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Configuración del Sistema</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Administra roles, accesos y usuarios.</p>
        </div>
        {message && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#16a34a', fontWeight: '500', backgroundColor: '#f0fdf4', padding: '0.5rem 1rem', borderRadius: '999px', border: '1px solid #bbf7d0' }}>
            <CheckCircle2 size={18} /> {message}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1.5rem' }}>
        {/* Navigation */}
        <div className="card" style={{ width: '280px', height: 'fit-content', padding: '1rem' }}>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {[
              { id: 'roles', label: 'Roles & Accesos', icon: ShieldCheck },
              { id: 'users', label: 'Usuarios', icon: Users },
              { id: 'company', label: 'Identidad Empresa', icon: Building2 },
              { id: 'parametrization', label: 'Parametrización', icon: Database },
              { id: 'notifications', label: 'Notificaciones', icon: Bell },
              { id: 'database', label: 'Base de Datos', icon: Database },
            ].map((item) => (
              <li key={item.id}>
                <button 
                  onClick={() => setActiveTab(item.id)}
                  className="btn"
                  style={{ 
                    width: '100%', 
                    justifyContent: 'flex-start',
                    backgroundColor: activeTab === item.id ? 'var(--primary-lighter)' : 'transparent',
                    color: activeTab === item.id ? 'var(--primary)' : 'var(--text)',
                    padding: '0.75rem 1rem'
                  }}
                >
                  <item.icon size={18} />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Content */}
        <div className="card" style={{ flex: 1, minHeight: '500px' }}>
          {loading ? (
            <div style={{ padding: '5rem', display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin" size={32} /></div>
          ) : (
            <>
              {activeTab === 'roles' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h3>Definición de Roles</h3>
                    <button className="btn btn-primary" onClick={() => { setEditingRole(null); setSelectedPermissions([]); setShowRoleModal(true); }}>
                      <Plus size={18} /> Crear Nuevo Rol
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {roles.map((role) => (
                      <div key={role.id} style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '16px', backgroundColor: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                          <h4 style={{ margin: 0 }}>{role.name}</h4>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn-icon" onClick={() => handleEditRole(role)}><Edit2 size={16} /></button>
                            <button className="btn-icon" onClick={() => handleDeleteRole(role.id)}><Trash2 size={16} color="#ef4444" /></button>
                          </div>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem', minHeight: '3em' }}>{role.description}</p>
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                          <p style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Accesos a Módulos:</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            {permissions.map(perm => {
                              const hasAccess = role.permissions?.includes(perm.id);
                              return (
                                <div key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: hasAccess ? 'var(--text)' : 'var(--text-muted)', opacity: hasAccess ? 1 : 0.6 }}>
                                  {hasAccess ? <CheckCircle2 size={14} color="#10b981" /> : <X size={14} color="#ef4444" />}
                                  {perm.name.replace('Acceso a ', '').replace('Gestión de ', '')}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'users' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h3>Gestión de Usuarios</h3>
                    <button className="btn btn-primary" onClick={() => setShowCreateUserModal(true)}><Plus size={18} /> Nuevo Usuario</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {users.map((u) => (
                      <div key={u.id} style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'var(--primary-lighter)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={20} color="var(--primary)" />
                          </div>
                          <div>
                            <p style={{ fontWeight: '700' }}>{u.full_name}</p>
                            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{u.roles?.name || 'Invitado'}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            className="btn-icon"
                            onClick={() => { setEditingUser(u); setShowUserModal(true); }}
                            title="Editar usuario"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.full_name || u.email)}
                            title="Eliminar usuario"
                            style={{
                              width: '34px', height: '34px',
                              borderRadius: '8px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: 'transparent',
                              border: '1px solid #fca5a5',
                              color: '#ef4444',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fee2e2'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'company' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Branding e Identidad</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Configura la apariencia visual de tu plataforma.</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    {/* Logo Config */}
                    <div className="card" style={{ padding: '1.5rem', backgroundColor: '#f8fafc' }}>
                      <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ImageIcon size={18} /> Logo Principal</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ 
                          height: '120px', 
                          border: '2px dashed var(--border)', 
                          borderRadius: '12px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          backgroundColor: 'white',
                          overflow: 'hidden'
                        }}>
                          {companyParams.find(p => p.name === 'logo_url')?.value ? (
                            <img src={companyParams.find(p => p.name === 'logo_url')?.value} alt="Logo" style={{ maxHeight: '100px' }} />
                          ) : <ImageIcon size={40} color="var(--border)" />}
                        </div>
                        <input type="file" accept="image/*" id="logo-upload" hidden onChange={handleLogoUpload} />
                        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => document.getElementById('logo-upload')?.click()}>
                          <Upload size={16} /> Cambiar Logo
                        </button>
                        <div style={{ marginTop: '0.5rem', padding: '1rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text)' }}>Escalar Logo (Ancho)</label>
                            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)', backgroundColor: 'var(--primary-lighter)', padding: '2px 8px', borderRadius: '4px' }}>
                              {companyParams.find(p => p.name === 'logo_width')?.value || '150'}px
                            </span>
                          </div>
                          <input 
                            type="range" 
                            min="50" 
                            max="500" 
                            step="5"
                            style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--primary)' }}
                            value={companyParams.find(p => p.name === 'logo_width')?.value || '150'} 
                            onChange={(e) => {
                              const newVal = e.target.value;
                              setCompanyParams(prev => prev.map(p => p.name === 'logo_width' ? { ...p, value: newVal } : p));
                            }}
                            onMouseUp={(e: any) => handleUpdateParam('logo_width', e.target.value)}
                            onTouchEnd={(e: any) => handleUpdateParam('logo_width', e.target.value)}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
                            <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Pequeño</span>
                            <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Grande</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mobile App Image Config */}
                    <div className="card" style={{ padding: '1.5rem', backgroundColor: '#f8fafc' }}>
                      <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Maximize size={18} /> Imagen App Móvil (Sidebar)</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ 
                          height: '120px', 
                          border: '2px dashed var(--border)', 
                          borderRadius: '12px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          backgroundColor: 'white',
                          overflow: 'hidden'
                        }}>
                          {companyParams.find(p => p.name === 'mobile_app_image_url')?.value ? (
                            <img src={companyParams.find(p => p.name === 'mobile_app_image_url')?.value} alt="App Image" style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
                          ) : <ImageIcon size={40} color="var(--border)" />}
                        </div>
                        <input 
                          type="file" 
                          accept="image/*" 
                          id="mobile-app-upload" 
                          hidden 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setSaving(true);
                            try {
                              const fileExt = file.name.split('.').pop();
                              const fileName = `mobile-app-${Date.now()}.${fileExt}`;
                              
                              // Convertir archivo a Base64
                              const reader = new FileReader();
                              const base64Promise = new Promise<string>((resolve, reject) => {
                                reader.onload = () => {
                                  const result = reader.result as string;
                                  const base64Data = result.split(',')[1];
                                  resolve(base64Data);
                                };
                                reader.onerror = (error) => reject(error);
                              });
                              reader.readAsDataURL(file);
                              const fileBase64 = await base64Promise;
                              
                              const res = await fetch('/api/settings', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name: 'mobile_app_image_url', fileBase64, fileName })
                              });
                              const resData = await res.json();
                              if (!res.ok) throw new Error(resData.error || 'Error al guardar la imagen de la app');

                              await refreshConfig();
                              fetchData();
                            } catch (err: any) { alert(err.message); } finally { setSaving(false); }
                          }} 
                        />
                        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => document.getElementById('mobile-app-upload')?.click()}>
                          <Upload size={16} /> Cambiar Imagen App
                        </button>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Esta imagen se mostrará en la tarjeta de promoción de la app móvil en el menú lateral.</p>
                      </div>
                    </div>
                  </div>

                  {/* ── Color de Tema ──────────────────────────────── */}
                  <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)' }}>
                    <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Palette size={18} /> Color Principal del Sistema
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                      Define el color primario que se aplica en toda la plataforma: botones, barras laterales, íconos y acentos.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                      {/* Color Picker */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: '80px', height: '80px', borderRadius: '16px',
                          backgroundColor: companyParams.find(p => p.name === 'theme_primary_color')?.value || '#104433',
                          boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                          border: '3px solid white',
                          outline: '2px solid var(--border)',
                          position: 'relative', overflow: 'hidden', cursor: 'pointer'
                        }}>
                          <input
                            id="themeColorInput"
                            type="color"
                            value={companyParams.find(p => p.name === 'theme_primary_color')?.value || '#104433'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCompanyParams(prev => {
                                const exists = prev.some(p => p.name === 'theme_primary_color');
                                if (exists) return prev.map(p => p.name === 'theme_primary_color' ? { ...p, value: val } : p);
                                return [...prev, { name: 'theme_primary_color', value: val, description: 'Color primario del tema' }];
                              });
                              // Apply instantly for live preview
                              document.documentElement.style.setProperty('--primary', val);
                              // Debounce save to DB (500ms after user stops picking)
                              if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
                              colorDebounceRef.current = setTimeout(() => {
                                handleUpdateParam('theme_primary_color', val);
                              }, 500);
                            }}
                            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                          />
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {(companyParams.find(p => p.name === 'theme_primary_color')?.value || '#104433').toUpperCase()}
                        </span>
                      </div>

                      {/* Palette presets */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Paletas Rápidas</span>
                        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                          {[
                            { color: '#104433', label: 'Verde Selva' },
                            { color: '#1e3a5f', label: 'Azul Marino' },
                            { color: '#4f46e5', label: 'Índigo' },
                            { color: '#7c3aed', label: 'Violeta' },
                            { color: '#b91c1c', label: 'Rojo' },
                            { color: '#b45309', label: 'Ámbar' },
                            { color: '#0e7490', label: 'Cian' },
                            { color: '#0f172a', label: 'Negro Slate' },
                          ].map(({ color, label }) => (
                            <button
                              key={color}
                              title={label}
                              onClick={() => {
                                setCompanyParams(prev => {
                                  const exists = prev.some(p => p.name === 'theme_primary_color');
                                  if (exists) return prev.map(p => p.name === 'theme_primary_color' ? { ...p, value: color } : p);
                                  return [...prev, { name: 'theme_primary_color', value: color, description: 'Color primario del tema' }];
                                });
                                document.documentElement.style.setProperty('--primary', color);
                                handleUpdateParam('theme_primary_color', color);
                              }}
                              style={{
                                width: '36px', height: '36px', borderRadius: '10px',
                                backgroundColor: color,
                                border: (companyParams.find(p => p.name === 'theme_primary_color')?.value || '#104433') === color
                                  ? '3px solid white' : '3px solid transparent',
                                outline: (companyParams.find(p => p.name === 'theme_primary_color')?.value || '#104433') === color
                                  ? `2px solid ${color}` : '2px solid transparent',
                                cursor: 'pointer',
                                transition: 'transform 0.15s ease',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                              }}
                              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
                              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                            />
                          ))}
                        </div>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Haz clic en un color o usa el selector para personalizar. El cambio se aplica en tiempo real.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'parametrization' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Variables Globales</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Configura los valores base para cálculos de costos.</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)' }}>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '700', marginBottom: '0.75rem' }}>Salario Mínimo Legal</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: 'var(--text-muted)' }}>$</span>
                        <input 
                          type="number" 
                          className="input" 
                          style={{ width: '100%', paddingLeft: '2rem' }} 
                          value={companyParams.find(p => p.name === 'min_wage')?.value || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCompanyParams(prev => prev.map(p => p.name === 'min_wage' ? { ...p, value: val } : p));
                          }}
                          onBlur={(e) => handleUpdateParam('min_wage', e.target.value)}
                        />
                      </div>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Utilizado para el cálculo de carga prestacional y MOD.</p>
                    </div>

                    <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)' }}>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '700', marginBottom: '0.75rem' }}>IVA (%)</label>
                      <div style={{ position: 'relative' }}>
                        <input 
                          type="number" 
                          className="input" 
                          style={{ width: '100%', paddingRight: '2rem' }} 
                          value={companyParams.find(p => p.name === 'iva_percent')?.value || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCompanyParams(prev => prev.map(p => p.name === 'iva_percent' ? { ...p, value: val } : p));
                          }}
                          onBlur={(e) => handleUpdateParam('iva_percent', e.target.value)}
                        />
                        <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: 'var(--text-muted)' }}>%</span>
                      </div>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Porcentaje de IVA aplicado a materias primas y servicios.</p>
                    </div>

                    <div className="card" style={{ padding: '1.5rem', border: '2px solid #a5b4fc', borderRadius: '12px', background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)' }}>
                       <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '800', marginBottom: '0.5rem', color: '#4338ca' }}>🔢 Máximo de Marcaciones</label>
                       <p style={{ fontSize: '0.72rem', color: '#6366f1', marginBottom: '0.75rem', fontWeight: '600' }}>Controla hasta qué número de marcación estarán disponibles en la orden de corte (Marc. 0 … N).</p>
                       <div style={{ position: 'relative' }}>
                         <input 
                           type="number" 
                           min="1"
                           max="50"
                           className="input" 
                           style={{ width: '100%', fontWeight: '800', fontSize: '1.1rem', color: '#4338ca', border: '2px solid #a5b4fc' }} 
                           value={companyParams.find(p => p.name === 'max_marcaciones')?.value || '7'}
                           onChange={(e) => {
                             const val = e.target.value;
                             setCompanyParams(prev => {
                               const exists = prev.some(p => p.name === 'max_marcaciones');
                               if (exists) return prev.map(p => p.name === 'max_marcaciones' ? { ...p, value: val } : p);
                               return [...prev, { name: 'max_marcaciones', value: val, description: 'Máximo número de marcación' }];
                             });
                           }}
                           onBlur={(e) => handleUpdateParam('max_marcaciones', e.target.value)}
                         />
                       </div>
                       <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Ej: Si colocas <strong>12</strong>, en la orden aparecerán las marcaciones del 0 al 12.</p>
                     </div>

                      <div className="card" style={{ padding: '1.5rem', border: '2px solid #a5b4fc', borderRadius: '12px', background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '800', marginBottom: '0.5rem', color: '#4338ca' }}>🔄 Reversar Avance en Tendido (Admin)</label>
                          <p style={{ fontSize: '0.72rem', color: '#6366f1', marginBottom: '0.75rem', fontWeight: '600' }}>Controla si un administrador puede deshacer/reversar un avance de tendido reportado.</p>
                        </div>
                        <div style={{ position: 'relative' }}>
                          <select 
                            className="select" 
                            style={{ width: '100%', fontWeight: '800', fontSize: '0.9rem', color: '#4338ca', border: '2px solid #a5b4fc', padding: '0.5rem', borderRadius: '8px', backgroundColor: 'white' }} 
                            value={companyParams.find(p => p.name === 'admin_revert_obs')?.value || 'false'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCompanyParams(prev => {
                                const exists = prev.some(p => p.name === 'admin_revert_obs');
                                if (exists) return prev.map(p => p.name === 'admin_revert_obs' ? { ...p, value: val } : p);
                                return [...prev, { name: 'admin_revert_obs', value: val, description: 'Permitir al administrador reversar avances de tendido' }];
                              });
                              handleUpdateParam('admin_revert_obs', val);
                            }}
                          >
                            <option value="false">Desactivado (No permitir)</option>
                            <option value="true">Activado (Permitir reversar)</option>
                          </select>
                        </div>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Si se activa, los administradores tendrán la opción en el historial de notas.</p>
                      </div>
                    </div>

                  {/* Dark Mode Toggle */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3>Apariencia</h3>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Personaliza la interfaz visual del sistema.</p>
                    </div>
                    <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{
                            width: '48px', height: '48px', borderRadius: '12px',
                            background: isDark ? 'linear-gradient(135deg, #1e293b, #0f172a)' : 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '2px solid var(--border)', transition: 'all 0.3s ease'
                          }}>
                            {isDark
                              ? <Moon size={22} style={{ color: '#94a3b8' }} />
                              : <Sun size={22} style={{ color: '#f59e0b' }} />}
                          </div>
                          <div>
                            <p style={{ fontWeight: '700', fontSize: '0.9375rem', margin: 0 }}>
                              {isDark ? 'Modo Oscuro' : 'Modo Claro'}
                            </p>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, marginTop: '0.2rem' }}>
                              {isDark ? 'Interfaz con fondo oscuro, ideal para ambientes con poca luz.' : 'Interfaz con fondo claro, ideal para ambientes iluminados.'}
                            </p>
                          </div>
                        </div>
                        {/* Toggle switch */}
                        <button
                          type="button"
                          onClick={handleDarkModeToggle}
                          aria-label="Toggle dark mode"
                          style={{
                            position: 'relative',
                            width: '60px', height: '32px',
                            borderRadius: '999px',
                            border: 'none',
                            cursor: 'pointer',
                            background: isDark
                              ? 'linear-gradient(135deg, #34d399, #059669)'
                              : 'linear-gradient(135deg, #cbd5e1, #94a3b8)',
                            transition: 'background 0.3s ease',
                            flexShrink: 0,
                            boxShadow: isDark ? '0 0 12px rgba(52,211,153,0.4)' : 'none'
                          }}
                        >
                          <span style={{
                            position: 'absolute',
                            top: '4px',
                            left: isDark ? '32px' : '4px',
                            width: '24px', height: '24px',
                            borderRadius: '50%',
                            background: 'white',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                            transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {isDark
                              ? <Moon size={12} style={{ color: '#6366f1' }} />
                              : <Sun size={12} style={{ color: '#f59e0b' }} />}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Role & Permissions Modal */}
      {showRoleModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', padding: '3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
              <h2 style={{ margin: 0 }}>{editingRole ? 'Editar Rol' : 'Nuevo Rol'}</h2>
              <button className="btn-icon" onClick={() => setShowRoleModal(false)}><X size={28} /></button>
            </div>
            
            <form onSubmit={handleSaveRole}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <h4 style={{ borderBottom: '2px solid var(--primary-lighter)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>Información Básica</h4>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.5rem' }}>Nombre del Rol</label>
                    <input name="name" defaultValue={editingRole?.name} required className="input" style={{ width: '100%' }} placeholder="Ej: Jefe de Producción" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.5rem' }}>Descripción</label>
                    <textarea name="description" defaultValue={editingRole?.description} className="input" style={{ width: '100%', minHeight: '120px' }} placeholder="¿Qué responsabilidades tiene este rol?" />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h4 style={{ borderBottom: '2px solid var(--primary-lighter)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>Accesos al Menú</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    {permissions.map(perm => (
                      <label key={perm.id} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem', 
                        padding: '0.75rem', 
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        backgroundColor: selectedPermissions.includes(perm.id) ? 'var(--primary-lighter)' : 'white',
                        transition: 'all 0.2s'
                      }}>
                        <input 
                          type="checkbox" 
                          checked={selectedPermissions.includes(perm.id)} 
                          onChange={() => handleTogglePermission(perm.id)}
                          style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.8125rem', fontWeight: selectedPermissions.includes(perm.id) ? '700' : '500' }}>
                          {perm.name.replace('Acceso a ', '').replace('Gestión de ', '')}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '1rem' }} onClick={() => setShowRoleModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '1rem', justifyContent: 'center' }} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : 'Guardar Configuración'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Other Modals (Same as before) */}
      {showCreateUserModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '90%', maxWidth: '480px', padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem 2rem', background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '950', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserIcon size={22} /> Nuevo Usuario
                </h2>
                <p style={{ fontSize: '0.8rem', opacity: 0.9, margin: '0.25rem 0 0 0' }}>Crea accesos y asigna roles al personal.</p>
              </div>
              <button onClick={() => setShowCreateUserModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '50%', padding: '0.5rem', display: 'flex' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleCreateUser} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '0.5rem' }}>NOMBRE COMPLETO</label>
                <div style={{ position: 'relative' }}>
                  <UserIcon size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input name="full_name" required placeholder="Ej. Ana Pérez" style={{ width: '100%', padding: '0.875rem 1rem 0.875rem 3rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.875rem', fontWeight: '500' }} />
                </div>
              </div>

              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '0.5rem' }}>CORREO ELECTRÓNICO (EMAIL)</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input name="email" type="email" required placeholder="correo@empresa.com" style={{ width: '100%', padding: '0.875rem 1rem 0.875rem 3rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.875rem', fontWeight: '500' }} />
                </div>
              </div>

              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '0.5rem' }}>CONTRASEÑA SECRETA</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input 
                    name="password" 
                    type={showPassword ? 'text' : 'password'} 
                    required 
                    placeholder="Mínimo 6 caracteres" 
                    minLength={6}
                    style={{ width: '100%', padding: '0.875rem 3rem 0.875rem 3rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.875rem', fontWeight: '500' }} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '0.5rem' }}>ROL DEL SISTEMA</label>
                <div style={{ position: 'relative' }}>
                  <ShieldCheck size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <select name="role_id" required style={{ width: '100%', padding: '0.875rem 1rem 0.875rem 3rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.875rem', fontWeight: '600', backgroundColor: 'white' }}>
                    <option value="">Seleccione el nivel de acceso...</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '1rem', fontWeight: '700', borderRadius: '10px' }} onClick={() => setShowCreateUserModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: '1rem', fontWeight: '800', borderRadius: '10px', backgroundColor: '#7c3aed', border: 'none' }} disabled={saving}>
                  {saving ? <><Loader2 className="animate-spin" size={18} style={{ marginRight: '0.5rem' }} /> Registrando...</> : 'Confirmar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUserModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '90%', maxWidth: '480px', padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem 2rem', background: 'linear-gradient(135deg, #475569 0%, #334155 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '950', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Edit2 size={22} /> Editar Perfil
                </h2>
                <p style={{ fontSize: '0.8rem', opacity: 0.9, margin: '0.25rem 0 0 0' }}>Actualiza los permisos y datos del personal.</p>
              </div>
              <button onClick={() => setShowUserModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '50%', padding: '0.5rem', display: 'flex' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveUser} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '0.5rem' }}>NOMBRE COMPLETO</label>
                <div style={{ position: 'relative' }}>
                  <UserIcon size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input name="full_name" defaultValue={editingUser?.full_name} required style={{ width: '100%', padding: '0.875rem 1rem 0.875rem 3rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.875rem', fontWeight: '500' }} />
                </div>
              </div>

              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '0.5rem' }}>ROL DEL SISTEMA</label>
                <div style={{ position: 'relative' }}>
                  <ShieldCheck size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <select name="role_id" defaultValue={editingUser?.role_id} required style={{ width: '100%', padding: '0.875rem 1rem 0.875rem 3rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.875rem', fontWeight: '600', backgroundColor: 'white' }}>
                    <option value="">Seleccione el nivel de acceso...</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '0.5rem' }}>NUEVA CONTRASEÑA (OPCIONAL)</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input 
                    name="new_password" 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Dejar en blanco para mantener actual" 
                    minLength={6}
                    style={{ width: '100%', padding: '0.875rem 3rem 0.875rem 3rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.875rem', fontWeight: '500' }} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.5rem' }}>Escribe aquí solo si deseas cambiar la contraseña de este usuario.</p>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '1rem', fontWeight: '700', borderRadius: '10px' }} onClick={() => setShowUserModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: '1rem', fontWeight: '800', borderRadius: '10px', backgroundColor: '#334155', border: 'none' }} disabled={saving}>
                  {saving ? <><Loader2 className="animate-spin" size={18} style={{ marginRight: '0.5rem' }} /> Actualizando...</> : 'Actualizar Perfil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
