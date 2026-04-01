
export const API = {
  products: "/api/products",
  sales: "/api/sales"
};

export async function apiGet(url){
  const r = await fetch(url);
  return r.json();
}

export async function apiPost(url, data){
  const r = await fetch(url, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify(data)
  });
  return r.json();
}
