const fs = require('fs');
let content = fs.readFileSync('app/masters/page.tsx', 'utf8');

// 1. Add state
content = content.replace(
  "const [currentPage, setCurrentPage] = useState(1);",
  "const [currentPage, setCurrentPage] = useState(1);\n  const [productFilter, setProductFilter] = useState<'todos' | 'habilitados' | 'inhabilitados'>('todos');"
);

// 2. Add Tabs UI
const searchBlock =              <div style={{ position: 'relative', width: '300px' }}>
                <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ padding: '0.75rem 1rem 0.75rem 2.5rem', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', width: '250px', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                  onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'; }}
                />
             </div>;

const replaceSearchBlock =              <div style={{ position: 'relative', width: '300px' }}>
                <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ padding: '0.75rem 1rem 0.75rem 2.5rem', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', width: '100%', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                  onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'; }}
                />
             </div>

             {activeTab === 'products' && (
               <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '10px' }}>
                 {(['todos', 'habilitados', 'inhabilitados'] as const).map(f => (
                   <button
                     key={f}
                     onClick={() => { setProductFilter(f); setCurrentPage(1); }}
                     style={{
                       padding: '0.5rem 1rem',
                       borderRadius: '8px',
                         border: 'none',
                         fontSize: '0.8rem',
                         fontWeight: productFilter === f ? '800' : '600',
                         backgroundColor: productFilter === f ? 'white' : 'transparent',
                         color: productFilter === f ? '#0f172a' : '#64748b',
                         boxShadow: productFilter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                         cursor: 'pointer',
                         textTransform: 'capitalize',
                         transition: 'all 0.2s ease'
                     }}
                   >
                     {f}
                   </button>
                 ))}
               </div>
             )};

content = content.replace(searchBlock, replaceSearchBlock);
content = content.replace(
  "borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between'",
  "borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem'"
);

// 3. Add Filter logic
const filterBlock =               const filteredData = data.filter(item => {
                if (!search) return true;;

const replaceFilterBlock =               const filteredData = data.filter(item => {
                if (activeTab === 'products') {
                  const status = item.estado || 'activo';
                  if (productFilter === 'habilitados' && status === 'inactivo') return false;
                  if (productFilter === 'inhabilitados' && status !== 'inactivo') return false;
                }
                if (!search) return true;;
                
content = content.replace(filterBlock, replaceFilterBlock);

fs.writeFileSync('app/masters/page.tsx', content, 'utf8');
