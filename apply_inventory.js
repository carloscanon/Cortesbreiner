const fs = require('fs');
const file = 'components/FinishedGoodsInventory.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("const items = [...transferForm.items, {", "const items = [{");
content = content.replace(/nameLabel:\s*displayName\s*\}\];/, "nameLabel: displayName }, ...transferForm.items];");

content = content.replace("const items = [...transferForm.items, {", "const items = [{");
content = content.replace(/nameLabel:\s*prod\.nombre_producto\s*\}\];/, "nameLabel: prod.nombre_producto }, ...transferForm.items];");

content = content.replace(
  "items: [...transferForm.items, { product_id: products[0]?.id || '', color_id: colors[0]?.id || '', size_id: sizes[0]?.id || '', cantidad: 1 }]",
  "items: [{ product_id: products[0]?.id || '', color_id: colors[0]?.id || '', size_id: sizes[0]?.id || '', cantidad: 1 }, ...transferForm.items]"
);

fs.writeFileSync(file, content, 'utf8');
