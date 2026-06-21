const axios = require('axios');
async function main() {
  try {
    const res = await axios.get('http://localhost:3001/v1/admin/tienda-configuracion/pedidos', {
      headers: {
        // Mock a tenant id if necessary, but we might need auth token if it's protected
      }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
main();
