'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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
  ChevronRight
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('roles');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

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

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'roles') {
        const { data: rolesData } = await supabase.from('roles').select('*').order('name', { ascending: true });
        const { data: permsData } = await supabase.from('permissions').select('*').order('module', { ascending: true });
        
        // Fetch role permissions for all roles
        const { data: rolePerms } = await supabase.from('role_permissions').select('*');
        
        const rolesWithPerms = rolesData?.map(role => ({
          ...role,
          permissions: rolePerms?.filter(rp => rp.role_id === role.id).map(rp => rp.permission_id) || []
        })) || [];

        setRoles(rolesWithPerms);
        setPermissions(permsData || []);
      } else if (activeTab === 'users') {
        const { data: profiles } = await supabase.from('profiles').select('*, roles(id, name)');
        setUsers(profiles || []);
        const { data: rolesData } = await supabase.from('roles').select('*');
        setRoles(rolesData || []);
      } else if (activeTab === 'company') {
        const { data } = await supabase.from('company_params').select('*');
        if (data && data.length > 0) {
          setCompanyParams(data);
        } else {
          setCompanyParams([
            { name: 'logo_url', value: '', description: 'URL del logo' },
            { name: 'logo_width', value: '150', description: 'Ancho del logo (px)' },
            { name: 'mobile_app_image_url', value: '', description: 'Imagen App Móvil' }
          ]);
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

      setShowRoleModal(false);
      setEditingRole(null);
      setSelectedPermissions([]);
      fetchData();
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

    try {
      if (editingUser) {
        const { error } = await supabase.from('profiles').update(userData).eq('id', editingUser.id);
        if (error) throw error;
      }
      setShowUserModal(false);
      setEditingUser(null);
      fetchData();
      setMessage('Usuario actualizado.');
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

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      });

      if (authError) throw authError;

      if (authData.user) {
        const cleanRoleId = role_id && role_id !== '' ? role_id : null;
        await new Promise(resolve => setTimeout(resolve, 800));
        await supabase.from('profiles').upsert([
          { id: authData.user.id, full_name, role_id: cleanRoleId }
        ]);
      }

      setShowCreateUserModal(false);
      fetchData();
      setMessage('Usuario registrado con éxito.');
      setTimeout(() => setMessage(''), 5000);
    } catch (err: any) {
      alert('Error: ' + err.message);
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
      const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(fileName);
      await supabase.from('company_params').upsert({ name: 'logo_url', value: publicUrl, description: 'URL del logo' }, { onConflict: 'name' });
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
      await supabase.from('company_params').upsert({ name, value }, { onConflict: 'name' });
      setMessage('Ajuste guardado.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      console.error(err);
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
                          <p style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Módulos Habilitados:</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {role.permissions?.length > 0 ? (
                              role.permissions.map(pId => (
                                <span key={pId} className="badge badge-success" style={{ fontSize: '0.625rem' }}>
                                  {permissions.find(p => p.id === pId)?.module}
                                </span>
                              ))
                            ) : <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>Sin accesos configurados</span>}
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
                        <button className="btn-icon" onClick={() => { setEditingUser(u); setShowUserModal(true); }}><Edit2 size={16} /></button>
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
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.4rem', display: 'block' }}>Ancho del Logo (px)</label>
                          <input 
                            type="number" 
                            className="input" 
                            style={{ width: '100%' }} 
                            defaultValue={companyParams.find(p => p.name === 'logo_width')?.value || '150'} 
                            onBlur={(e) => handleUpdateParam('logo_width', e.target.value)}
                          />
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
                              const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, file, { upsert: true });
                              if (uploadError) throw uploadError;
                              const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(fileName);
                              await handleUpdateParam('mobile_app_image_url', publicUrl);
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    {permissions.map(perm => (
                      <label key={perm.id} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem', 
                        padding: '0.75rem 1rem', 
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
                          style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                        />
                        <span style={{ fontSize: '0.875rem', fontWeight: selectedPermissions.includes(perm.id) ? '700' : '500' }}>
                          {perm.name}
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '90%', maxWidth: '450px', padding: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3>Nuevo Usuario</h3>
              <button className="btn-icon" onClick={() => setShowCreateUserModal(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Nombre Completo</label>
                <input name="full_name" required className="input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Email</label>
                <input name="email" type="email" required className="input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Password</label>
                <input name="password" type="password" required className="input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Rol</label>
                <select name="role_id" required className="input" style={{ width: '100%' }}>
                  <option value="">Seleccione...</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateUserModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUserModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '90%', maxWidth: '450px', padding: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3>Editar Perfil</h3>
              <button className="btn-icon" onClick={() => setShowUserModal(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Nombre</label>
                <input name="full_name" defaultValue={editingUser?.full_name} required className="input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Rol</label>
                <select name="role_id" defaultValue={editingUser?.role_id} className="input" style={{ width: '100%' }}>
                  <option value="">Sin Rol</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowUserModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>Actualizar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
