import re

content = open('app/page.tsx', 'r', encoding='utf-8').read()

# ---- PATCH 1: Add sewingPage state ----
old_state = "  const [sewingFilterEndDate, setSewingFilterEndDate] = useState('');"
new_state = "  const [sewingFilterEndDate, setSewingFilterEndDate] = useState('');\n  const [sewingPage, setSewingPage] = useState(0);\n  const SEWING_PAGE_SIZE = 15;"
if old_state in content:
    content = content.replace(old_state, new_state, 1)
    print('PATCH 1 OK: sewingPage state added')
else:
    print('PATCH 1 FAIL')

# ---- PATCH 2: Add pagination vars after filter ----
old2 = "      // Calculate Metrics for the filtered list\n      let totalLotes = filteredSewingOrdersForTab.length;"
new2 = (
    "      // Paginated slice (15 per page)\n"
    "      const sewingTotalPages = Math.ceil(filteredSewingOrdersForTab.length / SEWING_PAGE_SIZE);\n"
    "      const pagedSewingOrders = filteredSewingOrdersForTab.slice(sewingPage * SEWING_PAGE_SIZE, (sewingPage + 1) * SEWING_PAGE_SIZE);\n"
    "\n"
    "      // Calculate Metrics for the filtered list\n"
    "      let totalLotes = filteredSewingOrdersForTab.length;"
)
if old2 in content:
    content = content.replace(old2, new2, 1)
    print('PATCH 2 OK: pagination vars added')
else:
    print('PATCH 2 FAIL')

# ---- PATCH 3: Use pagedSewingOrders in table ----
old3 = "                  ) : filteredSewingOrdersForTab.map(so => {"
new3 = "                  ) : pagedSewingOrders.map(so => {"
if old3 in content:
    content = content.replace(old3, new3, 1)
    print('PATCH 3 OK: table uses pagedSewingOrders')
else:
    print('PATCH 3 FAIL')

# ---- PATCH 4: Add pagination controls after </table> (after </tbody>) ----
old4 = "                </tbody>\n              </table>\n            </div>\n          </div>\n          {/* CONFIRMAR ENVÍO A CALIDAD MODAL */}"
new4 = (
    "                </tbody>\n"
    "              </table>\n"
    "              {/* Pagination Controls */}\n"
    "              {sewingTotalPages > 1 && (\n"
    "                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9' }}>\n"
    "                  <button\n"
    "                    onClick={() => setSewingPage(p => Math.max(0, p - 1))}\n"
    "                    disabled={sewingPage === 0}\n"
    "                    style={{ padding: '0.4rem 0.85rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: sewingPage === 0 ? '#f8fafc' : 'white', color: sewingPage === 0 ? '#94a3b8' : '#334155', fontWeight: '700', cursor: sewingPage === 0 ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}\n"
    "                  >← Anterior</button>\n"
    "                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>\n"
    "                    Página {sewingPage + 1} de {sewingTotalPages} · {filteredSewingOrdersForTab.length} órdenes\n"
    "                  </span>\n"
    "                  <button\n"
    "                    onClick={() => setSewingPage(p => Math.min(sewingTotalPages - 1, p + 1))}\n"
    "                    disabled={sewingPage >= sewingTotalPages - 1}\n"
    "                    style={{ padding: '0.4rem 0.85rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: sewingPage >= sewingTotalPages - 1 ? '#f8fafc' : 'white', color: sewingPage >= sewingTotalPages - 1 ? '#94a3b8' : '#334155', fontWeight: '700', cursor: sewingPage >= sewingTotalPages - 1 ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}\n"
    "                  >Siguiente →</button>\n"
    "                </div>\n"
    "              )}\n"
    "            </div>\n"
    "          </div>\n"
    "          {/* CONFIRMAR ENVÍO A CALIDAD MODAL */}"
)
if old4 in content:
    content = content.replace(old4, new4, 1)
    print('PATCH 4 OK: pagination controls added')
else:
    print('PATCH 4 FAIL')

# ---- PATCH 5: Fix Ficha button to open ficha_tecnica_url directly ----
# Find the specific button with onClick that checks parentOrder for Ficha action
old5 = (
    "                            onClick={() => {\n"
    "                                if (parentOrder) {\n"
    "                                  setViewingOrderDetails({ \n"
    "                                    ...so, \n"
    "                                    parent_order: parentOrder\n"
    "                                  });\n"
    "                                }\n"
    "                              }} \n"
    "                              style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', fontWeight: '800', color: '#80082E', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}\n"
    "                            >\n"
    "                              📄 Ficha"
)
new5 = (
    "                            onClick={() => {\n"
    "                                const pOrder = so.parent_order || orders.find(o => o.id === so.parent_order_id);\n"
    "                                const prodObj2 = so.products || productsList.find(p => String(p.id) === String(so.product_id));\n"
    "                                const catObj2 = prodObj2 ? categories.find(c => String(c.id) === String(prodObj2.category_id)) : null;\n"
    "                                const fichaUrl = catObj2?.ficha_tecnica_url;\n"
    "                                if (fichaUrl) {\n"
    "                                  window.open(fichaUrl, '_blank');\n"
    "                                } else {\n"
    "                                  setViewingOrderDetails({ ...so, parent_order: pOrder });\n"
    "                                }\n"
    "                              }} \n"
    "                              style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', fontWeight: '800', color: '#80082E', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}\n"
    "                            >\n"
    "                              📄 Ficha"
)
if old5 in content:
    content = content.replace(old5, new5, 1)
    print('PATCH 5 OK: Ficha button opens URL or modal')
else:
    print('PATCH 5 FAIL')

open('app/page.tsx', 'w', encoding='utf-8').write(content)
print('Script complete')
