const fs = require('fs');
let file = fs.readFileSync('app/store-admin/page.tsx', 'utf8');

// 1. Change handleUpdateItemPrice to handleUpdateCategoryDiscount
const handleUpdateItemPriceBlock = \  const handleUpdateItemPrice = async (listId: string, productId: string, priceStr: string) => {
    const price = Number(priceStr);
    try {
      const existing = priceListItems.find(item => item.price_list_id === listId && item.product_id === productId);
      if (isNaN(price) || price <= 0) {
        if (existing) {
          await supabase.from('pos_price_list_items').delete().eq('id', existing.id);
        }
      } else {
        if (existing) {
          await supabase.from('pos_price_list_items').update({ precio: price }).eq('id', existing.id);
        } else {
          await supabase.from('pos_price_list_items').insert([{
            price_list_id: listId,
            product_id: productId,
            precio: price
          }]);
        }
      }
      alert("✅ Precio especial actualizado.");
      fetchData();
    } catch (err: any) {
      alert("Error al actualizar precio: " + err.message);
    }
  };\;

const handleUpdateCategoryDiscountBlock = \  const handleUpdateCategoryDiscount = async (listId: string, category: string, type: string, valueStr: string) => {
    const val = Number(valueStr);
    try {
      const existing = priceListItems.find(item => item.price_list_id === listId && item.categoria === category);
      if (isNaN(val) || val <= 0) {
        if (existing) {
          await supabase.from('pos_price_list_items').delete().eq('id', existing.id);
        }
      } else {
        if (existing) {
          await supabase.from('pos_price_list_items').update({ tipo_descuento: type, valor_descuento: val }).eq('id', existing.id);
        } else {
          await supabase.from('pos_price_list_items').insert([{
            price_list_id: listId,
            categoria: category,
            tipo_descuento: type,
            valor_descuento: val
          }]);
        }
      }
      alert("✅ Descuento de categoría actualizado.");
      fetchData();
    } catch (err: any) {
      alert("Error al actualizar descuento: " + err.message);
    }
  };\;

file = file.replace(handleUpdateItemPriceBlock, handleUpdateCategoryDiscountBlock);
// If it fails with exact match, we can just do regex or something. Let's see if this works.

fs.writeFileSync('app/store-admin/page.tsx', file, 'utf8');
